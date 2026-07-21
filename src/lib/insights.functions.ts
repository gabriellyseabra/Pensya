import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

async function callGemini(system: string, user: string) {
  return callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user });
}

type SerieGAS = { meta_id: string; titulo: string; dominio: string | null; valores: { data: string; nivel: number }[] };

function calcularSlope(pontos: { x: number; y: number }[]): number {
  if (pontos.length < 2) return 0;
  const n = pontos.length;
  const sx = pontos.reduce((s, p) => s + p.x, 0);
  const sy = pontos.reduce((s, p) => s + p.y, 0);
  const sxx = pontos.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = pontos.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

function classificarTendencia(slope: number, diasSemMudanca: number, n: number): "progresso" | "estagnada" | "regressao" | "insuficiente" {
  if (n < 2) return "insuficiente";
  if (slope <= -0.15) return "regressao";
  if (slope >= 0.15) return "progresso";
  if (diasSemMudanca > 30) return "estagnada";
  return "progresso";
}

// ============= Analisar evolução das metas (puro analytics) =============
const EvolucaoInput = z.object({ paciente_id: z.string().uuid() });

export const analisarEvolucaoMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EvolucaoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: metas } = await supabase
      .from("metas_terapeuticas")
      .select("id, titulo, dominio_cognitivo, status")
      .eq("paciente_id", data.paciente_id)
      .in("status", ["ativa", "planejamento"]);

    if (!metas?.length) return { metas: [] };

    const metaIds = metas.map((m: any) => m.id);
    const { data: registros } = await supabase
      .from("sessao_metas")
      .select("meta_id, nivel_gas_observado, sessao:prontuario_sessoes(data_sessao)")
      .in("meta_id", metaIds)
      .not("nivel_gas_observado", "is", null);

    const porMeta = new Map<string, { data: string; nivel: number }[]>();
    (registros ?? []).forEach((r: any) => {
      const arr = porMeta.get(r.meta_id) ?? [];
      if (r.sessao?.data_sessao && r.nivel_gas_observado != null) {
        arr.push({ data: r.sessao.data_sessao, nivel: Number(r.nivel_gas_observado) });
      }
      porMeta.set(r.meta_id, arr);
    });

    const resultado = metas.map((m: any) => {
      const todas = (porMeta.get(m.id) ?? []).sort((a, b) => a.data.localeCompare(b.data));
      const ultimas = todas.slice(-6);
      const pontos = ultimas.map((p, i) => ({ x: i, y: p.nivel }));
      const slope = calcularSlope(pontos);

      // Dias sem mudança de nível
      let diasSemMudanca = 0;
      if (todas.length >= 2) {
        const ultima = todas[todas.length - 1];
        let nivelAtual = ultima.nivel;
        let dataReferencia = ultima.data;
        for (let i = todas.length - 2; i >= 0; i--) {
          if (todas[i].nivel !== nivelAtual) break;
          dataReferencia = todas[i].data;
        }
        diasSemMudanca = Math.floor((Date.now() - new Date(dataReferencia).getTime()) / 86400000);
      } else if (todas.length === 1) {
        diasSemMudanca = Math.floor((Date.now() - new Date(todas[0].data).getTime()) / 86400000);
      }

      const tendencia = classificarTendencia(slope, diasSemMudanca, ultimas.length);

      return {
        meta_id: m.id,
        titulo: m.titulo,
        dominio: m.dominio_cognitivo ?? null,
        n_registros: todas.length,
        nivel_atual: todas[todas.length - 1]?.nivel ?? null,
        slope: Number(slope.toFixed(3)),
        dias_sem_mudanca: diasSemMudanca,
        tendencia,
        serie: ultimas,
      };
    });

    return { metas: resultado };
  });

// ============= Insight semanal (IA + cache) =============
const InsightInput = z.object({ paciente_id: z.string().uuid(), force: z.boolean().optional() });

export const gerarInsightSemanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InsightInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Verificar cache (24h)
    if (!data.force) {
      const { data: pac } = await supabase
        .from("pacientes")
        .select("insight_cache, insight_gerado_em")
        .eq("id", data.paciente_id)
        .maybeSingle();
      if (pac?.insight_cache && pac.insight_gerado_em) {
        const idade = Date.now() - new Date(pac.insight_gerado_em).getTime();
        if (idade < 7 * 86400000) {
          return { ...(pac.insight_cache as any), cached: true, gerado_em: pac.insight_gerado_em };
        }
      }
    }

    // Coleta de contexto
    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, queixa_principal, hipotese_diagnostica")
      .eq("id", data.paciente_id)
      .maybeSingle();

    const { data: sessoes } = await supabase
      .from("prontuario_sessoes")
      .select("data_sessao, tipo, evolucao, soap_avaliacao")
      .eq("paciente_id", data.paciente_id)
      .order("data_sessao", { ascending: false })
      .limit(4);

    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("titulo, prazo, prioridade")
      .eq("paciente_id", data.paciente_id)
      .neq("status", "concluida")
      .order("prazo", { nullsFirst: false });

    const { data: proxAtend } = await supabase
      .from("atendimentos")
      .select("inicio, profissional:profissionais_consultorio(nome)")
      .eq("paciente_id", data.paciente_id)
      .gte("inicio", new Date().toISOString())
      .order("inicio")
      .limit(1)
      .maybeSingle();

    const SYSTEM = `Você é uma psicopedagoga clínica sênior. Gere um insight semanal proativo e clínico sobre o paciente, conciso (máx 4 parágrafos curtos em markdown), em português. Não invente dados. Devolva SOMENTE JSON válido.`;

    const userPrompt = `PACIENTE: ${pac?.nome ?? "—"}
Queixa: ${pac?.queixa_principal ?? "—"}
Hipótese: ${pac?.hipotese_diagnostica ?? "—"}

ÚLTIMAS SESSÕES:
${(sessoes ?? []).map((s: any) => `- ${s.data_sessao} [${s.tipo}]: ${(s.evolucao ?? s.soap_avaliacao ?? "").slice(0, 300)}`).join("\n") || "—"}

TAREFAS PENDENTES: ${(tarefas ?? []).length}
${(tarefas ?? []).slice(0, 5).map((t: any) => `- ${t.titulo} (${t.prioridade}, prazo ${t.prazo ?? "—"})`).join("\n")}

PRÓXIMO ATENDIMENTO: ${proxAtend ? `${proxAtend.inicio} com ${(proxAtend as any).profissional?.nome ?? "—"}` : "nenhum agendado"}

Devolva JSON EXATO:
{
  "destaque": "1 frase principal do momento clínico",
  "insight": "texto markdown (3-4 parágrafos curtos) com observações, hipóteses e sugestões para a próxima sessão",
  "acoes_sugeridas": ["ação 1", "ação 2"]
}`;

    const result = await callGemini(SYSTEM, userPrompt);

    // Persistir cache
    await supabase
      .from("pacientes")
      .update({ insight_cache: result, insight_gerado_em: new Date().toISOString() })
      .eq("id", data.paciente_id);

    return { ...result, cached: false, gerado_em: new Date().toISOString() };
  });

// ============= Dashboard: metas estagnadas em todos os pacientes ativos =============
export const listarMetasEstagnadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: pacs } = await supabase
      .from("pacientes")
      .select("id, nome")
      .eq("status", "ativo");
    if (!pacs?.length) return { metas: [] };

    const ids = pacs.map((p: any) => p.id);
    const { data: metas } = await supabase
      .from("metas_terapeuticas")
      .select("id, titulo, paciente_id")
      .in("paciente_id", ids)
      .in("status", ["ativa", "planejamento"]);
    if (!metas?.length) return { metas: [] };

    const metaIds = metas.map((m: any) => m.id);
    const { data: registros } = await supabase
      .from("sessao_metas")
      .select("meta_id, nivel_gas_observado, sessao:prontuario_sessoes(data_sessao)")
      .in("meta_id", metaIds)
      .not("nivel_gas_observado", "is", null);

    const porMeta = new Map<string, { data: string; nivel: number }[]>();
    (registros ?? []).forEach((r: any) => {
      const arr = porMeta.get(r.meta_id) ?? [];
      if (r.sessao?.data_sessao) {
        arr.push({ data: r.sessao.data_sessao, nivel: Number(r.nivel_gas_observado) });
      }
      porMeta.set(r.meta_id, arr);
    });

    const pacMap = new Map(pacs.map((p: any) => [p.id, p.nome]));

    const resultado = metas
      .map((m: any) => {
        const todas = (porMeta.get(m.id) ?? []).sort((a, b) => a.data.localeCompare(b.data));
        if (todas.length < 2) return null;
        const ultima = todas[todas.length - 1];
        let dataRef = ultima.data;
        for (let i = todas.length - 2; i >= 0; i--) {
          if (todas[i].nivel !== ultima.nivel) break;
          dataRef = todas[i].data;
        }
        const dias = Math.floor((Date.now() - new Date(dataRef).getTime()) / 86400000);
        if (dias < 30) return null;
        return {
          meta_id: m.id,
          titulo: m.titulo,
          paciente_id: m.paciente_id,
          paciente_nome: pacMap.get(m.paciente_id) ?? "—",
          dias_sem_mudanca: dias,
          nivel_atual: ultima.nivel,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.dias_sem_mudanca - a.dias_sem_mudanca)
      .slice(0, 10);

    return { metas: resultado };
  });
