import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

// ETAPA 13 — Devolutiva clínica automática do ciclo.
// Síntese técnica baseada SOMENTE nas evidências registradas nas sessões.
const SYSTEM_PROMPT = `Você é uma psicopedagoga clínica sênior redigindo a DEVOLUTIVA de um ciclo terapêutico. Produza uma síntese clínica, técnica e clara, baseada APENAS nas evidências registradas (GAS, evidências clínicas, componentes, progresso e variáveis transversais).

REGRAS:
- Não invente dados nem números. Use apenas o resumo fornecido.
- Linguagem clínica, objetiva, em português, sem juízo de valor.
- Foque na evolução FUNCIONAL (participação), não em atividades isoladas.
- Devolva SOMENTE JSON válido conforme o schema.`;

const Input = z.object({
  paciente_id: z.string().uuid(),
  plano_id: z.string().uuid().optional(),
});

const PROGRESSO_POS = new Set(["sim", "parcial"]);
const PROGRESSO_NEG = new Set(["regressao", "sem_mudanca"]);

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => n != null && !Number.isNaN(n));
  if (!v.length) return null;
  return +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
}

export const gerarDevolutivaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, queixa_principal, escolaridade, serie_curso")
      .eq("id", data.paciente_id)
      .maybeSingle();

    // Plano (o indicado ou o mais recente)
    let plano: any = null;
    if (data.plano_id) {
      const { data: p } = await supabase.from("planos_terapeuticos").select("id, titulo, objetivo_participacao, ciclo_semanas").eq("id", data.plano_id).maybeSingle();
      plano = p;
    } else {
      const { data: p } = await supabase.from("planos_terapeuticos").select("id, titulo, objetivo_participacao, ciclo_semanas").eq("paciente_id", data.paciente_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      plano = p;
    }

    const { data: metasPlano } = await supabase
      .from("plano_metas")
      .select("titulo_smart, dominio, status, nivel_gas_atingido, meta_terapeutica_id, objetivo:plano_objetivos(titulo)")
      .eq("plano_id", plano?.id ?? "00000000-0000-0000-0000-000000000000");

    // Sessões + registro por meta (evidências, componentes, GAS, progresso) + variáveis transversais
    const { data: sessoes } = await supabase
      .from("prontuario_sessoes")
      .select("id, data_sessao, engajamento, motivacao, persistencia, autorregulacao, participacao, sessao_metas(meta_id, nivel_gas_observado, evidencias_clinicas, componentes_trabalhados, houve_progresso)")
      .eq("paciente_id", data.paciente_id)
      .order("data_sessao", { ascending: true });

    // Índice meta_terapeutica -> título SMART
    const tituloPorMeta = new Map<string, string>();
    (metasPlano ?? []).forEach((m: any) => { if (m.meta_terapeutica_id) tituloPorMeta.set(m.meta_terapeutica_id, m.titulo_smart); });

    // Agregação por meta
    const porMeta = new Map<string, any[]>();
    for (const s of (sessoes ?? [])) {
      for (const sm of ((s as any).sessao_metas ?? [])) {
        const arr = porMeta.get(sm.meta_id) ?? [];
        arr.push({ ...sm, data: (s as any).data_sessao });
        porMeta.set(sm.meta_id, arr);
      }
    }

    const metasResumo = Array.from(porMeta.entries()).map(([metaId, regs]) => {
      regs.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
      const gass = regs.map((r) => r.nivel_gas_observado).filter((n) => n != null).map(Number);
      const forte = new Map<string, number>(); const limita = new Map<string, number>();
      for (const r of regs) {
        const comps: string[] = Array.isArray(r.componentes_trabalhados) ? r.componentes_trabalhados : [];
        if (PROGRESSO_POS.has(r.houve_progresso)) comps.forEach((c) => forte.set(c, (forte.get(c) ?? 0) + 1));
        else if (PROGRESSO_NEG.has(r.houve_progresso)) comps.forEach((c) => limita.set(c, (limita.get(c) ?? 0) + 1));
      }
      const evid = regs.filter((r) => (r.evidencias_clinicas ?? "").trim()).slice(-4).map((r) => `(${r.data}) ${r.evidencias_clinicas}`);
      return `Meta: ${tituloPorMeta.get(metaId) ?? "—"}
  GAS: ${gass.length ? gass.join(" → ") : "sem registro"} (último: ${gass.length ? gass[gass.length - 1] : "—"})
  Componentes fortalecidos: ${Array.from(forte.keys()).join(", ") || "—"}
  Componentes ainda limitantes: ${Array.from(limita.keys()).join(", ") || "—"}
  Evidências recentes: ${evid.join(" | ") || "—"}`;
    }).join("\n\n");

    const transversais = {
      engajamento: avg((sessoes ?? []).map((s: any) => s.engajamento)),
      motivacao: avg((sessoes ?? []).map((s: any) => s.motivacao)),
      persistencia: avg((sessoes ?? []).map((s: any) => s.persistencia)),
      autorregulacao: avg((sessoes ?? []).map((s: any) => s.autorregulacao)),
      participacao: avg((sessoes ?? []).map((s: any) => s.participacao)),
    };

    const idade = pac?.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / 31557600000) : null;

    const userPrompt = `PACIENTE: ${pac?.nome ?? "—"} | Idade: ${idade ?? "—"} | ${pac?.escolaridade ?? "—"} ${pac?.serie_curso ?? ""}
Queixa: ${pac?.queixa_principal ?? "—"}
PLANO: ${plano?.titulo ?? "—"} | Objetivo de participação: ${plano?.objetivo_participacao ?? "—"} | Ciclo: ${plano?.ciclo_semanas ?? "—"} semanas
Total de sessões com registro: ${(sessoes ?? []).length}

EVOLUÇÃO POR META
${metasResumo || "Nenhum registro de meta em sessões."}

VARIÁVEIS TRANSVERSAIS (média 1-5): ${JSON.stringify(transversais)}

Redija a devolutiva do ciclo em JSON com este schema EXATO:
{
  "resumo_evolucao": "1-2 parágrafos de síntese técnica da evolução funcional",
  "metas_alcancadas": ["..."],
  "metas_andamento": ["..."],
  "componentes_evolucao": ["componentes com maior evolução"],
  "componentes_limitantes": ["componentes ainda limitantes"],
  "mudancas_comportamentais": "texto",
  "mudancas_participacao": "texto (o que mudou na vida real/participação)",
  "variaveis_transversais": "leitura clínica das variáveis transversais",
  "proximas_prioridades": ["..."]
}`;

    const parsed = await callGeminiJSON({ model: "gemini-2.5-pro", systemPrompt: SYSTEM_PROMPT, userPrompt });
    return { plano_id: plano?.id ?? null, conteudo: parsed, ai_modelo: "gemini-2.5-pro" };
  });
