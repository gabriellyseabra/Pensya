import type { QueryClient } from "@tanstack/react-query";

/**
 * Todas as queries do módulo Financeiro que dependem das tabelas `pagamentos` e
 * `lancamentos_financeiros`. Chame após qualquer criação/edição/remoção nessas
 * tabelas (de qualquer tela) para manter os relatórios/dashboards em dia —
 * evita cada tela ter que saber a lista inteira de quem mais lê esses dados.
 */
export function invalidarFinanceiro(qc: QueryClient) {
  const chaves = [
    "lancamentos",
    "a-receber",
    "a-pagar",
    "fin-visao",
    "fin-serie-6m",
    "fin-despesas-categoria",
    "mensalidades-pagamentos",
    "mensalidades-lancamentos",
    "categoria-pagamentos",
    "categoria-receitas",
    "categoria-despesas",
    "pag-paciente",
    "extrato-transacoes",
    "extrato-pendentes-count",
  ];
  for (const key of chaves) qc.invalidateQueries({ queryKey: [key] });
}
