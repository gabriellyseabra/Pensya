const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiModel = "gemini-2.5-flash-lite" | "gemini-2.5-flash" | "gemini-2.5-pro";

interface GeminiFile {
  mimeType: string;
  base64: string;
}

interface CallGeminiParams {
  model: GeminiModel;
  systemPrompt: string;
  userPrompt: string;
  json?: boolean;
  file?: GeminiFile;
}

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini({ model, systemPrompt, userPrompt, json = true, file }: CallGeminiParams): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  const parts: Record<string, unknown>[] = [{ text: userPrompt }];
  if (file) parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ...(json ? { generationConfig: { response_mime_type: "application/json" } } : {}),
      }),
    });

    if (res.status === 401 || res.status === 403) throw new Error("Chave de IA inválida ou sem permissão. Verifique GEMINI_API_KEY.");

    if (RETRYABLE_STATUS.has(res.status)) {
      lastError =
        res.status === 429
          ? new Error("Limite de requisições da IA atingido. Tente novamente em instantes.")
          : new Error("O serviço de IA está sobrecarregado no momento. Tente novamente em alguns instantes.");
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2 ** attempt * 500); // 1s, 2s, 4s
        continue;
      }
      throw lastError;
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Falha IA: ${res.status} ${t.slice(0, 300)}`);
    }

    const responseJson: any = await res.json();
    const content = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    return content ?? (json ? "{}" : "");
  }

  throw lastError ?? new Error("Falha na IA após múltiplas tentativas.");
}

export async function callGeminiJSON<T = any>(params: Omit<CallGeminiParams, "json">): Promise<T> {
  const content = await callGemini({ ...params, json: true });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("Resposta da IA não é JSON válido");
  }
}
