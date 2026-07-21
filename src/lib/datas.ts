import { format as fnsFormat } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Parseia uma data "YYYY-MM-DD" (ou ISO com hora) como data-only no fuso LOCAL.
 * Evita o clássico off-by-one: `new Date("2026-06-07")` é interpretado como meia-noite
 * UTC e, exibido em BRT (UTC-3), aparece como o dia anterior. Aqui construímos a data
 * a partir dos componentes ano/mês/dia, sem qualquer conversão de fuso.
 */
export function parseDataLocal(s?: string | null): Date | null {
  if (!s) return null;
  const iso = String(s).slice(0, 10);
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Formata uma data-only de forma segura (sem shift de fuso). Retorna `fallback` se vazio/inválido. */
export function formatData(s?: string | null, fmt = "dd/MM/yyyy", fallback = "—"): string {
  const d = parseDataLocal(s);
  return d ? fnsFormat(d, fmt, { locale: ptBR }) : fallback;
}
