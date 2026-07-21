import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";

const VariavelSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  tipo: z.enum(["numero", "texto"]).default("numero"),
  unidade: z.string().optional().nullable(),
});

export type VariavelDef = z.infer<typeof VariavelSchema>;

/**
 * Mescla novas variáveis no catálogo do teste (memória global). Mantém as existentes,
 * apenas adicionando chaves novas. Atualiza label/unidade se vier preenchido.
 */
export const aprenderVariaveisTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      teste_id: z.string().uuid(),
      variaveis: z.array(VariavelSchema),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cat, error } = await supabase
      .from("testes_catalogo")
      .select("variaveis")
      .eq("id", data.teste_id)
      .maybeSingle();
    if (error) throw error;

    const existentes: VariavelDef[] = Array.isArray(cat?.variaveis) ? (cat!.variaveis as any) : [];
    const map = new Map<string, VariavelDef>();
    existentes.forEach((v) => { if (v?.key) map.set(v.key, v); });
    data.variaveis.forEach((v) => {
      const prev = map.get(v.key);
      map.set(v.key, {
        key: v.key,
        label: v.label || prev?.label || v.key,
        tipo: v.tipo || prev?.tipo || "numero",
        unidade: v.unidade ?? prev?.unidade ?? null,
      });
    });
    const merged = Array.from(map.values());
    const { error: upErr } = await supabase
      .from("testes_catalogo")
      .update({ variaveis: merged })
      .eq("id", data.teste_id);
    if (upErr) throw upErr;
    return { variaveis: merged };
  });

export const FORMULAS_AGREGACAO = [
  { value: "nenhuma",         label: "Sem agregação (mostrar variáveis isoladas)" },
  { value: "soma_brutos",     label: "Somar escores brutos" },
  { value: "media_padrao",    label: "Média dos escores-padrão" },
  { value: "media_percentil", label: "Média dos percentis" },
  { value: "min_percentil",   label: "Menor percentil (pior cenário)" },
  { value: "max_percentil",   label: "Maior percentil (melhor cenário)" },
] as const;

export type FormulaAgregacao = typeof FORMULAS_AGREGACAO[number]["value"];

export const salvarFormulaTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      teste_id: z.string().uuid(),
      formula: z.enum(["nenhuma","soma_brutos","media_padrao","media_percentil","min_percentil","max_percentil"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("testes_catalogo")
      .update({ formula_agregacao: data.formula })
      .eq("id", data.teste_id);
    if (error) throw error;
    return { ok: true };
  });

const ImpactoSchema = z.object({
  dim: z.enum(["funcoes_corporais", "estruturas_corporais", "atividade_participacao", "fatores_ambientais", "fatores_pessoais"]),
  tipo: z.enum(["forca", "fragilidade", "observacao"]),
  nota: z.string().optional(),
});

export const sugerirImpactosCIF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      teste_nome: z.string(),
      dominio: z.string().optional().nullable(),
      escore_bruto: z.union([z.number(), z.string()]).optional().nullable(),
      escore_padrao: z.union([z.number(), z.string()]).optional().nullable(),
      percentil: z.union([z.number(), z.string()]).optional().nullable(),
      classificacao: z.string().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      interpretacao: z.string().optional().nullable(),
      idade: z.string().optional().nullable(),
      queixa: z.string().optional().nullable(),
      variaveis: z.record(z.string(), z.any()).optional().nullable(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const system = `Você é uma psicopedagoga/neuropsicóloga experiente. A partir do resultado de um teste, sugira impactos na CIF (Classificação Internacional de Funcionalidade). Responda APENAS com JSON no formato:
{"impactos":[{"dim":"funcoes_corporais|estruturas_corporais|atividade_participacao|fatores_ambientais|fatores_pessoais","tipo":"forca|fragilidade|observacao","nota":"justificativa curta (máx 120 chars)"}]}
Regras:
- Máximo 4 sugestões, priorize as mais clinicamente relevantes.
- "forca" para resultados acima da média; "fragilidade" para abaixo; "observacao" quando ambíguo ou contextual.
- A "nota" deve referenciar o dado (ex: percentil, observação) que justifica.
- Não invente dados não fornecidos.`;

    const user = JSON.stringify(data);

    const parsed = await callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user });
    const arr = Array.isArray(parsed?.impactos) ? parsed.impactos : [];
    const safe = arr
      .map((i: any) => {
        const r = ImpactoSchema.safeParse(i);
        return r.success ? r.data : null;
      })
      .filter(Boolean);
    return { impactos: safe };
  });
