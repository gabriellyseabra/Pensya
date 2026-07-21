import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini } from "@/lib/gemini-client";

// ETAPA 1 (Fase 1.5) — Fontes documentais.
// Extrai o texto de um documento anexado ao paciente (relatório, laudo, registro
// de sessões) para que o "Gerar com IA" possa cruzá-lo como fonte, sem exigir
// que os dados sejam digitados manualmente no sistema.

const Input = z.object({ documento_id: z.string().uuid() });

const MAX_CHARS = 40000;

export const extrairTextoDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: doc } = await supabase
      .from("paciente_documentos")
      .select("id, titulo, storage_path, mime_type, link_externo")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");
    if (!doc.storage_path || doc.storage_path === "external") {
      throw new Error("Este item é um link externo — baixe e anexe o arquivo para extrair o texto.");
    }

    const { data: file, error: dlErr } = await supabase.storage
      .from("pacientes-docs")
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error("Não foi possível baixar o arquivo do storage.");

    const mime = doc.mime_type ?? "";
    let texto = "";

    if (mime.startsWith("text/")) {
      // Arquivos de texto: leitura direta
      texto = (await file.text()).slice(0, MAX_CHARS);
    } else if (mime === "application/pdf" || mime.startsWith("image/")) {
      // PDFs e imagens: extração via IA (multimodal)
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const content = await callGemini({
        model: "gemini-2.5-flash",
        json: false,
        systemPrompt:
          "Você extrai fielmente o texto de documentos clínicos (laudos, relatórios de avaliação/evolução, registros de sessão). Transcreva o conteúdo textual relevante em português, incluindo tabelas de escores quando houver. Não invente, não resuma em excesso, não faça juízo de valor. Se o documento for ilegível, responda apenas 'SEM_TEXTO'.",
        userPrompt: `Extraia o texto integral e relevante deste documento (título: ${doc.titulo}).`,
        file: { mimeType: mime, base64 },
      });
      texto = (content ?? "").trim().slice(0, MAX_CHARS);
      if (!texto || texto === "SEM_TEXTO") {
        throw new Error("Não foi possível extrair texto legível deste documento.");
      }
    } else {
      throw new Error(`Formato não suportado para extração (${mime || "desconhecido"}). Envie PDF, imagem ou texto.`);
    }

    await supabase
      .from("paciente_documentos")
      .update({ texto_extraido: texto, extraido_em: new Date().toISOString() })
      .eq("id", doc.id);

    return { ok: true, chars: texto.length, preview: texto.slice(0, 500) };
  });
