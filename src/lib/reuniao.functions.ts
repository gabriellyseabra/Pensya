import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

async function callGemini(system: string, user: string) {
  return callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user });
}

// ============= Gerar pauta =============
const PautaInput = z.object({
  paciente_id: z.string().uuid(),
  tipo: z.enum(["pais", "escola", "equipe", "outro"]),
  contexto_adicional: z.string().max(2000).optional(),
});

export const gerarPautaReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PautaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, queixa_principal, hipotese_diagnostica, escolaridade")
      .eq("id", data.paciente_id)
      .maybeSingle();

    const { data: metas } = await supabase
      .from("metas_terapeuticas")
      .select("id, titulo, dominio_cognitivo, status")
      .eq("paciente_id", data.paciente_id)
      .in("status", ["ativa", "planejamento"]);

    const metaIds = (metas ?? []).map((m: any) => m.id);
    const { data: gasUltimas } = metaIds.length ? await supabase
      .from("sessao_metas")
      .select("meta_id, nivel_gas_observado, observacoes_meta, sessao:prontuario_sessoes(data_sessao)")
      .in("meta_id", metaIds)
      .order("created_at", { ascending: false })
      .limit(30) : { data: [] as any[] };

    const { data: sessoes } = await supabase
      .from("prontuario_sessoes")
      .select("data_sessao, tipo, evolucao, soap_avaliacao, engajamento, nivel_suporte")
      .eq("paciente_id", data.paciente_id)
      .order("data_sessao", { ascending: false })
      .limit(6);

    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("titulo, status, prazo")
      .eq("paciente_id", data.paciente_id)
      .neq("status", "concluida")
      .limit(20);

    const userPrompt = `PACIENTE
Nome: ${pac?.nome ?? "—"}
Queixa: ${pac?.queixa_principal ?? "—"}
Hipótese: ${pac?.hipotese_diagnostica ?? "—"}
Escolaridade: ${pac?.escolaridade ?? "—"}

REUNIÃO COM: ${data.tipo}
${data.contexto_adicional ? `Contexto: ${data.contexto_adicional}` : ""}

METAS ATIVAS
${(metas ?? []).map((m: any) => `- [${m.id.slice(0,4)}] ${m.titulo} (${m.dominio_cognitivo ?? "—"})`).join("\n") || "—"}

PROGRESSO GAS RECENTE
${(gasUltimas ?? []).slice(0, 15).map((g: any) => `- meta ${g.meta_id.slice(0,4)}: nível ${g.nivel_gas_observado ?? "—"} ${g.observacoes_meta ? `("${g.observacoes_meta.slice(0,120)}")` : ""}`).join("\n") || "—"}

ÚLTIMAS SESSÕES
${(sessoes ?? []).map((s: any) => `- ${s.data_sessao} [${s.tipo}] avaliação: ${(s.evolucao ?? s.soap_avaliacao ?? "").slice(0,300)}`).join("\n") || "—"}

TAREFAS PENDENTES
${(tarefas ?? []).map((t: any) => `- ${t.titulo} (prazo ${t.prazo ?? "—"})`).join("\n") || "—"}

Gere uma pauta sugerida para esta reunião. Devolva JSON EXATO:
{
  "objetivo_reuniao": "1 frase do propósito",
  "topicos": [
    { "titulo": "...", "descricao": "o que abordar e por quê", "tempo_min": 5 }
  ],
  "perguntas_chave": ["pergunta 1", "pergunta 2"],
  "pontos_progresso": ["o que destacar de avanço"],
  "pontos_atencao": ["o que precisa de atenção"],
  "encaminhamentos_sugeridos": ["ação proposta + responsável sugerido"]
}`;

    const SYSTEM = `Você é uma psicopedagoga clínica sênior preparando uma reunião com ${data.tipo === "pais" ? "pais/responsáveis" : data.tipo === "escola" ? "equipe escolar" : data.tipo === "equipe" ? "equipe multidisciplinar" : "interlocutor"}. Use linguagem objetiva, acolhedora e clínica. Não invente dados — use apenas o material fornecido. Devolva SOMENTE JSON válido.`;

    return await callGemini(SYSTEM, userPrompt);
  });

// ============= Sintetizar ata =============
const AtaInput = z.object({
  paciente_id: z.string().uuid(),
  tipo: z.enum(["pais", "escola", "equipe", "outro"]),
  notas: z.string().min(20).max(20000),
  pauta: z.string().max(5000).optional(),
  participantes: z.string().max(500).optional(),
});

export const sintetizarAtaReuniao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AtaInput.parse(d))
  .handler(async ({ data }) => {
    const SYSTEM = `Você é uma psicopedagoga clínica organizando a ata formal de uma reunião com ${data.tipo}. A partir das notas brutas, produza ata estruturada em português, terceira pessoa, objetiva e respeitosa. Não invente fatos. Devolva SOMENTE JSON válido.`;
    const userPrompt = `PARTICIPANTES: ${data.participantes ?? "—"}
${data.pauta ? `\nPAUTA PREVISTA:\n${data.pauta}\n` : ""}
NOTAS BRUTAS DA REUNIÃO:
"""
${data.notas}
"""

Devolva JSON EXATO:
{
  "ata": "texto narrativo organizado da reunião (markdown)",
  "decisoes": "lista markdown das decisões tomadas",
  "encaminhamentos": [
    { "acao": "...", "responsavel": "...", "prazo": "YYYY-MM-DD ou texto" }
  ],
  "proxima_data_sugerida": "YYYY-MM-DD ou null",
  "resumo": "1-2 frases para listagem"
}`;
    return await callGemini(SYSTEM, userPrompt);
  });
