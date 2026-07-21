import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";
import { REGRAS_ESCRITA_NAVE } from "@/lib/nave-relatorio";

const SYSTEM_PROMPT = `Você analisa um DOCUMENTO MODELO (relatório, laudo ou plano) enviado por uma psicopedagoga e extrai um TEMPLATE REUTILIZÁVEL para que o sistema gere novos documentos seguindo a MESMA lógica, estrutura e tom do modelo.

O template tem dois campos centrais:
- "estrutura": a lista de seções/tópicos do documento, na ordem em que aparecem, como um sumário numerado. Descreva cada seção em uma linha, indicando entre parênteses o que ela contém (ex.: tabelas, gráfico, subseções). Se o modelo tiver um gráfico de perfil cognitivo/síntese, inclua o marcador literal {{GRAFICO_PERFIL}} na seção correspondente.
- "instrucoes_extra": as regras de TOM, LINGUAGEM, formatação e textos fixos que o modelo segue (voz, nível de formalidade, uso de tabelas coloridas por classificação, expressões a evitar, jargão da clínica, assinatura/rodapé, etc.). Seja específico e fiel ao modelo.

Também identifique:
- "nome": um nome curto e descritivo para o template (ex.: "Relatório de Avaliação Nave").
- "tipo": um entre "avaliacao", "laudo", "plano_terapeutico", "evolucao", "reuniao", "livre" (o que melhor descreve o modelo).
- "descricao": uma frase sobre quando usar este template.

${REGRAS_ESCRITA_NAVE}

Devolva SOMENTE JSON válido neste schema, sem markdown:
{
  "nome": "string",
  "tipo": "avaliacao|laudo|plano_terapeutico|evolucao|reuniao|livre",
  "descricao": "string",
  "estrutura": "string (sumário numerado, uma seção por linha)",
  "instrucoes_extra": "string (regras de tom/linguagem/formatação/textos fixos)"
}`;

const Input = z.object({
  pdf_base64: z.string().min(1),
  pdf_mime: z.string().optional(),
  filename: z.string().optional(),
});

export const derivarTemplateDeModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const userPrompt = `Analise o documento modelo em anexo${data.filename ? ` ("${data.filename}")` : ""} e extraia o template reutilizável no schema indicado. Preserve fielmente a estrutura de seções e o tom do modelo.`;

    const derivado = await callGeminiJSON<{
      nome?: string; tipo?: string; descricao?: string; estrutura?: string; instrucoes_extra?: string;
    }>({
      model: "gemini-2.5-flash",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      file: { mimeType: data.pdf_mime ?? "application/pdf", base64: data.pdf_base64 },
    });

    const tiposValidos = ["avaliacao", "laudo", "plano_terapeutico", "evolucao", "reuniao", "livre"];
    return {
      nome: (derivado.nome ?? "Template importado").slice(0, 120),
      tipo: tiposValidos.includes(derivado.tipo ?? "") ? derivado.tipo : "livre",
      descricao: derivado.descricao ?? "",
      estrutura: derivado.estrutura ?? "",
      instrucoes_extra: derivado.instrucoes_extra ?? "",
    };
  });
