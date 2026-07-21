import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGeminiJSON } from "@/lib/gemini-client";
import { buscarReferenciasRelevantes } from "@/lib/referencias.functions";

// ETAPA 9 — A sessão não responde "o que aconteceu", e sim "como esta sessão
// aproxima a criança de suas metas funcionais". A IA responde internamente às
// 6 perguntas clínicas por meta trabalhada e registra EVIDÊNCIAS clínicas.
const SYSTEM_PROMPT = `Você é uma psicopedagoga clínica sênior atuando como copiloto de raciocínio. A partir da transcrição de uma sessão e do plano do paciente, produza um registro clínico que NUNCA descreva apenas atividades — registre EVIDÊNCIAS CLÍNICAS e conecte a sessão às metas funcionais.

PRINCÍPIO CENTRAL: não responda "o que aconteceu na sessão". Responda "como esta sessão aproxima a criança de suas metas".

TAREFA: entre as METAS TRABALHADAS NESTA SESSÃO listadas no contexto, identifique quais foram efetivamente abordadas segundo a transcrição e produza "metas_analise" APENAS para essas. Para cada uma, preencha diretamente:
1. Quais componentes clínicos foram abordados? (subconjunto dos componentes do Mapa da Meta fornecidos; não invente)
2. Quais evidências clínicas surgiram? (comportamentos observáveis, não atividades)
3. Houve progresso? (regressao | sem_mudanca | parcial | sim)
4. Nível GAS observado (-2..+2) segundo a escada da meta.
5. Engajamento na meta (1-5) e nível de suporte necessário.
6. O planejamento precisa ser ajustado? (descreva; null se manter)
7. Observação clínica adicional da meta (se houver).

REGRAS:
- Não invente fatos. Use APENAS a transcrição. Se uma meta listada não foi trabalhada, não a inclua.
- NUNCA escreva identificadores técnicos (ex.: "ID 8820...-...", códigos ou UUIDs) em NENHUM texto (sintese, resumo, evidências, observações). Refira-se às metas pelo nome/descrição. O "id" fornecido serve EXCLUSIVAMENTE para preencher o campo meta_id do JSON.
- "componentes_trabalhados" deve ser um subconjunto dos componentes listados para aquela meta (quando existirem).
- "nivel_suporte" ∈ (independente, verbal, gestual, fisico_parcial, fisico_total).
- Linguagem clínica, terceira pessoa, sem juízo de valor.
- A síntese geral deve, em 1-2 parágrafos, ligar as observações às metas e às evidências.
- Devolva SOMENTE JSON válido conforme schema.`;

const MetaInput = z.object({
  meta_id: z.string().uuid(),
  titulo: z.string().max(300),
});

const Input = z.object({
  paciente_id: z.string().uuid(),
  transcricao: z.string().min(20, "Transcrição muito curta").max(20000),
  // metas trabalhadas nesta sessão (id da meta_terapeutica + título)
  metas: z.array(MetaInput).max(20).optional(),
});

export const sintetizarSessao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, queixa_principal, escolaridade, serie_curso")
      .eq("id", data.paciente_id)
      .maybeSingle();

    // Metas ativas (legado) — mantém a listagem de contexto
    const { data: metas } = await supabase
      .from("metas_terapeuticas")
      .select("id, titulo, dominio_cognitivo, status")
      .eq("paciente_id", data.paciente_id)
      .in("status", ["ativa", "planejamento"]);

    // Mapa da Meta: componentes clínicos + escada GAS por plano_meta,
    // indexados pela meta_terapeutica correspondente (ponte plano_metas.meta_terapeutica_id).
    const { data: planos } = await supabase
      .from("planos_terapeuticos")
      .select("id")
      .eq("paciente_id", data.paciente_id);
    const planoIds = (planos ?? []).map((p: any) => p.id);

    const mapaPorMetaTerapeutica = new Map<string, { componentes: string[]; gas: { nivel: number; descricao: string }[]; restricao: string | null }>();
    if (planoIds.length) {
      const { data: planoMetas } = await supabase
        .from("plano_metas")
        .select("meta_terapeutica_id, restricao_funcional, plano_meta_componentes(nome, ordem), plano_gas(nivel, descricao)")
        .in("plano_id", planoIds);
      for (const pm of (planoMetas ?? [])) {
        if (!(pm as any).meta_terapeutica_id) continue;
        mapaPorMetaTerapeutica.set((pm as any).meta_terapeutica_id, {
          componentes: [...((pm as any).plano_meta_componentes ?? [])].sort((a: any, b: any) => a.ordem - b.ordem).map((c: any) => c.nome),
          gas: (pm as any).plano_gas ?? [],
          restricao: (pm as any).restricao_funcional ?? null,
        });
      }
    }

    const idade = pac?.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / 31557600000)
      : null;

    const metasTrabalhadas = data.metas ?? [];
    const metasTrabalhadasTxt = metasTrabalhadas.length
      ? metasTrabalhadas.map((m) => {
          const mapa = mapaPorMetaTerapeutica.get(m.meta_id);
          const comps = mapa?.componentes?.length ? `\n    componentes do Mapa da Meta: ${mapa.componentes.join(", ")}` : "";
          const restr = mapa?.restricao ? `\n    restrição funcional: ${mapa.restricao}` : "";
          const gas = mapa?.gas?.length
            ? `\n    escada GAS: ${[...mapa.gas].sort((a, b) => a.nivel - b.nivel).map((g) => `${g.nivel >= 0 ? "+" : ""}${g.nivel}=${g.descricao}`).join(" | ")}`
            : "";
          return `- (id:${m.meta_id}) ${m.titulo}${restr}${comps}${gas}`;
        }).join("\n")
      : "Nenhuma meta marcada para esta sessão.";

    // MÓDULO 3 — Referências da biblioteca relevantes (metas trabalhadas + domínios + queixa)
    const termosRef = [
      pac?.queixa_principal ?? "",
      ...metasTrabalhadas.map((m) => m.titulo),
      ...(metas ?? []).map((m: any) => m.dominio_cognitivo ?? ""),
    ].filter(Boolean);
    const { bloco: refsBloco } = await buscarReferenciasRelevantes(supabase, termosRef);

    const userPrompt = `PACIENTE
Nome: ${pac?.nome ?? "—"} | Idade: ${idade ?? "—"}
Escolaridade: ${pac?.escolaridade ?? "—"} ${pac?.serie_curso ?? ""}
Queixa: ${pac?.queixa_principal ?? "—"}

METAS ATIVAS
${(metas ?? []).map((m: any) => `- ${m.titulo}${m.dominio_cognitivo ? ` (${m.dominio_cognitivo})` : ""}`).join("\n") || "—"}

METAS TRABALHADAS NESTA SESSÃO (com Mapa da Meta)
${metasTrabalhadasTxt}
${refsBloco ? `\nREFERÊNCIAS DA BIBLIOTECA (evidências para fundamentar a leitura clínica)\n${refsBloco}\n` : ""}
TRANSCRIÇÃO DA SESSÃO
"""
${data.transcricao}
"""

Devolva JSON com este schema EXATO:
{
  "sintese": "texto clínico ligando a sessão às metas e evidências (1-2 parágrafos)",
  "resumo": "1-2 frases sintéticas para listagem",
  "engajamento_sugerido": 1-5,
  "autorregulacao_sugerida": 1-5,
  "nivel_suporte_sugerido": "independente|verbal|gestual|fisico_parcial|fisico_total",
  "recursos_detectados": ["..."],
  "habilidades_trabalhadas": [{ "habilidade": "...", "sub_habilidade": "..." }],
  "orientacao_casa_sugerida": "texto ou null",
  "metas_analise": [
    {
      "meta_id": "id da meta trabalhada (use o id fornecido)",
      "componentes_trabalhados": ["subconjunto dos componentes do Mapa da Meta"],
      "evidencias_clinicas": "evidências observáveis que surgiram (não atividades)",
      "houve_progresso": "regressao|sem_mudanca|parcial|sim",
      "nivel_gas_sugerido": -2 a 2 ou null,
      "engajamento": 1 a 5 ou null,
      "nivel_suporte": "independente|verbal|gestual|fisico_parcial|fisico_total ou null",
      "ajuste_plano": "ajuste sugerido no planejamento ou null",
      "observacoes_meta": "observação clínica adicional da meta ou null"
    }
  ]
}`;

    return callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: SYSTEM_PROMPT, userPrompt });
  });
