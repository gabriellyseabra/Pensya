import { differenceInDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { periodoAtual, fimPeriodoAtual } from "@/lib/marketing-periodos";
import type { Cadencia } from "@/components/marketing/types";

/**
 * Gera (de forma idempotente) as tarefas do período a partir das rotinas de
 * marketing pendentes e dos leads estagnados. Reaproveita a tabela `tarefas`
 * (mesma página de Tarefas do sistema), deduplicando pelo par título+prazo
 * (rotinas) ou pelo lead (follow-ups) enquanto a tarefa não estiver concluída.
 */
export async function gerarTarefasMarketing(): Promise<{ rotinas: number; followups: number }> {
  // ----- Rotinas pendentes no período atual -----
  const { data: rotinas } = await supabase.from("marketing_rotinas").select("*").eq("ativo", true);
  const periodos = Array.from(new Set((rotinas ?? []).map((r) => periodoAtual(r.cadencia as Cadencia))));
  const { data: exec } = await supabase
    .from("marketing_rotina_execucoes")
    .select("*")
    .in("periodo", periodos.length ? periodos : ["1970-01-01"]);

  const pendentes = (rotinas ?? []).filter((r) => {
    const per = periodoAtual(r.cadencia as Cadencia);
    const e = (exec ?? []).find((x) => x.rotina_id === r.id && x.periodo === per);
    return !(e && (e.feito || e.quantidade >= r.meta_qtd));
  });

  const { data: jaRotina } = await supabase
    .from("tarefas")
    .select("titulo, prazo")
    .eq("origem", "rotina_mkt")
    .neq("status", "concluida");
  const existentesRotina = new Set((jaRotina ?? []).map((t) => `${t.titulo}|${t.prazo}`));

  const novasRotina = pendentes
    .map((r) => {
      const prazo = fimPeriodoAtual(r.cadencia as Cadencia);
      const titulo = `Rotina: ${r.titulo}`;
      return { key: `${titulo}|${prazo}`, titulo, prazo };
    })
    .filter((t) => !existentesRotina.has(t.key))
    .map((t) => ({
      titulo: t.titulo,
      departamento: "Marketing",
      origem: "rotina_mkt",
      prazo: t.prazo,
      status: "a_fazer",
      descricao: "Rotina recorrente do marketing.",
    }));
  if (novasRotina.length) await supabase.from("tarefas").insert(novasRotina);

  // ----- Follow-ups de leads estagnados -----
  const { data: etapas } = await supabase.from("pipeline_etapas").select("id, tipo").eq("tipo", "ativo");
  const etapasAtivas = new Set((etapas ?? []).map((e) => e.id));
  const { data: leads } = await supabase
    .from("leads")
    .select("id, nome, etapa_id, ultimo_contato_em, entrou_em, proximo_contato_em, paciente_id_criado");
  const hoje = new Date();
  const estagnados = (leads ?? []).filter((l) => {
    if (l.paciente_id_criado || !etapasAtivas.has(l.etapa_id)) return false;
    if (l.proximo_contato_em) return new Date(l.proximo_contato_em) < hoje;
    const ref = l.ultimo_contato_em ?? l.entrou_em;
    return ref ? differenceInDays(hoje, new Date(ref)) >= 7 : false;
  });

  const { data: jaFollow } = await supabase
    .from("tarefas")
    .select("lead_id")
    .eq("origem", "follow_up_mkt")
    .neq("status", "concluida");
  const followExistentes = new Set((jaFollow ?? []).map((t) => t.lead_id));

  const prazoHoje = format(hoje, "yyyy-MM-dd");
  const novasFollow = estagnados
    .filter((l) => !followExistentes.has(l.id))
    .map((l) => ({
      titulo: `Follow-up: ${l.nome}`,
      lead_id: l.id,
      departamento: "Comercial",
      origem: "follow_up_mkt",
      prazo: prazoHoje,
      status: "a_fazer",
      descricao: "Lead sem contato recente — retomar conversa.",
    }));
  if (novasFollow.length) await supabase.from("tarefas").insert(novasFollow);

  return { rotinas: novasRotina.length, followups: novasFollow.length };
}
