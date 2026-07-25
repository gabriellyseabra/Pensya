/**
 * Série temporal do mapa funcional — "como estava em março".
 *
 * Separado do componente porque a mesma pergunta reaparece no modo devolutiva
 * e nos exports do laudo: dado um mês, qual era o estado das vias naquele
 * momento, e o que mudou desde a primeira avaliação.
 */

import type { Metrica } from "@/hooks/use-perfil-cognitivo";
import { REGIOES, distribuirEmRegioes } from "./neuro-mapa";

/** "2026-03-14" → "2026-03". Agrupar por mês evita uma régua com 40 marcas. */
export function mesDe(data: string | null | undefined): string | null {
  return data ? data.slice(0, 7) : null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${(ano ?? "").slice(2)}`;
}

/** Meses distintos com avaliação aplicada, em ordem crescente. */
export function momentosDe(metricas: Metrica[]): string[] {
  const meses = new Set<string>();
  for (const m of metricas) {
    const mes = mesDe(m.data);
    if (mes) meses.add(mes);
  }
  return [...meses].sort();
}

/**
 * Métricas que devem pesar no percentil da região: quando um teste tem
 * variáveis, o escore agregado é descartado para não contar o mesmo teste
 * duas vezes (uma pelas partes, outra pelo total).
 */
export function metricasRelevantes(metricas: Metrica[]): Metrica[] {
  const temVariavel = new Set(metricas.filter((m) => m.variavelKey != null).map((m) => m.testeId));
  return metricas.filter((m) => m.variavelKey != null || !temVariavel.has(m.testeId));
}

/**
 * Estado das métricas "como estava" ao fim de um mês: para cada medida
 * (mesmo teste + mesma variável) mantém apenas a aplicação MAIS RECENTE até
 * ali. É o que faz um reteste substituir a avaliação inicial em vez de ser
 * somado a ela.
 *
 * Métricas sem data entram em todos os momentos: não dá para situá-las no
 * tempo, mas descartá-las perderia achado clínico real. Como consequência,
 * uma avaliação sem `data_aplicacao` aparece já no primeiro momento.
 */
export function metricasAte(metricas: Metrica[], mesLimite: string): Metrica[] {
  const maisRecente = new Map<string, Metrica>();
  const semData: Metrica[] = [];
  for (const m of metricas) {
    const mes = mesDe(m.data);
    if (mes == null) {
      semData.push(m);
      continue;
    }
    if (mes > mesLimite) continue;
    // Chave por NOME do teste, não por id: um reteste é outra linha.
    const chave = `${m.testeNome}::${m.variavelKey ?? "_total"}`;
    const atual = maisRecente.get(chave);
    if (!atual || (mesDe(atual.data) ?? "") <= mes) maisRecente.set(chave, m);
  }
  return [...maisRecente.values(), ...semData];
}

export type DesempenhoRegiao = { pct: number | null; achados: string[] };

/**
 * Percentil ponderado por região. O peso vem do mapa funcional: uma variável
 * que é central para a via pesa mais do que uma que só a tangencia.
 */
export function desempenhoPorRegiao(metricas: Metrica[]): Record<string, DesempenhoRegiao> {
  const acc: Record<string, { soma: number; peso: number; achados: string[] }> = {};
  for (const r of REGIOES) acc[r.key] = { soma: 0, peso: 0, achados: [] };

  for (const m of metricasRelevantes(metricas)) {
    if (m.percentil == null) continue;
    const label = m.variavelLabel && !/total/i.test(m.variavelLabel) ? m.variavelLabel : m.dominio;
    for (const { key, peso } of distribuirEmRegioes(m.variavelLabel, m.dominio, m.testeNome)) {
      const a = acc[key];
      if (!a) continue;
      a.soma += m.percentil * peso;
      a.peso += peso;
      if (m.percentil < 25) a.achados.push(label);
    }
  }

  const out: Record<string, DesempenhoRegiao> = {};
  for (const [key, a] of Object.entries(acc)) {
    out[key] = { pct: a.peso > 0 ? Math.round(a.soma / a.peso) : null, achados: a.achados };
  }
  return out;
}
