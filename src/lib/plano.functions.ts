import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini, callGeminiJSON } from "@/lib/gemini-client";
import { ANAMNESE_SECOES } from "@/lib/anamnese-schema";
import { buscarReferenciasRelevantes } from "@/lib/referencias.functions";

// ============= PubMed / Europe PMC =============
const PubMedInput = z.object({
  query: z.string().min(2).max(300),
  max: z.number().int().min(1).max(15).default(5),
});

export const buscarPubMed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PubMedInput.parse(d))
  .handler(async ({ data }) => {
    // Europe PMC — sem API key, retorna json com abstracts
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
      data.query,
    )}&format=json&pageSize=${data.max}&resultType=core`;
    const res = await fetch(url);
    if (!res.ok) return { artigos: [], error: `PubMed ${res.status}` };
    const json: any = await res.json();
    const artigos = (json?.resultList?.result ?? []).map((r: any) => ({
      pmid: r.pmid ?? r.id ?? null,
      titulo: r.title ?? "",
      autores: r.authorString ?? "",
      ano: r.pubYear ? parseInt(r.pubYear, 10) : null,
      journal: r.journalTitle ?? r.journalInfo?.journal?.title ?? "",
      url: r.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`
        : r.doi
          ? `https://doi.org/${r.doi}`
          : r.fullTextUrlList?.fullTextUrl?.[0]?.url ?? "",
      resumo: r.abstractText ?? "",
    }));
    return { artigos, error: null };
  });

// ============= IA: Gerar plano completo (cadeia de raciocínio clínico) =============
const GerarPlanoInput = z.object({
  plano_id: z.string().uuid(),
  contexto_extra: z.string().max(50000).optional(),
});

// Copiloto clínico: nunca gera metas direto — antes constrói a FORMULAÇÃO do caso (CIF),
// raciocina, prioriza, define objetivos funcionais e só então metas com Mapa da Meta.
const SYSTEM_PROMPT = `Você é uma psicopedagoga clínica sênior atuando como COPILOTO de raciocínio clínico. Reproduza o raciocínio de um supervisor experiente, na estrutura CIF, metas funcionais e escala GAS (Goal Attainment Scaling).

PRINCÍPIO CENTRAL: não responda "o que aconteceu"; responda "como aproximar a criança de suas metas funcionais". Toda meta só é válida se serve à PARTICIPAÇÃO real (ex.: "ler o enunciado das provas com autonomia" — funcional; "aumentar memória de trabalho" — NÃO é meta, é função que sustenta a meta).

FLUXO OBRIGATÓRIO — NUNCA gere metas sem antes construir a formulação:
1. INTEGRE as fontes fornecidas (anamnese, avaliação, testes, diagnósticos, perfil vivo, observações, relatórios). Nunca use uma fonte isolada. Liste em fontes_utilizadas os TIPOS de fonte que efetivamente embasaram sua análise.
2. FORMULAÇÃO CLÍNICA (CIF):
   - restricoes: restrições de participação (atividades da vida real prejudicadas: copiar do quadro, produzir textos, fazer provas...). Cada uma com impacto (leve|moderado|grave) e escores 1-5 de impacto_funcional, urgencia, potencial_mudanca, frequencia.
   - limitacoes: limitações de atividade (leitura, escrita, cálculo, organização...). impacto (leve|moderado|grave).
   - funcoes: funções que provavelmente sustentam as dificuldades (atenção, memória de trabalho, funções executivas, processamento fonológico...). São HIPÓTESES explicativas, NÃO metas. Cada uma com confianca (alta|media|baixa).
   - ambientais: fatores ambientais (adaptações escolares, apoio familiar, rotina...).
   - pessoais: fatores pessoais (motivação, autorregulação, autoestima, interesses...).
3. SÍNTESE do raciocínio: explique quais fatores parecem causar as dificuldades, quais hipóteses têm mais evidência, quais são secundárias, e quais informações ainda são insuficientes. Explique o raciocínio — não apenas liste.
4. PRIORIZAÇÃO: ordene as dificuldades por impacto funcional, urgência, potencial de mudança e frequência.
5. OBJETIVOS: POUCOS objetivos (2-4). Cada objetivo = um DOMÍNIO FUNCIONAL (ex.: "Ampliar a autonomia na produção escrita escolar"). Jamais "melhorar atenção/memória".
6. METAS FUNCIONAIS: cada meta pertence a um objetivo (objetivo_ref = índice 0-based do objetivo). Comportamento observável no cotidiano, ligado à participação, na lógica GAS. Cada meta traz o MAPA DA META:
   - restricao_funcional: qual problema pretende resolver.
   - componentes: componentes clínicos envolvidos (planejamento, ortografia, monitoramento, memória de trabalho, linguagem...). NÃO são metas — sustentam a meta.
   - fontes: quais informações originaram a meta — cada uma { tipo, referencia }. tipo ∈ (anamnese, entrevista_familiar, avaliacao, teste, protocolo, observacao, sessao_avaliacao, reuniao_escolar, relatorio_escolar, relatorio_medico, arquivo, complementar).
   - grau_confianca (alta|media|baixa) e confianca_justificativa (obrigatória quando baixa).
   - gas: 5 níveis observáveis e distinguíveis (-2 regressão, -1 insuficiente, 0 meta literal, +1 acima, +2 generalização).
   - PLANO POR META: estrategias (nome, justificativa, como_aplicar, referencia), recursos, ordem_progressao (int), prazo_semanas (tempo estimado), criterios_progressao, criterios_alta.

REGRAS: nunca invente dados clínicos — use apenas o contexto. Nunca use funções cognitivas como metas (exceto se explicitamente o foco principal). Sempre justifique decisões e mostre as evidências.

Responda SOMENTE com JSON válido no schema:
{
  "queixa_principal": "string",
  "objetivo_participacao": "string (o que muda na vida real ao fim do ciclo)",
  "fontes_utilizadas": ["anamnese", "avaliacao", "teste", ...],
  "formulacao": {
    "restricoes": [{ "descricao": "string", "impacto": "leve|moderado|grave", "impacto_funcional": 1, "urgencia": 1, "potencial_mudanca": 1, "frequencia": 1 }],
    "limitacoes": [{ "descricao": "string", "impacto": "leve|moderado|grave" }],
    "funcoes": [{ "descricao": "string", "confianca": "alta|media|baixa" }],
    "ambientais": [{ "descricao": "string" }],
    "pessoais": [{ "descricao": "string" }]
  },
  "sintese_raciocinio": "string (1-2 parágrafos de raciocínio clínico)",
  "priorizacao": [{ "ordem": 1, "area": "string", "racional": "string" }],
  "objetivos": [{ "titulo": "string", "dominio_funcional": "string", "descricao": "string" }],
  "metas": [
    {
      "objetivo_ref": 0,
      "dominio": "string",
      "titulo_smart": "string",
      "baseline": "string",
      "restricao_funcional": "string",
      "componentes": ["planejamento", "ortografia"],
      "fontes": [{ "tipo": "relatorio_escolar", "referencia": "string" }],
      "grau_confianca": "alta|media|baixa",
      "confianca_justificativa": "string ou null",
      "prazo_semanas": 12,
      "ordem_progressao": 1,
      "criterios_progressao": "string",
      "criterios_alta": "string",
      "recursos": "string",
      "justificativa": "string",
      "gas": { "n2": "string", "n1": "string", "zero": "string", "p1": "string", "p2": "string" },
      "estrategias": [{ "nome": "string", "justificativa": "string", "como_aplicar": "string", "referencia": "string" }]
    }
  ],
  "orientacoes_familia": "string",
  "orientacoes_escola": "string",
  "parceiros_clinicos": "string"
}`;

function formatarPerfilVivo(pv: any): string {
  const arr = (v: any) => (Array.isArray(v) && v.length ? v.map((x: any) => typeof x === "string" ? x : (x?.titulo ?? x?.descricao ?? JSON.stringify(x))).filter(Boolean).join("; ") : "—");
  return `
Perfil Clínico Vivo:
- Preferências: ${arr(pv.preferencias)}
- Potencializadores: ${arr(pv.potencializadores)}
- Reforçadores: ${arr(pv.reforcadores)}
- Barreiras: ${arr(pv.barreiras)}
- Estratégias que funcionam: ${arr(pv.estrategias)}
- Hipóteses ativas: ${arr(pv.hipoteses_ativas)}
- Objetivos de generalização: ${arr(pv.objetivos_generalizacao)}
- Contexto clínico: ${pv.contexto_clinico ?? "—"}
- Contexto escolar: ${pv.contexto_escolar ?? "—"}
- Contexto social: ${pv.contexto_social ?? "—"}`;
}

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

/**
 * ETAPA 1 — Integração das fontes.
 * Consolida TODAS as fontes disponíveis do paciente (anamnese, avaliações, testes,
 * diagnósticos, perfil vivo, observações) num único cabeçalho de contexto e devolve
 * a lista de tipos de fonte efetivamente disponíveis.
 */
async function buscarContextoPaciente(supabase: any, planoId: string) {
  const { data: plano } = await supabase
    .from("planos_terapeuticos")
    .select("*, paciente:pacientes(id, nome, data_nascimento, queixa_principal, hipotese_diagnostica, observacoes, escolaridade, serie_curso, expectativas, perfil_vivo)")
    .eq("id", planoId)
    .single();
  if (!plano) throw new Error("Plano não encontrado");

  const pacienteId = plano.paciente_id;

  const [{ data: avaliacoes }, { data: pre }, { data: diags }, { data: docsFonte }] = await Promise.all([
    supabase
      .from("avaliacoes")
      .select("id, titulo, status, conclusao, hipoteses, data_inicio, testes:testes_aplicados(*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome)))")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("paciente_pre_anamnese")
      .select("secoes_estruturadas, resumos_secao, gestacao, parto, saude, contexto_familiar, tratamentos_anteriores")
      .eq("paciente_id", pacienteId)
      .maybeSingle(),
    supabase
      .from("paciente_diagnosticos")
      .select("diagnostico:diagnosticos(nome)")
      .eq("paciente_id", pacienteId),
    // ETAPA 1 (Fase 1.5) — documentos anexados marcados como fonte, com texto já extraído
    supabase
      .from("paciente_documentos")
      .select("titulo, fonte_tipo, texto_extraido")
      .eq("paciente_id", pacienteId)
      .eq("usar_como_fonte", true)
      .not("texto_extraido", "is", null),
  ]);

  const idade = plano.paciente?.data_nascimento
    ? Math.floor((Date.now() - new Date(plano.paciente.data_nascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  const testesResumo = (avaliacoes ?? []).flatMap((a: any) =>
    (a.testes ?? []).map((t: any) =>
      `- ${t.teste?.nome ?? "Teste"} (${t.teste?.dominio?.nome ?? "—"}): bruto=${t.escore_bruto ?? "—"}, percentil=${t.percentil ?? "—"}, classificação=${t.classificacao ?? "—"}${t.observacoes ? " | " + t.observacoes : ""}`,
    ),
  ).join("\n");

  const anamneseTxt = formatarAnamnese((pre as any)?.secoes_estruturadas, (pre as any)?.resumos_secao)
    ?? (pre
      ? JSON.stringify({
          gestacao: (pre as any).gestacao,
          parto: (pre as any).parto,
          saude: (pre as any).saude,
          contexto_familiar: (pre as any).contexto_familiar,
          tratamentos_anteriores: (pre as any).tratamentos_anteriores,
        }, null, 2)
      : null);

  const diagnosticosTxt = (diags ?? []).map((d: any) => d.diagnostico?.nome).filter(Boolean).join(", ");
  const avaliacoesTxt = (avaliacoes ?? [])
    .map((a: any) => `- ${a.titulo} (${a.status}): ${a.conclusao || a.hipoteses || "—"}`)
    .join("\n");

  // Documentos-fonte (relatórios/registros anexados) — Fase 1.5
  const DOC_FONTE_TO_VOCAB: Record<string, string> = {
    relatorio_avaliacao: "avaliacao",
    relatorio_evolucao: "observacao",
    registro_sessoes: "sessao_avaliacao",
    relatorio_medico: "relatorio_medico",
    relatorio_escolar: "relatorio_escolar",
    anamnese: "anamnese",
    outro: "arquivo",
  };
  const docsTxt = (docsFonte ?? [])
    .map((d: any) => `\n--- Documento: ${d.titulo}${d.fonte_tipo ? ` (${d.fonte_tipo})` : ""} ---\n${(d.texto_extraido ?? "").slice(0, 12000)}`)
    .join("\n");

  // Tipos de fonte efetivamente disponíveis (ETAPA 1)
  const fontesDisponiveis: string[] = [];
  if (anamneseTxt) fontesDisponiveis.push("anamnese");
  if (testesResumo) fontesDisponiveis.push("teste");
  if (avaliacoesTxt) fontesDisponiveis.push("avaliacao");
  if (diagnosticosTxt) fontesDisponiveis.push("relatorio_medico");
  if (plano.paciente?.perfil_vivo && Object.keys(plano.paciente.perfil_vivo).length) fontesDisponiveis.push("observacao");
  for (const d of (docsFonte ?? [])) {
    const vocab = DOC_FONTE_TO_VOCAB[(d as any).fonte_tipo] ?? "arquivo";
    if (!fontesDisponiveis.includes(vocab)) fontesDisponiveis.push(vocab);
  }

  // MÓDULO 3 — Referências da biblioteca relevantes ao caso (tags/domínio + fixadas)
  const termosRef = [
    plano.queixa_principal || plano.paciente?.queixa_principal || "",
    plano.diagnostico_resumo || plano.paciente?.hipotese_diagnostica || "",
    diagnosticosTxt,
    ...(avaliacoes ?? []).flatMap((a: any) => (a.testes ?? []).map((t: any) => t.teste?.dominio?.nome ?? "")),
  ].filter(Boolean);
  const { bloco: refsBloco } = await buscarReferenciasRelevantes(supabase, termosRef);

  const cabecalho = `Paciente: ${plano.paciente?.nome ?? "—"} | Idade: ${idade ?? "—"} anos | Escolaridade: ${plano.paciente?.escolaridade ?? "—"} ${plano.paciente?.serie_curso ?? ""}

Queixa principal: ${plano.queixa_principal || plano.paciente?.queixa_principal || "—"}
Expectativas da família: ${plano.paciente?.expectativas || "—"}
Hipótese diagnóstica: ${plano.diagnostico_resumo || plano.paciente?.hipotese_diagnostica || "—"}
Diagnósticos registrados: ${diagnosticosTxt || "—"}
Medicação: ${plano.medicacao || "—"}
Frequência de sessões: ${plano.frequencia_sessoes || "—"}
Ciclo do plano: ${plano.ciclo_semanas} semanas

Observações clínicas: ${plano.paciente?.observacoes || "—"}
${formatarPerfilVivo(plano.paciente?.perfil_vivo ?? {})}

ANAMNESE
${anamneseTxt || "Sem anamnese estruturada registrada."}

AVALIAÇÕES (conclusões)
${avaliacoesTxt || "Nenhuma avaliação registrada."}

RESULTADOS DE TESTES
${testesResumo || "Nenhum teste registrado."}

DOCUMENTOS-FONTE ANEXADOS (relatórios/registros externos)
${docsTxt || "Nenhum documento-fonte anexado."}

REFERÊNCIAS DA BIBLIOTECA (evidências para fundamentar as decisões)
${refsBloco || "Nenhuma referência aplicável cadastrada."}`;

  return { plano, cabecalho, fontesDisponiveis };
}

const FONTE_TIPOS = new Set([
  "anamnese", "entrevista_familiar", "avaliacao", "teste", "protocolo", "observacao",
  "sessao_avaliacao", "reuniao_escolar", "relatorio_escolar", "relatorio_medico",
  "arquivo", "complementar",
]);

/**
 * Persiste uma lista de metas geradas pela IA + o Mapa da Meta (componentes, fontes),
 * escada GAS e estratégias. Resolve o objetivo pela posição (objetivo_ref) via mapa.
 */
async function inserirMetasGeradas(
  supabase: any,
  planoId: string,
  metas: any[],
  ordemInicial: number,
  cicloSemanas: number,
  objetivoIdByRef: Map<number, string> = new Map(),
) {
  let inseridas = 0;
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const objetivoId = typeof m.objetivo_ref === "number" ? objetivoIdByRef.get(m.objetivo_ref) ?? null : null;
    const { data: novaMeta, error: metaErr } = await supabase
      .from("plano_metas")
      .insert({
        plano_id: planoId,
        objetivo_id: objetivoId,
        ordem: ordemInicial + i,
        ordem_progressao: m.ordem_progressao ?? ordemInicial + i + 1,
        dominio: m.dominio ?? null,
        titulo_smart: m.titulo_smart ?? "Meta sem título",
        baseline: m.baseline ?? null,
        restricao_funcional: m.restricao_funcional ?? null,
        grau_confianca: ["alta", "media", "baixa"].includes(m.grau_confianca) ? m.grau_confianca : null,
        confianca_justificativa: m.confianca_justificativa ?? null,
        prazo_semanas: m.prazo_semanas ?? cicloSemanas,
        criterios_progressao: m.criterios_progressao ?? null,
        criterios_alta: m.criterios_alta ?? null,
        recursos: m.recursos ?? null,
        justificativa: m.justificativa ?? null,
      })
      .select("id")
      .single();
    if (metaErr || !novaMeta) continue;
    inseridas++;

    // Escada GAS
    const gasRows = [
      { nivel: -2, descricao: m.gas?.n2 ?? "" },
      { nivel: -1, descricao: m.gas?.n1 ?? "" },
      { nivel: 0, descricao: m.gas?.zero ?? m.titulo_smart ?? "" },
      { nivel: 1, descricao: m.gas?.p1 ?? "" },
      { nivel: 2, descricao: m.gas?.p2 ?? "" },
    ].filter((r) => r.descricao);
    if (gasRows.length) {
      await supabase.from("plano_gas").insert(gasRows.map((r) => ({ meta_id: novaMeta.id, ...r })));
    }

    // Mapa da Meta — componentes clínicos
    const comps = Array.isArray(m.componentes) ? m.componentes : [];
    if (comps.length) {
      await supabase.from("plano_meta_componentes").insert(
        comps.map((c: any, j: number) => ({
          meta_id: novaMeta.id,
          ordem: j,
          nome: typeof c === "string" ? c : (c?.nome ?? String(c)),
          tipo: typeof c === "object" ? c?.tipo ?? null : null,
        })).filter((c: any) => c.nome),
      );
    }

    // Mapa da Meta — fontes/evidências que originaram a meta
    const fontes = Array.isArray(m.fontes) ? m.fontes : [];
    if (fontes.length) {
      const rows = fontes
        .map((f: any, j: number) => ({
          meta_id: novaMeta.id,
          ordem: j,
          tipo: FONTE_TIPOS.has(f?.tipo) ? f.tipo : "complementar",
          referencia: typeof f === "string" ? f : (f?.referencia ?? null),
          detalhe: f?.detalhe ?? null,
        }));
      if (rows.length) await supabase.from("plano_meta_fontes").insert(rows);
    }

    // Estratégias de intervenção
    const ests = Array.isArray(m.estrategias) ? m.estrategias : [];
    if (ests.length) {
      await supabase.from("plano_estrategias").insert(
        ests.map((e: any, j: number) => ({
          meta_id: novaMeta.id,
          ordem: j,
          nome: e.nome ?? "Estratégia",
          justificativa: e.justificativa ?? null,
          como_aplicar: e.como_aplicar ?? null,
          referencia: e.referencia ?? null,
        })),
      );
    }
  }
  return inseridas;
}

/** ETAPA 2/4 — persiste os itens da formulação clínica com prioridade calculada. */
async function inserirFormulacao(supabase: any, planoId: string, formulacao: any) {
  if (!formulacao) return;
  const impactoValido = (v: any) => (["leve", "moderado", "grave"].includes(v) ? v : null);
  const confiancaValida = (v: any) => (["alta", "media", "baixa"].includes(v) ? v : null);
  const score = (v: any) => (typeof v === "number" && v >= 1 && v <= 5 ? v : null);

  type Row = Record<string, any>;
  const rows: Row[] = [];

  const restricoes = Array.isArray(formulacao.restricoes) ? formulacao.restricoes : [];
  // Priorização (ETAPA 4): ordena restrições pela soma dos 4 escores.
  const comScore = restricoes.map((r: any, i: number) => ({
    r, i,
    soma: (score(r.impacto_funcional) ?? 0) + (score(r.urgencia) ?? 0) + (score(r.potencial_mudanca) ?? 0) + (score(r.frequencia) ?? 0),
  }));
  const ordenadas = [...comScore].sort((a, b) => b.soma - a.soma);
  const prioridadePorIndice = new Map<number, number>();
  ordenadas.forEach((x, rank) => prioridadePorIndice.set(x.i, rank + 1));

  restricoes.forEach((r: any, i: number) => {
    if (!r?.descricao) return;
    rows.push({
      plano_id: planoId, categoria: "restricao_participacao", descricao: r.descricao, ordem: i,
      impacto: impactoValido(r.impacto),
      impacto_funcional: score(r.impacto_funcional), urgencia: score(r.urgencia),
      potencial_mudanca: score(r.potencial_mudanca), frequencia: score(r.frequencia),
      prioridade: prioridadePorIndice.get(i) ?? null,
    });
  });
  (Array.isArray(formulacao.limitacoes) ? formulacao.limitacoes : []).forEach((r: any, i: number) => {
    if (!r?.descricao) return;
    rows.push({ plano_id: planoId, categoria: "limitacao_atividade", descricao: r.descricao, ordem: i, impacto: impactoValido(r.impacto) });
  });
  (Array.isArray(formulacao.funcoes) ? formulacao.funcoes : []).forEach((r: any, i: number) => {
    if (!r?.descricao) return;
    rows.push({ plano_id: planoId, categoria: "funcao_relacionada", descricao: r.descricao, ordem: i, confianca: confiancaValida(r.confianca) });
  });
  (Array.isArray(formulacao.ambientais) ? formulacao.ambientais : []).forEach((r: any, i: number) => {
    const desc = typeof r === "string" ? r : r?.descricao;
    if (!desc) return;
    rows.push({ plano_id: planoId, categoria: "fator_ambiental", descricao: desc, ordem: i });
  });
  (Array.isArray(formulacao.pessoais) ? formulacao.pessoais : []).forEach((r: any, i: number) => {
    const desc = typeof r === "string" ? r : r?.descricao;
    if (!desc) return;
    rows.push({ plano_id: planoId, categoria: "fator_pessoal", descricao: desc, ordem: i });
  });

  if (rows.length) await supabase.from("plano_formulacao_itens").insert(rows);
}

export const gerarPlanoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarPlanoInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { plano, cabecalho, fontesDisponiveis } = await buscarContextoPaciente(supabase, data.plano_id);

    const userPrompt = `${cabecalho}

FONTES DISPONÍVEIS (tipos): ${fontesDisponiveis.join(", ") || "poucas fontes — sinalize baixa confiança"}
${data.contexto_extra ? `\nContexto adicional fornecido pela profissional:\n${data.contexto_extra}` : ""}

Construa a formulação clínica, o raciocínio, a priorização, os objetivos e as metas com Mapa da Meta, em JSON conforme o schema.`;

    const parsed = await callGeminiJSON({ model: "gemini-2.5-pro", systemPrompt: SYSTEM_PROMPT, userPrompt });

    // Síntese do raciocínio + priorização + fontes usadas → raciocinio_clinico (jsonb)
    const raciocinio = {
      sintese: parsed.sintese_raciocinio ?? null,
      priorizacao: Array.isArray(parsed.priorizacao) ? parsed.priorizacao : [],
      fontes_utilizadas: Array.isArray(parsed.fontes_utilizadas) ? parsed.fontes_utilizadas : fontesDisponiveis,
      gerado_em: new Date().toISOString(),
    };

    await supabase.from("planos_terapeuticos").update({
      queixa_principal: parsed.queixa_principal ?? plano.queixa_principal,
      objetivo_participacao: parsed.objetivo_participacao ?? null,
      orientacoes_familia: parsed.orientacoes_familia ?? null,
      orientacoes_escola: parsed.orientacoes_escola ?? null,
      parceiros_clinicos: parsed.parceiros_clinicos ?? null,
      raciocinio_clinico: raciocinio,
      ai_gerado_em: new Date().toISOString(),
      ai_modelo: "gemini-2.5-pro",
    }).eq("id", data.plano_id);

    // Substituir formulação e objetivos gerados por IA (regeneração completa)
    await supabase.from("plano_formulacao_itens").delete().eq("plano_id", data.plano_id);
    await inserirFormulacao(supabase, data.plano_id, parsed.formulacao);

    // Objetivos — mapa índice → id
    const objetivoIdByRef = new Map<number, string>();
    const objetivos = Array.isArray(parsed.objetivos) ? parsed.objetivos : [];
    // Só removemos objetivos sem meta revisada associada (segurança).
    await supabase.from("plano_objetivos").delete().eq("plano_id", data.plano_id).eq("origem", "ia");
    for (let i = 0; i < objetivos.length; i++) {
      const o = objetivos[i];
      const { data: novoObj } = await supabase
        .from("plano_objetivos")
        .insert({
          plano_id: data.plano_id,
          ordem: i,
          titulo: o.titulo ?? `Objetivo ${i + 1}`,
          dominio_funcional: o.dominio_funcional ?? null,
          descricao: o.descricao ?? null,
        })
        .select("id")
        .single();
      if (novoObj) objetivoIdByRef.set(i, novoObj.id);
    }

    // Limpar metas anteriores geradas por IA (preserva as já revisadas com nível GAS atingido)
    await supabase.from("plano_metas").delete().eq("plano_id", data.plano_id).is("nivel_gas_atingido", null);

    const metas = Array.isArray(parsed.metas) ? parsed.metas : [];
    const inseridas = await inserirMetasGeradas(supabase, data.plano_id, metas, 0, plano.ciclo_semanas, objetivoIdByRef);

    return { ok: true, metas_geradas: inseridas, objetivos_gerados: objetivoIdByRef.size };
  });

// ============= IA: Adicionar novas metas (sem apagar as existentes) =============
const AdicionarMetasInput = z.object({
  plano_id: z.string().uuid(),
  dominios_foco: z.array(z.string().min(1)).min(1).max(30),
  contexto_extra: z.string().max(50000).optional(),
});

const SYSTEM_PROMPT_NOVAS_METAS = `Você é uma psicopedagoga clínica sênior atuando como copiloto de raciocínio clínico (CIF + metas funcionais + GAS).

PRINCÍPIO: toda meta serve à PARTICIPAÇÃO real. Funções cognitivas (atenção, memória de trabalho...) NÃO são metas — são componentes que sustentam a meta.

TAREFA: o paciente já tem um plano em andamento (metas listadas no contexto). Proponha APENAS metas NOVAS e COMPLEMENTARES, nos domínios indicados, sem duplicar o existente.

REGRAS:
1. Gere de 1 a 3 metas novas.
2. Cada meta SMART + funcional, com Mapa da Meta completo.
3. Escala GAS com 5 níveis observáveis (-2 a +2).
4. NÃO invente dados. Use apenas o contexto.

Responda SOMENTE com JSON válido:
{
  "metas": [
    {
      "dominio": "string",
      "titulo_smart": "string",
      "baseline": "string",
      "restricao_funcional": "string",
      "componentes": ["..."],
      "fontes": [{ "tipo": "avaliacao", "referencia": "string" }],
      "grau_confianca": "alta|media|baixa",
      "confianca_justificativa": "string ou null",
      "prazo_semanas": 12,
      "ordem_progressao": 1,
      "criterios_progressao": "string",
      "criterios_alta": "string",
      "recursos": "string",
      "justificativa": "string",
      "gas": { "n2": "string", "n1": "string", "zero": "string", "p1": "string", "p2": "string" },
      "estrategias": [{ "nome": "string", "justificativa": "string", "como_aplicar": "string", "referencia": "string" }]
    }
  ]
}`;

export const adicionarMetasIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdicionarMetasInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { plano, cabecalho } = await buscarContextoPaciente(supabase, data.plano_id);

    const { data: metasExistentes } = await supabase
      .from("plano_metas")
      .select("dominio, titulo_smart, baseline, ordem")
      .eq("plano_id", data.plano_id)
      .order("ordem");

    const metasResumo = (metasExistentes ?? []).length
      ? (metasExistentes ?? []).map((m: any) => `- [${m.dominio ?? "—"}] ${m.titulo_smart}${m.baseline ? ` (baseline: ${m.baseline})` : ""}`).join("\n")
      : "Nenhuma meta cadastrada ainda.";

    const userPrompt = `${cabecalho}

Metas já existentes neste plano (NÃO duplicar):
${metasResumo}

Domínios de foco para as novas metas: ${data.dominios_foco.join(", ")}

${data.contexto_extra ? `\nContexto adicional fornecido pela profissional:\n${data.contexto_extra}` : ""}

Gere apenas as metas novas em JSON conforme o schema.`;

    const parsed = await callGeminiJSON({ model: "gemini-2.5-flash", systemPrompt: SYSTEM_PROMPT_NOVAS_METAS, userPrompt });
    const metas = Array.isArray(parsed.metas) ? parsed.metas : [];

    const { data: maxMeta } = await supabase
      .from("plano_metas")
      .select("ordem")
      .eq("plano_id", data.plano_id)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ordemInicial = (maxMeta?.ordem ?? -1) + 1;

    const inseridas = await inserirMetasGeradas(supabase, data.plano_id, metas, ordemInicial, plano.ciclo_semanas);

    return { ok: true, metas_geradas: inseridas };
  });

// ============= IA: Extrair dados de PDF de avaliação =============
const ExtrairPdfInput = z.object({
  paciente_id: z.string().uuid(),
  storage_path: z.string().min(3),
});

export const extrairPdfAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtrairPdfInput.parse(d))
  .handler(async ({ data, context }) => {
    // Baixar PDF do storage
    const { data: file, error: dlErr } = await context.supabase.storage
      .from("prontuario-docs")
      .download(data.storage_path);
    if (dlErr || !file) throw new Error("Não foi possível baixar o PDF");

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const content = await callGemini({
      model: "gemini-2.5-flash",
      systemPrompt:
        "Extraia dados clínicos de laudos/relatórios neuropsicológicos. Responda apenas com JSON: {hipotese_diagnostica, queixas_familia, queixas_escola, testes:[{nome, dominio, escore_bruto, percentil, classificacao, observacoes}], perfil_cognitivo, recomendacoes}",
      userPrompt: "Extraia os dados deste laudo:",
      file: { mimeType: "application/pdf", base64 },
    });
    try {
      return { ok: true, dados: JSON.parse(content) };
    } catch {
      return { ok: false, dados: null, raw: content };
    }
  });
