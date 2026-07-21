import type { QueryClient } from "@tanstack/react-query";

/**
 * Todas as queries do módulo Marketing que dependem das tabelas `leads`,
 * `lead_interacoes` e `campanhas`. Chame após qualquer criação/edição/remoção
 * nessas tabelas (de qualquer tela) para manter dashboard, kanban e
 * campanhas em dia.
 */
export function invalidarMarketing(qc: QueryClient) {
  const chaves = [
    "leads",
    "leads-kanban",
    "lead-interacoes",
    "mkt-dashboard",
    "campanhas",
    "tarefas",
    "mkt-objetivos",
    "mkt-funis",
    "mkt-funil-acoes",
    "mkt-rotinas",
    "mkt-rotina-execucoes",
    "mkt-indicadores",
    "mkt-indicador-valores",
    "mkt-principios",
  ];
  for (const key of chaves) qc.invalidateQueries({ queryKey: [key] });
}
