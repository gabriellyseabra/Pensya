import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini, callGeminiJSON } from "@/lib/gemini-client";

/* ==================== Comunicação família/escola ==================== */

const ComunicacaoInput = z.object({
  destinatario: z.enum(["familia", "escola", "profissional"]),
  tom: z.enum(["acolhedor", "formal", "objetivo", "motivador"]),
  tamanho: z.enum(["curta", "media", "longa"]),
  canal: z.enum(["whatsapp", "email", "bilhete"]),
  contexto: z.string().min(1).max(4000),
  paciente_id: z.string().uuid().optional().nullable(),
});

const LABEL_DEST: Record<string, string> = { familia: "a família", escola: "a escola/professores", profissional: "outro profissional" };
const LABEL_TOM: Record<string, string> = { acolhedor: "acolhedor e empático", formal: "formal e respeitoso", objetivo: "objetivo e direto", motivador: "motivador e encorajador" };
const LABEL_TAM: Record<string, string> = { curta: "curta (2-4 frases)", media: "média (1 parágrafo)", longa: "mais completa (2-3 parágrafos)" };
const LABEL_CANAL: Record<string, string> = { whatsapp: "mensagem de WhatsApp", email: "e-mail (com saudação e despedida)", bilhete: "bilhete/comunicado impresso" };

export const gerarComunicacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComunicacaoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let sobrePaciente = "";
    if (data.paciente_id) {
      const { data: p } = await supabase
        .from("pacientes").select("nome, queixa_principal").eq("id", data.paciente_id).maybeSingle();
      if (p) sobrePaciente = `\nPaciente: ${p.nome}${p.queixa_principal ? `. Contexto clínico resumido: ${p.queixa_principal}` : ""}.`;
    }

    const system =
      "Você é assistente de comunicação de uma clínica de psicopedagogia. Escreva mensagens claras, " +
      "acolhedoras e eticamente responsáveis. NUNCA prometa diagnóstico, cura ou resultados; não exponha " +
      "dados sensíveis além do necessário; use linguagem acessível e respeitosa. Escreva em português do Brasil. " +
      "Devolva SOMENTE o texto final da mensagem, sem títulos, aspas ou comentários.";
    const user =
      `Escreva uma ${LABEL_CANAL[data.canal]} para ${LABEL_DEST[data.destinatario]}, em tom ${LABEL_TOM[data.tom]}, ` +
      `extensão ${LABEL_TAM[data.tamanho]}.${sobrePaciente}\n\nO que precisa ser comunicado:\n${data.contexto}`;

    const texto = await callGemini({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user, json: false });
    return { texto: (texto ?? "").trim() };
  });

/* ==================== Roteiro de estudos ==================== */

const RoteiroInput = z.object({
  ano: z.string().max(120).optional().default(""),
  disciplinas: z.string().min(1).max(2000),
  tempo: z.string().max(400).optional().default(""),
  perfil: z.array(z.string()).max(12).optional().default([]),
  objetivos: z.string().max(2000).optional().default(""),
});

export type RoteiroEstudos = {
  resumo: string;
  cronograma: { dia: string; blocos: { atividade: string; minutos: number }[] }[];
  estrategias: { disciplina: string; itens: string[] }[];
  familia: string[];
};

export const gerarRoteiroEstudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RoteiroInput.parse(d))
  .handler(async ({ data }): Promise<RoteiroEstudos> => {
    const system =
      "Você é psicopedagogo(a) especialista em ciência da aprendizagem. Monte um roteiro de estudos semanal " +
      "REALISTA e personalizado, respeitando o tempo realmente disponível. Baseie-se em evidências: prática " +
      "distribuída (spacing), recuperação ativa (retrieval practice/autotestagem), intercalação de temas, blocos " +
      "curtos com pausas (ex.: 20-30 min + pausa), e adaptações para o perfil informado (ex.: TDAH → blocos mais " +
      "curtos, metas visíveis, menos alternância abrupta; dislexia → apoio multissensorial, mais tempo de leitura). " +
      "Nunca sobrecarregue. Escreva em português do Brasil, com linguagem acessível para a família. " +
      "Responda APENAS em JSON com este formato: " +
      '{"resumo": string, "cronograma": [{"dia": string, "blocos": [{"atividade": string, "minutos": number}]}], ' +
      '"estrategias": [{"disciplina": string, "itens": [string]}], "familia": [string]}.';
    const user =
      `Ano/série: ${data.ano || "não informado"}.\n` +
      `Perfil: ${data.perfil.length ? data.perfil.join(", ") : "não informado"}.\n` +
      `Disciplinas e dificuldades: ${data.disciplinas}.\n` +
      `Tempo disponível: ${data.tempo || "não informado"}.\n` +
      `Objetivos/observações: ${data.objetivos || "—"}.`;

    const res = await callGeminiJSON<RoteiroEstudos>({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user });
    return {
      resumo: res?.resumo ?? "",
      cronograma: Array.isArray(res?.cronograma) ? res.cronograma : [],
      estrategias: Array.isArray(res?.estrategias) ? res.estrategias : [],
      familia: Array.isArray(res?.familia) ? res.familia : [],
    };
  });
