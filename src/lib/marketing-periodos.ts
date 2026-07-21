import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Cadencia } from "@/components/marketing/types";

/**
 * Cada rotina é chaveada pelo início do seu período (semana ISO / mês / bimestre).
 * A ausência de execução para o período atual = rotina ainda não cumprida — o
 * checklist "se renova" automaticamente a cada novo período, sem cron.
 */

const YMD = "yyyy-MM-dd";

/** Início do bimestre (Jan/Fev, Mar/Abr, …) que contém `d`. */
function startOfBimester(d: Date): Date {
  const mes = d.getMonth();
  const inicioMes = mes - (mes % 2);
  return new Date(d.getFullYear(), inicioMes, 1);
}

/** Data (yyyy-MM-dd) de início do período atual para a cadência. */
export function periodoAtual(cadencia: Cadencia, ref: Date = new Date()): string {
  if (cadencia === "semanal") return format(startOfWeek(ref, { weekStartsOn: 1 }), YMD);
  if (cadencia === "mensal") return format(startOfMonth(ref), YMD);
  return format(startOfBimester(ref), YMD);
}

/** Data (yyyy-MM-dd) de fim do período atual — usada como prazo das tarefas. */
export function fimPeriodoAtual(cadencia: Cadencia, ref: Date = new Date()): string {
  if (cadencia === "semanal") return format(endOfWeek(ref, { weekStartsOn: 1 }), YMD);
  if (cadencia === "mensal") return format(endOfMonth(ref), YMD);
  const ini = startOfBimester(ref);
  return format(endOfMonth(new Date(ini.getFullYear(), ini.getMonth() + 1, 1)), YMD);
}

/** Rótulo humano do período atual (ex.: "semana de 13–19 jul", "julho", "jul–ago"). */
export function rotuloPeriodo(cadencia: Cadencia, ref: Date = new Date()): string {
  if (cadencia === "semanal") {
    const ini = startOfWeek(ref, { weekStartsOn: 1 });
    const fim = endOfWeek(ref, { weekStartsOn: 1 });
    return `semana de ${format(ini, "d")}–${format(fim, "d MMM", { locale: ptBR })}`;
  }
  if (cadencia === "mensal") return format(ref, "MMMM", { locale: ptBR });
  const ini = startOfBimester(ref);
  const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
  return `${format(ini, "MMM", { locale: ptBR })}–${format(fim, "MMM", { locale: ptBR })}`;
}
