import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini } from "@/lib/gemini-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// MÓDULO 3 — Banco de Referências.
// Extrai o texto de PDFs de referência (artigos/ebooks) e monta o bloco de
// referências relevantes que alimenta a IA (plano, sessão, raciocínio, relatórios).

const Input = z.object({ referencia_id: z.string().uuid() });

const MAX_CHARS = 40000;

// ---------------------------------------------------------------------------
// Extração de texto de uma referência anexada (PDF / imagem / texto).
// Espelha extrairTextoDocumento (fontes.functions.ts), mas na tabela referencias.
// ---------------------------------------------------------------------------
export const extrairTextoReferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: ref } = await supabase
      .from("referencias")
      .select("id, titulo, arquivo_path")
      .eq("id", data.referencia_id)
      .maybeSingle();
    if (!ref) throw new Error("Referência não encontrada");
    if (!ref.arquivo_path) {
      throw new Error("Esta referência não tem arquivo anexado — anexe um PDF para extrair o texto.");
    }

    const { data: file, error: dlErr } = await supabase.storage
      .from("pacientes-docs")
      .download(ref.arquivo_path);
    if (dlErr || !file) throw new Error("Não foi possível baixar o arquivo do storage.");

    const mime = (file as Blob).type ?? "";
    let texto = "";

    if (mime.startsWith("text/")) {
      texto = (await file.text()).slice(0, MAX_CHARS);
    } else if (mime === "application/pdf" || mime.startsWith("image/")) {
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const content = await callGemini({
        model: "gemini-2.5-flash",
        json: false,
        systemPrompt:
          "Você extrai fielmente o texto de referências acadêmicas/técnicas (artigos, capítulos, diretrizes, ebooks). Transcreva o conteúdo textual relevante em português (ou no idioma original quando for citação técnica), preservando definições, achados e recomendações. Não invente e não faça juízo de valor. Se o documento for ilegível, responda apenas 'SEM_TEXTO'.",
        userPrompt: `Extraia o texto integral e relevante desta referência (título: ${ref.titulo}).`,
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
      .from("referencias")
      .update({ texto_extraido: texto } as never)
      .eq("id", ref.id);

    return { ok: true, chars: texto.length, preview: texto.slice(0, 500) };
  });

// ---------------------------------------------------------------------------
// Helper reutilizável (NÃO server fn): monta o bloco de referências para o prompt.
// Casa tags/domínio das referências com os `termos` do caso; inclui primeiro as
// fixadas (pin global), depois as de maior score, até um orçamento de caracteres.
// Retorna string vazia quando não há referências (sem efeito no prompt).
// ---------------------------------------------------------------------------
type ReferenciaCtx = {
  id: string;
  titulo: string;
  autores: string | null;
  ano: number | null;
  tipo: string;
  dominio: string | null;
  tags: string[] | null;
  resumo: string | null;
  texto_extraido: string | null;
  fixada: boolean;
};

export async function buscarReferenciasRelevantes(
  supabase: SupabaseClient,
  termos: string[],
  opts?: { limiteChars?: number },
): Promise<{ bloco: string; usadas: { id: string; titulo: string }[] }> {
  const limiteChars = opts?.limiteChars ?? 10000;

  const { data } = await supabase
    .from("referencias")
    .select("id, titulo, autores, ano, tipo, dominio, tags, resumo, texto_extraido, fixada")
    .eq("ativo", true);

  const refs = ((data ?? []) as ReferenciaCtx[]).filter(
    (r) => (r.texto_extraido && r.texto_extraido.trim()) || (r.resumo && r.resumo.trim()),
  );
  if (refs.length === 0) return { bloco: "", usadas: [] };

  const termosSet = new Set(termos.map((t) => t.toLowerCase().trim()).filter(Boolean));
  const score = (r: ReferenciaCtx) => {
    const campos = [...(r.tags ?? []), r.dominio ?? ""].map((t) => t.toLowerCase());
    let s = 0;
    for (const c of campos) {
      if (!c) continue;
      for (const termo of termosSet) {
        if (termo && (c.includes(termo) || termo.includes(c))) { s += 1; break; }
      }
    }
    return s;
  };

  // Fixadas primeiro; depois por score desc; empate por título.
  const ordenadas = [...refs].sort((a, b) => {
    if (a.fixada !== b.fixada) return a.fixada ? -1 : 1;
    return score(b) - score(a) || a.titulo.localeCompare(b.titulo);
  });

  const usadas: { id: string; titulo: string }[] = [];
  const partes: string[] = [];
  let total = 0;
  for (const r of ordenadas) {
    // Referência não-fixada sem nenhuma relevância é ignorada (evita ruído).
    if (!r.fixada && score(r) === 0) continue;
    const corpo = (r.texto_extraido && r.texto_extraido.trim()) || (r.resumo ?? "");
    if (!corpo) continue;
    const restante = limiteChars - total;
    if (restante <= 200) break;
    const trecho = corpo.slice(0, Math.min(restante, 4000));
    const meta = [r.tipo, r.ano ? String(r.ano) : "", r.autores ?? ""].filter(Boolean).join(", ");
    partes.push(`\n--- Referência: ${r.titulo}${meta ? ` (${meta})` : ""} ---\n${trecho}`);
    usadas.push({ id: r.id, titulo: r.titulo });
    total += trecho.length;
  }

  if (partes.length === 0) return { bloco: "", usadas: [] };
  return { bloco: partes.join("\n"), usadas };
}
