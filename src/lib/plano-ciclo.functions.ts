import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

type MetaAnalise = {
  meta_id: string;
  titulo: string;
  dominio?: string | null;
  status: string;
  total_sessoes: number;
  ultima_sessao?: string | null;
  desempenho_medio?: number | null;
  desempenho_recente?: number | null;
  gas_medio?: number | null;
  gas_ultimo?: number | null;
  tendencia: "progresso" | "estavel" | "regressao" | "sem_dados";
  sugestao: "manter" | "ajustar" | "encerrar" | "suspender";
  motivo: string;
};

type AnaliseRegras = {
  plano_id: string;
  data_analise: string;
  metas: MetaAnalise[];
  alertas: string[];
};

async function carregarDadosCiclo(supabase: any, plano_id: string) {
  const { data: plano } = await supabase
    .from("planos_terapeuticos")
    .select(
      "id, paciente_id, titulo, ciclo_semanas, data_inicio, data_revisao_prevista, objetivo_participacao, cif_funcoes, cif_atividades, cif_participacao",
    )
    .eq("id", plano_id)
    .maybeSingle();
  if (!plano) throw new Error("Plano não encontrado");

  const { data: metas } = await supabase
    .from("plano_metas")
    .select(
      "id, titulo_smart, dominio, baseline, prazo_semanas, status, meta_terapeutica_id, ordem",
    )
    .eq("plano_id", plano_id)
    .order("ordem");

  const metaIds = (metas ?? []).map((m: any) => m.meta_terapeutica_id).filter(Boolean);
  let sessaoMetas: any[] = [];
  if (metaIds.length) {
    const { data } = await supabase
      .from("sessao_metas")
      .select(
        "meta_id, plano_meta_id, desempenho, nivel_gas_observado, engajamento, sessao:prontuario_sessoes(id, data_sessao, paciente_id)",
      )
      .in("meta_id", metaIds);
    sessaoMetas = (data ?? []).filter((s: any) => s.sessao?.paciente_id === plano.paciente_id);
  }

  return { plano, metas: metas ?? [], sessaoMetas };
}

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => n != null && !Number.isNaN(n));
  if (!v.length) return null;
  return +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
}

function tendencia(scores: number[]): MetaAnalise["tendencia"] {
  if (scores.length < 2) return "sem_dados";
  const half = Math.floor(scores.length / 2);
  const a = avg(scores.slice(0, half));
  const b = avg(scores.slice(half));
  if (a == null || b == null) return "sem_dados";
  if (b - a >= 0.3) return "progresso";
  if (a - b >= 0.3) return "regressao";
  return "estavel";
}

const AnalisarInput = z.object({ plano_id: z.string().uuid() });

export const analisarCicloRegras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalisarInput.parse(d))
  .handler(async ({ data, context }): Promise<AnaliseRegras> => {
    const { plano, metas, sessaoMetas } = await carregarDadosCiclo(context.supabase, data.plano_id);

    const porMeta = new Map<string, any[]>();
    for (const sm of sessaoMetas) {
      const key = sm.meta_id;
      const arr = porMeta.get(key) ?? [];
      arr.push({ ...sm, data: sm.sessao?.data_sessao });
      porMeta.set(key, arr);
    }

    const analiseMetas: MetaAnalise[] = metas.map((m: any) => {
      const regs = (porMeta.get(m.meta_terapeutica_id) ?? []).sort((a, b) =>
        (a.data ?? "").localeCompare(b.data ?? ""),
      );
      const desemps = regs.map((r) => r.desempenho).filter((n) => n != null) as number[];
      const gass = regs.map((r) => r.nivel_gas_observado).filter((n) => n != null) as number[];
      const desempMedio = avg(desemps);
      const desempRecente = avg(desemps.slice(-4));
      const tend = tendencia(desemps);

      let sugestao: MetaAnalise["sugestao"] = "manter";
      let motivo = "Continuar trabalhando.";
      const gasUltimo = gass[gass.length - 1];

      if (regs.length === 0) {
        sugestao = "manter";
        motivo = "Sem registros de sessão para esta meta. Avalie se ela foi trabalhada.";
      } else if (gasUltimo != null && gasUltimo >= 1 && gass.filter((g) => g >= 1).length >= 2) {
        sugestao = "encerrar";
        motivo = "Meta atingida ou superada (GAS ≥ +1 em ≥2 registros).";
      } else if (
        desempRecente != null &&
        desempRecente < 2 &&
        desemps.length >= 4 &&
        tend !== "progresso"
      ) {
        sugestao = "ajustar";
        motivo = `Desempenho recente baixo (média ${desempRecente}) sem evolução. Revisar estratégias ou meta.`;
      } else if (tend === "regressao") {
        sugestao = "ajustar";
        motivo = "Tendência de regressão. Reavaliar abordagem.";
      } else if (tend === "progresso") {
        sugestao = "manter";
        motivo = `Em evolução positiva (média recente ${desempRecente ?? "—"}).`;
      }

      return {
        meta_id: m.id,
        titulo: m.titulo_smart,
        dominio: m.dominio,
        status: m.status,
        total_sessoes: regs.length,
        ultima_sessao: regs[regs.length - 1]?.data ?? null,
        desempenho_medio: desempMedio,
        desempenho_recente: desempRecente,
        gas_medio: avg(gass),
        gas_ultimo: gasUltimo ?? null,
        tendencia: tend,
        sugestao,
        motivo,
      };
    });

    const alertas: string[] = [];
    if (plano.data_revisao_prevista) {
      const dias = Math.ceil(
        (new Date(plano.data_revisao_prevista).getTime() - Date.now()) / 86400000,
      );
      if (dias < 0) alertas.push(`Ciclo expirou há ${-dias} dias.`);
      else if (dias < 14) alertas.push(`Ciclo termina em ${dias} dias.`);
    }
    const semRegistro = analiseMetas.filter((m) => m.total_sessoes === 0).length;
    if (semRegistro) alertas.push(`${semRegistro} meta(s) sem nenhum registro de sessão.`);
    const emRisco = analiseMetas.filter((m) => m.sugestao === "ajustar").length;
    if (emRisco) alertas.push(`${emRisco} meta(s) em risco — sugestão: ajustar.`);

    return {
      plano_id: plano.id,
      data_analise: new Date().toISOString(),
      metas: analiseMetas,
      alertas,
    };
  });

const IASystem = `Você é uma psicopedagoga clínica sênior fazendo revisão de ciclo terapêutico.
Receba o resumo objetivo do ciclo (análise por regras + dados clínicos) e produza uma NARRATIVA CLÍNICA + recomendações fundamentadas por meta.

REGRAS:
- Não invente números. Use APENAS os dados do resumo.
- Conecte desempenho com perfil CIF, queixa e contexto.
- Para cada meta indique manter | ajustar | encerrar | suspender, com justificativa clínica.
- Quando sugerir nova meta, ela deve ser FUNCIONAL e relevante para o dia a dia — SEM estrutura SMART no título (métricas, percentuais e prazos ficam nos campos próprios da meta, nunca na frase).
- Devolva SOMENTE JSON válido.`;

const RevisarIAInput = z.object({
  plano_id: z.string().uuid(),
  analise_regras: z.any(),
});

export const revisarCicloIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevisarIAInput.parse(d))
  .handler(async ({ data, context }) => {
    const { plano } = await carregarDadosCiclo(context.supabase, data.plano_id);

    const prompt = `PLANO
Título: ${plano.titulo} | Ciclo: ${plano.ciclo_semanas} semanas
Objetivo de participação: ${plano.objetivo_participacao ?? "—"}
CIF — Funções: ${plano.cif_funcoes ?? "—"}
CIF — Atividades: ${plano.cif_atividades ?? "—"}
CIF — Participação: ${plano.cif_participacao ?? "—"}

ANÁLISE OBJETIVA (regras)
${JSON.stringify(data.analise_regras, null, 2)}

Devolva JSON:
{
  "sintese_clinica": "1-2 parágrafos narrando o ciclo, conectando ao perfil",
  "metas": [
    { "meta_id": "...", "decisao": "manter|ajustar|encerrar|suspender", "racional": "...", "ajuste_sugerido": "se ajustar — descreva como" }
  ],
  "novas_metas_sugeridas": [
    { "titulo_smart": "...", "dominio": "...", "baseline": "...", "racional": "..." }
  ],
  "proximos_passos": ["..."]
}`;

    return callGeminiJSON({ model: "gemini-2.5-pro", systemPrompt: IASystem, userPrompt: prompt });
  });

const AprovarInput = z.object({
  plano_id: z.string().uuid(),
  tipo: z.enum(["automatica_regras", "ia", "manual"]),
  resumo: z.any(),
  sugestoes: z.any().optional(),
  observacao: z.string().max(4000).optional(),
  decisoes: z
    .array(
      z.object({
        meta_id: z.string().uuid(),
        novo_status: z.enum(["ativa", "concluida", "suspensa", "revisada"]),
        nivel_gas_atingido: z.number().int().min(-2).max(2).nullable().optional(),
      }),
    )
    .default([]),
});

export const aprovarRevisaoCiclo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AprovarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rev, error: revErr } = await supabase
      .from("plano_ciclo_revisoes")
      .insert({
        plano_id: data.plano_id,
        tipo: data.tipo,
        resumo: data.resumo,
        sugestoes: data.sugestoes ?? null,
        observacao: data.observacao ?? null,
        aprovado_por: userId,
      })
      .select("id")
      .single();
    if (revErr) throw revErr;

    for (const d of data.decisoes) {
      const patch: any = { status: d.novo_status };
      if (d.nivel_gas_atingido != null) {
        patch.nivel_gas_atingido = d.nivel_gas_atingido;
        patch.data_revisao = new Date().toISOString().slice(0, 10);
      }
      await supabase.from("plano_metas").update(patch).eq("id", d.meta_id);
    }

    await supabase
      .from("planos_terapeuticos")
      .update({ data_revisao_realizada: new Date().toISOString().slice(0, 10) })
      .eq("id", data.plano_id);

    return { ok: true, revisao_id: rev!.id };
  });
