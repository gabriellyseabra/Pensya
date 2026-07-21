import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";
import { ANAMNESE_SECOES } from "@/lib/anamnese-schema";
import { buscarReferenciasRelevantes } from "@/lib/referencias.functions";

/** Formata a anamnese estruturada (secoes_estruturadas) em texto legível usando os rótulos do schema. */
function formatarAnamnese(
  secoes: Record<string, Record<string, any>> | null | undefined,
  resumos: Record<string, string> | null | undefined,
): string | null {
  if (!secoes || Object.keys(secoes).length === 0) return null;
  const blocos = ANAMNESE_SECOES.map((sec) => {
    const dados = secoes[sec.key] ?? {};
    const linhas = sec.campos
      .map((c) => {
        const v = dados[c.key];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
        return `   – ${c.label}: ${Array.isArray(v) ? v.join(", ") : v}`;
      })
      .filter(Boolean);
    const resumo = resumos?.[sec.key];
    if (linhas.length === 0 && !resumo) return null;
    return `\n• ${sec.titulo}:\n${linhas.join("\n")}${resumo ? `\n   [obs] ${resumo}` : ""}`;
  }).filter(Boolean);
  return blocos.length ? blocos.join("\n") : null;
}

const SYSTEM_PROMPT = `Você é uma psicopedagoga clínica sênior. Faça o RACIOCÍNIO CLÍNICO que conecta perfil cognitivo, anamnese, queixa e contexto para chegar a hipóteses e prioridades de intervenção, no modelo CIF + metas funcionais.

REGRAS:
- Não invente escores. Use APENAS o que está nos dados fornecidos.
- Conecte os achados: ex. "déficit em memória operacional verbal explica a dificuldade relatada na escola para acompanhar enunciados longos".
- Linguagem clínica objetiva em português.
- Quando sugerir metas, devem ser FUNCIONAIS (mudança na vida real), não só desempenho em teste.
- Devolva SOMENTE JSON válido conforme schema.`;

const Input = z.object({ paciente_id: z.string().uuid() });

export const gerarRaciocinioClinico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: pac }, { data: pre }, { data: diags }, { data: avals }] = await Promise.all([
      supabase.from("pacientes").select("nome, data_nascimento, genero, queixa_principal, expectativas, observacoes, escolaridade, serie_curso").eq("id", data.paciente_id).maybeSingle(),
      supabase.from("paciente_pre_anamnese").select("secoes_estruturadas, resumos_secao, gestacao, parto, saude, contexto_familiar, tratamentos_anteriores").eq("paciente_id", data.paciente_id).maybeSingle(),
      supabase.from("paciente_diagnosticos").select("diagnostico:diagnosticos(nome)").eq("paciente_id", data.paciente_id),
      supabase.from("avaliacoes").select("id, titulo, data_inicio, data_fim, conclusao, hipoteses, status, testes_aplicados(escore_padrao, percentil, classificacao, observacoes_qualitativas, data_aplicacao, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome)))").eq("paciente_id", data.paciente_id).order("created_at", { ascending: false }),
    ]);

    if (!pac) throw new Error("Paciente não encontrado");

    const idade = pac.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;

    // Agregar perfil cognitivo por domínio
    const porDominio: Record<string, any[]> = {};
    for (const a of (avals ?? [])) {
      for (const t of ((a as any).testes_aplicados ?? [])) {
        const dom = t.teste?.dominio?.nome ?? "Sem domínio";
        (porDominio[dom] = porDominio[dom] ?? []).push({
          teste: t.teste?.nome,
          escore_padrao: t.escore_padrao,
          percentil: t.percentil,
          classificacao: t.classificacao,
          obs: t.observacoes_qualitativas,
        });
      }
    }

    const perfilTxt = Object.entries(porDominio).map(([d, ts]) =>
      `\n• ${d}:\n${ts.map(t => `   – ${t.teste}: ${t.classificacao ?? "—"}${t.percentil != null ? ` (P${t.percentil})` : ""}${t.escore_padrao != null ? ` EP=${t.escore_padrao}` : ""}${t.obs ? ` | obs: ${t.obs}` : ""}`).join("\n")}`
    ).join("\n") || "Nenhum teste aplicado registrado.";

    const anamneseTxt = formatarAnamnese((pre as any)?.secoes_estruturadas, (pre as any)?.resumos_secao);
    const preAnamneseTxt = anamneseTxt
      ?? (pre
        ? JSON.stringify({
            gestacao: (pre as any).gestacao,
            parto: (pre as any).parto,
            saude: (pre as any).saude,
            contexto_familiar: (pre as any).contexto_familiar,
            tratamentos_anteriores: (pre as any).tratamentos_anteriores,
          }, null, 2)
        : "—");

    // MÓDULO 3 — Referências da biblioteca relevantes (queixa + diagnósticos + domínios)
    const termosRef = [
      pac.queixa_principal ?? "",
      ...(diags ?? []).map((d: any) => d.diagnostico?.nome ?? ""),
      ...Object.keys(porDominio),
    ].filter(Boolean);
    const { bloco: refsBloco } = await buscarReferenciasRelevantes(supabase, termosRef);

    const userPrompt = `PACIENTE
Nome: ${pac.nome} | Idade: ${idade ?? "—"} | Gênero: ${pac.genero ?? "—"}
Escolaridade: ${pac.escolaridade ?? "—"} | Série: ${pac.serie_curso ?? "—"}
Queixa: ${pac.queixa_principal ?? "—"}
Expectativas: ${pac.expectativas ?? "—"}
Observações: ${pac.observacoes ?? "—"}
Diagnósticos: ${(diags ?? []).map((d: any) => d.diagnostico?.nome).filter(Boolean).join(", ") || "—"}

ANAMNESE
${preAnamneseTxt}

PERFIL COGNITIVO (agrupado por domínio)${perfilTxt}

AVALIAÇÕES (resumo das conclusões)
${(avals ?? []).map((a: any) => `- ${a.titulo} (${a.status}): ${a.conclusao || a.hipoteses || "—"}`).join("\n") || "—"}
${refsBloco ? `\nREFERÊNCIAS DA BIBLIOTECA (evidências para fundamentar o raciocínio)\n${refsBloco}\n` : ""}
Devolva JSON com este schema:
{
  "sintese_diagnostica": "1-2 parágrafos integrando perfil cognitivo + anamnese + queixa",
  "pontos_fortes": ["..."],
  "pontos_fragilidade": ["..."],
  "hipoteses_diagnosticas": [{ "hipotese": "nomeie o quadro quando os dados sugerirem (ex.: TEA, TDAH, Transtorno de Aprendizagem, TOD) — sempre como HIPÓTESE a investigar, nunca diagnóstico fechado", "justificativa": "quais achados da anamnese/perfil sustentam" }],
  "fatores_contextuais": { "facilitadores": ["..."], "barreiras": ["..."] },
  "prioridades_intervencao": [{ "ordem": 1, "area": "...", "racional": "por que essa área primeiro" }],
  "metas_sugeridas": [{ "titulo": "meta funcional SMART", "dominio": "...", "racional_clinico": "..." }],
  "encaminhamentos": ["..."],
  "alertas": ["lacuna importante ou risco"]
}`;

    return callGeminiJSON({ model: "gemini-2.5-pro", systemPrompt: SYSTEM_PROMPT, userPrompt });
  });

const CriarPlanoInput = z.object({
  paciente_id: z.string().uuid(),
  raciocinio: z.any(),
});

export const criarPlanoDeRaciocinio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CriarPlanoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const r = data.raciocinio ?? {};
    const { data: plano, error } = await supabase
      .from("planos_terapeuticos")
      .insert({
        paciente_id: data.paciente_id,
        titulo: "Plano a partir de raciocínio clínico",
        status: "rascunho",
        ciclo_semanas: 12,
        diagnostico_resumo: r.sintese_diagnostica ?? null,
        cif_pessoais: (r.pontos_fortes ?? []).join("; ") || null,
        cif_ambientais: [
          (r.fatores_contextuais?.facilitadores ?? []).map((f: string) => `+ ${f}`).join("; "),
          (r.fatores_contextuais?.barreiras ?? []).map((b: string) => `– ${b}`).join("; "),
        ].filter(Boolean).join(" | ") || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    const metas = (r.metas_sugeridas ?? []).slice(0, 8);
    if (metas.length) {
      await supabase.from("plano_metas").insert(metas.map((m: any, i: number) => ({
        plano_id: plano!.id,
        titulo_smart: m.titulo ?? `Meta ${i + 1}`,
        justificativa: m.racional_clinico ?? null,
        dominio: m.dominio ?? null,
        ordem: i + 1,
      })));
    }
    return { plano_id: plano!.id };
  });

