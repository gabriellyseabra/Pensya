import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

const SYSTEM_PROMPT = `Você é uma assistente clínica que LÊ documentos (prontuários, relatórios, planilhas, anamneses, laudos) e extrai informações estruturadas para alimentar um sistema clínico de psicopedagogia/neuropsicologia.

REGRAS:
- NÃO invente nada. Se um campo não aparece no documento, deixe null ou array vazio.
- Preserve a linguagem original sempre que possível (em português).
- Use as opções literais sugeridas quando aplicável.
- Para escalas 0-10 (rede_apoio, compreensao, expressao, coordenacao_*, equilibrio, adaptacao, leitura, escrita, matematica, interesse, frustacao, autorregulacao, estrutura_diaria, higiene, vestir_se, alimentar_se, tarefas_casa, iniciativa): devolva um NÚMERO INTEIRO 0-10.
- Retorne SOMENTE JSON válido com EXATAMENTE este schema (sem comentários, sem markdown):

{
  "dados_pessoais": {
    "nome": "string|null", "data_nascimento": "YYYY-MM-DD|null", "genero": "string|null",
    "documento": "string|null", "cpf": "string|null", "telefone": "string|null",
    "email": "string|null", "endereco": "string|null", "escolaridade": "string|null",
    "serie_curso": "string|null", "contato_escola": "string|null",
    "queixa_principal": "string|null", "expectativas": "string|null", "observacoes": "string|null"
  },
  "responsaveis": [
    { "nome": "string", "parentesco": "string|null", "profissao": "string|null", "telefone": "string|null", "email": "string|null", "idade": "number|null", "estado_civil": "string|null" }
  ],
  "hipoteses": ["string"],
  "diagnosticos": ["string"],
  "perfil_vivo": {
    "preferencias": ["string"], "potencializadores": ["string"], "interesses": ["string"],
    "reforcadores": [{"descricao":"string","intensidade":"baixa|media|alta"}],
    "barreiras": [{"descricao":"string"}],
    "estrategias_funcionam": ["string"], "estrategias_nao_funcionam": ["string"],
    "hipoteses_ativas": ["string"]
  },
  "anamnese_estruturada": {
    "identificacao": { "nome_completo":"string|null","data_nascimento":"YYYY-MM-DD|null","genero":"string|null","lateralidade":"string|null","naturalidade":"string|null" },
    "queixa_principal": { "queixa":"string|null","tempo_evolucao":"string|null","quem_identificou":["string"],"expectativas":"string|null" },
    "contexto_familiar": { "configuracao":"string|null","irmaos":"number|null","rede_apoio":"0-10|null","rotina_estruturada":"string|null","historico_familiar":["string"],"observacoes":"string|null" },
    "gestacao": { "gestacao_planejada":"string|null","intercorrencias_gestacao":["string"],"tipo_parto":"string|null","idade_gestacional":"number|null","peso_nascimento":"number|null","intercorrencias_parto":["string"] },
    "desenvolvimento": { "sustentou_cabeca":"string|null","sentou":"string|null","andou":"string|null","marcos_atrasados":["string"] },
    "linguagem": { "primeiras_palavras":"string|null","frases":"string|null","compreensao":"0-10|null","expressao":"0-10|null","alteracoes":["string"] },
    "motor": { "coordenacao_global":"0-10|null","coordenacao_fina":"0-10|null","equilibrio":"0-10|null","dificuldades":["string"] },
    "sensorial": { "auditivo":"Hipo|Típica|Hiper|null","visual":"Hipo|Típica|Hiper|null","tato":"Hipo|Típica|Hiper|null","alimentar":"string|null","vestir":"string|null" },
    "saude": { "condicoes":["string"],"medicacoes":"string|null","alergias":"string|null","sono":"string|null","alimentacao":"string|null","controle_esfincteres":"string|null" },
    "historico_clinico": { "tratamentos_anteriores":["string"],"diagnosticos_previos":"string|null","exames":"string|null","medicacao_psiquiatrica":"string|null" },
    "escolar": { "escola_atual":"string|null","serie":"string|null","tipo":"string|null","adaptacao":"0-10|null","trocas_escola":"number|null","queixas_escola":["string"] },
    "aprendizagem": { "leitura":"0-10|null","escrita":"0-10|null","matematica":"0-10|null","interesse":"0-10|null","estrategias_que_funcionam":["string"] },
    "comportamento": { "humor":"string|null","frustacao":"0-10|null","autorregulacao":"0-10|null","comportamentos":["string"] },
    "rotina": { "estrutura_diaria":"0-10|null","tempo_tela":"string|null","atividade_fisica":"string|null","atividades_extras":["string"] },
    "autonomia": { "higiene":"0-10|null","vestir_se":"0-10|null","alimentar_se":"0-10|null","tarefas_casa":"0-10|null" },
    "social": { "contato_visual":"string|null","amigos":"string|null","brincadeira":["string"],"iniciativa":"0-10|null" },
    "interesses": { "interesses":["string"],"reforcadores":["string"],"aversoes":"string|null" },
    "observacoes_gerais": { "observacoes":"string|null" }
  },
  "resumo": "string"
}`;

const Input = z.object({
  paciente_id: z.string().uuid(),
  modo: z.enum(["pdf", "planilha", "texto"]),
  pdf_base64: z.string().optional(),
  pdf_mime: z.string().optional(),
  texto: z.string().optional(),
  filename: z.string().optional(),
});

export const importarProntuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const instrucao = `Extraia os dados estruturados do documento abaixo para o prontuário do paciente. Preencha o MÁXIMO de campos possível com base no texto, especialmente o objeto "anamnese_estruturada". Devolva SOMENTE o JSON no schema indicado.`;

    let userPrompt: string;
    let file: { mimeType: string; base64: string } | undefined;

    if (data.modo === "pdf") {
      if (!data.pdf_base64) throw new Error("PDF não fornecido");
      userPrompt = instrucao;
      file = { mimeType: data.pdf_mime ?? "application/pdf", base64: data.pdf_base64 };
    } else {
      if (!data.texto) throw new Error("Texto não fornecido");
      userPrompt = `${instrucao}\n\nConteúdo (planilha/texto):\n\n${data.texto.slice(0, 60000)}`;
    }

    let extraido: any = {};
    try {
      extraido = await callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: SYSTEM_PROMPT, userPrompt, file });
    } catch {
      extraido = {};
    }

    return { extraido };
  });
