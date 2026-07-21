import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini } from "@/lib/gemini-client";

async function chamarIA(systemPrompt: string, userPrompt: string, jsonMode = true) {
  const content = await callGemini({ model: "gemini-2.5-flash", systemPrompt, userPrompt, json: jsonMode });
  if (jsonMode) {
    try { return JSON.parse(content); }
    catch { return {}; }
  }
  return content;
}

// =======================================================
// 1) Síntese clínica (mantido — usado pelo wizard antigo)
// =======================================================

const SYSTEM_SINTESE = `Você é uma psicopedagoga clínica sênior. Produza uma SÍNTESE CLÍNICA INTEGRADA conectando os dados disponíveis.

REGRAS:
- Não invente. Use APENAS o que está nos registros.
- Conecte fatos: aponte correlações plausíveis.
- Linguagem clínica, objetiva, em português.
- Devolva SOMENTE JSON válido no schema solicitado.`;

const SintetizarInput = z.object({ paciente_id: z.string().uuid() });

export const sintetizarAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SintetizarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: pac }, { data: pre }, { data: resps }] = await Promise.all([
      supabase.from("pacientes").select("nome, data_nascimento, genero, queixa_principal, expectativas, hipotese_diagnostica, observacoes, escolaridade, serie_curso").eq("id", data.paciente_id).maybeSingle(),
      supabase.from("paciente_pre_anamnese").select("*").eq("paciente_id", data.paciente_id).maybeSingle(),
      supabase.from("responsaveis").select("nome, parentesco, idade, profissao, estado_civil").eq("paciente_id", data.paciente_id),
    ]);
    if (!pac) throw new Error("Paciente não encontrado");
    const idade = pac.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    const prompt = `Dados:
Nome: ${pac.nome} | Idade: ${idade ?? "—"} | Gênero: ${pac.genero ?? "—"}
Queixa: ${pac.queixa_principal ?? "—"}
Expectativas: ${pac.expectativas ?? "—"}
Responsáveis: ${(resps ?? []).map(r => `${r.nome} (${r.parentesco ?? "—"})`).join("; ") || "—"}
Anamnese estruturada:
${pre ? JSON.stringify(pre.secoes_estruturadas ?? {}, null, 2) : "Não preenchida."}
Pré-anamnese livre:
${pre ? JSON.stringify({ gestacao: pre.gestacao, parto: pre.parto, saude: pre.saude, contexto_familiar: pre.contexto_familiar }, null, 2) : "—"}

Devolva JSON:
{
  "resumo_executivo": "1 parágrafo",
  "marcos_relevantes": [], "fatores_protetivos": [], "fatores_de_risco": [],
  "correlacoes_clinicas": [{"descricao":"","justificativa":""}],
  "lacunas_a_investigar": [], "hipoteses_a_considerar": [], "encaminhamentos_sugeridos": []
}`;
    return await chamarIA(SYSTEM_SINTESE, prompt);
  });

// =======================================================
// 2) Análise PARCIAL em tempo real (durante o preenchimento)
// =======================================================

const SYSTEM_PARCIAL = `Você é uma psicopedagoga sênior auxiliando uma colega DURANTE uma anamnese.
Os dados estão sendo digitados em tempo real e podem estar incompletos.
Gere INSIGHTS preliminares, marcando claramente que são sugestões para validação humana.

REGRAS:
- NUNCA dê diagnóstico. Use "aspectos que merecem investigação".
- Não invente. Se faltar dado, indique como LACUNA.
- Português clínico, conciso.
- Devolva SOMENTE JSON.`;

const AnalisarParcialInput = z.object({
  paciente_id: z.string().uuid(),
  secoes: z.record(z.any()),
});

export const analisarAnamneseParcial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalisarParcialInput.parse(d))
  .handler(async ({ data }) => {
    const prompt = `Anamnese em construção (JSON estruturado):
${JSON.stringify(data.secoes, null, 2)}

Devolva JSON com este schema (cada item é uma string curta):
{
  "marcos_relevantes": [],
  "fatores_protetivos": [],
  "fatores_de_risco": [],
  "hipoteses_a_considerar": [],
  "lacunas_a_investigar": [],
  "correlacoes_clinicas": [{"descricao":"", "justificativa":""}],
  "encaminhamentos_sugeridos": []
}`;
    return await chamarIA(SYSTEM_PARCIAL, prompt);
  });

// =======================================================
// 3) Resumo por seção
// =======================================================

const ResumirSecaoInput = z.object({
  secao_key: z.string(),
  secao_titulo: z.string(),
  dados: z.record(z.any()),
});

export const resumirSecaoAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResumirSecaoInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `Você sintetiza UMA seção de anamnese em 2-3 frases técnicas, em português, sem diagnóstico. Apenas texto puro, sem markdown.`;
    const user = `Seção: ${data.secao_titulo}
Dados: ${JSON.stringify(data.dados, null, 2)}

Escreva um parágrafo técnico curto resumindo o que foi relatado.`;
    const txt = await chamarIA(sys, user, false);
    return { resumo: String(txt).trim() };
  });

// =======================================================
// 4) Cálculo do radar
// =======================================================

const RadarInput = z.object({
  paciente_id: z.string().uuid(),
  secoes: z.record(z.any()),
});

export const calcularRadarAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RadarInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `Você atribui scores 0–10 para domínios da anamnese, onde 10 = excelente funcionamento/sem riscos, 0 = grandes dificuldades/muitos riscos. Devolva SOMENTE JSON.`;
    const user = `Dados:
${JSON.stringify(data.secoes, null, 2)}

Devolva:
{
  "contexto_familiar": 0-10,
  "gestacao": 0-10,
  "desenvolvimento": 0-10,
  "escolar": 0-10,
  "comportamento": 0-10,
  "rotina": 0-10,
  "justificativa": { "contexto_familiar": "", "gestacao": "", "desenvolvimento": "", "escolar": "", "comportamento": "", "rotina": "" }
}`;
    return await chamarIA(sys, user);
  });

// =======================================================
// 5) Resumo COMPLETO da anamnese (gerado ao final)
// =======================================================

const ResumoCompletoInput = z.object({
  paciente_id: z.string().uuid(),
  secoes: z.record(z.any()),
  observacoes: z.record(z.string()).optional(),
});

export const gerarResumoCompletoAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResumoCompletoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, genero, queixa_principal")
      .eq("id", data.paciente_id)
      .maybeSingle();
    const idade = pac?.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    const sys = `Você é uma psicopedagoga clínica sênior. Gere um RESUMO CLÍNICO COMPLETO da anamnese, integrando todos os dados em texto corrido e coeso, em português técnico. Estruture em parágrafos por eixo (identificação e queixa, história gestacional/perinatal, desenvolvimento, saúde, contexto familiar, escolar/aprendizagem, comportamento/social, rotina/autonomia, considerações finais). NÃO dê diagnóstico. NÃO invente. Use apenas o que está nos dados. Apenas texto puro, sem markdown.`;
    const user = `Paciente: ${pac?.nome ?? "—"} | Idade: ${idade ?? "—"} | Gênero: ${pac?.genero ?? "—"}
Queixa principal: ${pac?.queixa_principal ?? "—"}

Dados estruturados da anamnese:
${JSON.stringify(data.secoes, null, 2)}

Observações complementares por seção:
${JSON.stringify(data.observacoes ?? {}, null, 2)}

Escreva o resumo clínico completo.`;
    const txt = await chamarIA(sys, user, false);
    return { resumo: String(txt).trim() };
  });

