import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini } from "@/lib/gemini-client";
import { buscarReferenciasRelevantes } from "@/lib/referencias.functions";
import {
  REGRAS_ESCRITA_NAVE, INSTRUCOES_HTML_NAVE, ESTRUTURA_AVALIACAO_NAVE,
  svgPerfilCognitivo, legendaClassificacaoHTML, type PerfilItem,
} from "@/lib/nave-relatorio";

async function callGeminiText(system: string, user: string) {
  return callGemini({ model: "gemini-2.5-flash", systemPrompt: system, userPrompt: user, json: false });
}

const Input = z.object({
  paciente_id: z.string().uuid(),
  tipo: z.enum(["evolucao", "plano_terapeutico", "laudo", "avaliacao"]),
  periodo_inicio: z.string().optional(),
  periodo_fim: z.string().optional(),
  contexto_extra: z.string().max(2000).optional(),
  template_id: z.string().uuid().optional(),
});

export const gerarRelatorioPaciente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento, genero, escolaridade, serie_curso, queixa_principal, expectativas, hipotese_diagnostica, observacoes, paciente_diagnosticos(diagnostico:diagnosticos(nome)), escola:escolas(nome), modalidade:modalidades(nome)")
      .eq("id", data.paciente_id)
      .maybeSingle();

    if (!pac) throw new Error("Paciente não encontrado");

    const { data: clinicaCfg } = await supabase
      .from("organizacoes")
      .select("nome")
      .maybeSingle();
    const nomeClinicaPrompt = clinicaCfg?.nome ? ` (${clinicaCfg.nome})` : "";

    const inicio = data.periodo_inicio ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const fim = data.periodo_fim ?? new Date().toISOString().slice(0, 10);

    const [metasRes, sessoesRes, freqRes, testesRes, planosRes] = await Promise.all([
      supabase.from("metas_terapeuticas").select("id, titulo, descricao, dominio_cognitivo, status, prioridade, data_inicio, data_fim_prevista, criterio_alcance").eq("paciente_id", data.paciente_id),
      supabase.from("prontuario_sessoes").select("data_sessao, tipo, evolucao, soap_avaliacao, engajamento, nivel_suporte").eq("paciente_id", data.paciente_id).gte("data_sessao", inicio).lte("data_sessao", fim).order("data_sessao"),
      supabase.from("frequencia").select("data_referencia, tipo").eq("paciente_id", data.paciente_id).gte("data_referencia", inicio).lte("data_referencia", fim),
      supabase.from("avaliacoes").select("data_avaliacao, motivo, sintese, testes_aplicados(data_aplicacao, classificacao, percentil, escore_padrao, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome)))").eq("paciente_id", data.paciente_id).order("data_avaliacao", { ascending: false }).limit(5),
      supabase.from("planos_terapeuticos").select("titulo, objetivo_participacao, descricao, status, data_inicio, data_fim_previsto").eq("paciente_id", data.paciente_id).eq("status", "ativo").limit(3),
    ]);

    const metas = metasRes.data ?? [];
    const sessoes = sessoesRes.data ?? [];
    const freq = freqRes.data ?? [];
    const testes = testesRes.data ?? [];
    const planos = planosRes.data ?? [];

    const metaIds = metas.map((m: any) => m.id);
    const { data: gas } = metaIds.length ? await supabase
      .from("sessao_metas")
      .select("meta_id, nivel_gas_observado, observacoes_meta, engajamento, nivel_suporte")
      .in("meta_id", metaIds) : { data: [] as any[] };

    const presencas = freq.filter((f: any) => f.tipo === "presente").length;
    const totalSessoes = sessoes.length;
    const taxaPresenca = totalSessoes ? Math.round((presencas / (presencas + freq.filter((f: any) => f.tipo !== "presente").length || 1)) * 100) : null;

    // Contexto comum
    const idade = pac.data_nascimento ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / 31557600000) : null;
    const diagnosticos = (pac.paciente_diagnosticos ?? []).map((d: any) => d.diagnostico?.nome).filter(Boolean).join(", ");

    // Perfil cognitivo: percentil mais recente por domínio (para o gráfico e a síntese)
    const perfilMap = new Map<string, { percentil: number; data: string }>();
    testes.forEach((a: any) => {
      (a.testes_aplicados ?? []).forEach((t: any) => {
        const dom = t.teste?.dominio?.nome;
        const pc = t.percentil;
        if (!dom || pc == null) return;
        const dt = t.data_aplicacao ?? a.data_avaliacao ?? "";
        const cur = perfilMap.get(dom);
        if (!cur || dt > cur.data) perfilMap.set(dom, { percentil: Number(pc), data: dt });
      });
    });
    const perfilCognitivo: PerfilItem[] = Array.from(perfilMap.entries())
      .map(([dominio, v]) => ({ dominio, percentil: v.percentil }))
      .sort((a, b) => a.percentil - b.percentil);
    const perfilTexto = perfilCognitivo.length
      ? perfilCognitivo.map((p) => `- ${p.dominio}: P${Math.round(p.percentil)}`).join("\n")
      : "—";

    // MÓDULO 3 — Referências da biblioteca relevantes (queixa + diagnósticos + domínios)
    const termosRef = [
      pac.queixa_principal ?? "",
      diagnosticos,
      ...perfilCognitivo.map((p) => p.dominio),
    ].filter(Boolean);
    const { bloco: refsBloco } = await buscarReferenciasRelevantes(supabase, termosRef);

    const baseContexto = `PACIENTE
Nome: ${pac.nome}
Idade: ${idade ?? "—"} anos
Gênero: ${pac.genero ?? "—"}
Escolaridade: ${pac.escolaridade ?? "—"} ${pac.serie_curso ?? ""}
Escola: ${(pac.escola as any)?.nome ?? "—"}
Diagnósticos: ${diagnosticos || "—"}
Hipótese diagnóstica levantada: ${pac.hipotese_diagnostica ? "Sim" : "Não"}
Modalidade: ${(pac.modalidade as any)?.nome ?? "—"}
Queixa principal: ${pac.queixa_principal ?? "—"}
Expectativas: ${pac.expectativas ?? "—"}
Observações: ${pac.observacoes ?? "—"}

PERÍODO: ${inicio} a ${fim}
Sessões realizadas: ${totalSessoes}
Taxa de presença: ${taxaPresenca !== null ? taxaPresenca + "%" : "—"}

METAS TERAPÊUTICAS
${metas.map((m: any) => `- [${m.status}] ${m.titulo} (${m.dominio_cognitivo ?? "—"}, prioridade ${m.prioridade ?? "—"}) — critério: ${m.criterio_alcance ?? "—"}`).join("\n") || "—"}

PROGRESSO GAS POR META
${metas.map((m: any) => {
  const gs = (gas ?? []).filter((g: any) => g.meta_id === m.id);
  if (!gs.length) return `- ${m.titulo}: sem registros`;
  const avg = gs.reduce((s: number, g: any) => s + (g.nivel_gas_observado ?? 0), 0) / gs.length;
  const ultimos = gs.slice(-5).map((g: any) => g.nivel_gas_observado).join(", ");
  return `- ${m.titulo}: média ${avg.toFixed(1)}, últimos níveis: ${ultimos}`;
}).join("\n") || "—"}

AVALIAÇÕES
${testes.map((a: any) => `- ${a.data_avaliacao}: ${a.motivo ?? "—"}\n  testes: ${(a.testes_aplicados ?? []).map((t: any) => `${t.teste?.nome ?? "—"} [${t.teste?.dominio?.nome ?? "sem domínio"}] (${t.classificacao ?? "—"}, pc ${t.percentil ?? "—"}, ep ${t.escore_padrao ?? "—"})`).join("; ") || "—"}`).join("\n") || "—"}

PERFIL COGNITIVO POR DOMÍNIO (percentil mais recente)
${perfilTexto}

PLANOS ATIVOS
${planos.map((p: any) => `- ${p.titulo}: ${p.objetivo_participacao ?? p.descricao ?? "—"}`).join("\n") || "—"}

SESSÕES (resumos)
${sessoes.slice(-12).map((s: any) => `[${s.data_sessao}] (${s.tipo}) avaliação: ${(s.evolucao ?? s.soap_avaliacao ?? "").slice(0,300)}`).join("\n") || "—"}
${data.contexto_extra ? `\nCONTEXTO ADICIONAL:\n${data.contexto_extra}` : ""}
${refsBloco ? `\nREFERÊNCIAS DA BIBLIOTECA (evidências para fundamentar o relatório)\n${refsBloco}` : ""}`;

    let system = "";
    let prompt = "";

    // Carrega template personalizado se houver
    let template: any = null;
    if (data.template_id) {
      const { data: tpl } = await supabase
        .from("documento_templates")
        .select("nome, estrutura, instrucoes_extra")
        .eq("id", data.template_id)
        .maybeSingle();
      template = tpl;
    }

    // Regras de escrita e marcação do padrão Nave — aplicadas a todos os tipos.
    const padraoNave = `\n\n${REGRAS_ESCRITA_NAVE}\n\n${INSTRUCOES_HTML_NAVE}`;
    const instrProf = template?.instrucoes_extra ? "\n\nINSTRUÇÕES DO PROFISSIONAL:\n" + template.instrucoes_extra : "";

    if (data.tipo === "evolucao") {
      system = `Você é uma psicopedagoga clínica sênior redigindo um RELATÓRIO DE EVOLUÇÃO terapêutica. Use APENAS dados fornecidos.${padraoNave}${instrProf}`;
      prompt = `Gere o RELATÓRIO DE EVOLUÇÃO seguindo esta estrutura:
${template?.estrutura ?? `1. Identificação
2. Período avaliado e frequência
3. Metas trabalhadas (com nível atual GAS)
4. Evolução por domínio cognitivo
5. Observações qualitativas das sessões
6. Conclusão e recomendações para o próximo ciclo`}

${baseContexto}`;
    } else if (data.tipo === "plano_terapeutico") {
      system = `Você é uma psicopedagoga clínica sênior redigindo um PLANO TERAPÊUTICO FUNCIONAL no modelo CIF + metas SMART + escala GAS. Toda meta deve responder "o que muda na participação real".${padraoNave}${instrProf}`;
      prompt = `Gere o PLANO TERAPÊUTICO seguindo esta estrutura:
${template?.estrutura ?? `1. Cabeçalho com identificação
2. Síntese do perfil CIF (Funções, Atividades, Participação, Fatores ambientais, Fatores pessoais)
3. Objetivo de participação para o ciclo
4. Metas SMART funcionais (uma tabela por meta: baseline, níveis GAS -2/-1/0/+1/+2)
5. Estratégias de intervenção com justificativa clínica
6. Orientações para a família
7. Orientações para a escola
8. Espaço de revisão e próximas datas`}

${baseContexto}`;
    } else if (data.tipo === "avaliacao") {
      system = `Você é uma psicopedagoga clínica sênior${nomeClinicaPrompt} redigindo um RELATÓRIO DE AVALIAÇÃO PSICOPEDAGÓGICA com enfoque em neuropsicologia escolar. Use APENAS dados fornecidos; não invente escores nem diagnósticos.${padraoNave}${instrProf}`;
      prompt = `Gere o RELATÓRIO DE AVALIAÇÃO seguindo EXATAMENTE esta estrutura:
${template?.estrutura ?? ESTRUTURA_AVALIACAO_NAVE}

${baseContexto}`;
    } else {
      system = `Você é uma psicopedagoga clínica sênior redigindo um LAUDO PSICOPEDAGÓGICO formal. Não invente diagnósticos — use APENAS dados fornecidos.${padraoNave}${instrProf}`;
      prompt = `Gere o LAUDO PSICOPEDAGÓGICO seguindo esta estrutura:
${template?.estrutura ?? `1. Identificação
2. Motivo do encaminhamento / queixa
3. Procedimentos utilizados (testes e observações)
4. Resultados quantitativos e qualitativos
5. Análise integrada
6. Hipótese psicopedagógica
7. Conclusão
8. Recomendações para família e escola`}

${baseContexto}`;
    }

    const html = await callGeminiText(system, prompt);

    // Limpa cercas de código se vierem
    let cleaned = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    // Injeta o gráfico de perfil cognitivo (SVG determinístico) no marcador.
    const grafico = perfilCognitivo.length ? legendaClassificacaoHTML() + svgPerfilCognitivo(perfilCognitivo) : "";
    if (cleaned.includes("{{GRAFICO_PERFIL}}")) {
      cleaned = cleaned.replace(/\{\{GRAFICO_PERFIL\}\}/g, grafico);
    } else if (grafico && (data.tipo === "avaliacao" || data.tipo === "laudo")) {
      cleaned += `\n<h2>Perfil cognitivo</h2>\n${grafico}`;
    }

    const titulo =
      data.tipo === "evolucao" ? "Relatório de Evolução" :
      data.tipo === "plano_terapeutico" ? "Plano Terapêutico" :
      data.tipo === "avaliacao" ? "Relatório de Avaliação Psicopedagógica" : "Laudo Psicopedagógico";

    return {
      titulo,
      paciente_nome: pac.nome as string,
      periodo: { inicio, fim },
      html: cleaned,
    };
  });
