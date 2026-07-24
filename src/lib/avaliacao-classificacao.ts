/**
 * Motor de classificação de resultados de teste — orientado a dados (rubricas).
 *
 * Uma "rubrica" é a régua de faixas de um instrumento: cada teste pode usar a
 * sua (Guillmette, clínica de 7 faixas, escore-padrão, ou uma custom da clínica
 * — ex.: coleção Seabra/ANC, TDE II). O sistema NÃO embute tabela de norma:
 * o percentil / escore-padrão é sempre inserido pela profissional; a rubrica
 * só diz em que faixa aquele número cai (rótulo + cor).
 *
 * Fonte única da verdade: as telas de avaliação, o perfil cognitivo e os laudos
 * devem classificar por aqui, em vez de reimplementar bandas soltas.
 */

export type RubricaBase = "percentil" | "escore_padrao";

/** Faixa da rubrica: limite inferior inclusivo + rótulo + cor (hex). */
export type Faixa = { min: number; rotulo: string; cor: string };

export type Rubrica = {
  id?: string;
  slug?: string | null;
  nome: string;
  base: RubricaBase;
  faixas: Faixa[];
  is_preset?: boolean;
};

/* ============================== Presets ============================== */
// Espelham os presets semeados no banco. Servem de fallback em código para
// classificar mesmo antes de carregar as rubricas do banco.

export const PRESET_GUILLMETTE: Rubrica = {
  slug: "guillmette",
  nome: "Guillmette (2020) — 4 faixas",
  base: "percentil",
  is_preset: true,
  faixas: [
    { min: 25, rotulo: "Médio / Superior", cor: "#16a34a" },
    { min: 16, rotulo: "Médio inferior", cor: "#eab308" },
    { min: 9, rotulo: "Inferior à média", cor: "#f97316" },
    { min: 0, rotulo: "Muito inferior à média", cor: "#dc2626" },
  ],
};

export const PRESET_CLINICA_7: Rubrica = {
  slug: "clinica_7",
  nome: "Clínica — 7 faixas (percentil)",
  base: "percentil",
  is_preset: true,
  faixas: [
    { min: 98, rotulo: "Extremamente superior", cor: "#8b5cf6" },
    { min: 91, rotulo: "Superior à média", cor: "#6366f1" },
    { min: 75, rotulo: "Média Superior", cor: "#3b82f6" },
    { min: 25, rotulo: "Média", cor: "#22c55e" },
    { min: 9, rotulo: "Média Inferior", cor: "#f59e0b" },
    { min: 2, rotulo: "Inferior à média", cor: "#ef4444" },
    { min: 0, rotulo: "Extremamente inferior", cor: "#b91c1c" },
  ],
};

export const PRESET_ESCORE_PADRAO: Rubrica = {
  slug: "escore_padrao",
  nome: "Escore-padrão (M=100 / DP=15)",
  base: "escore_padrao",
  is_preset: true,
  faixas: [
    { min: 130, rotulo: "Muito superior", cor: "#8b5cf6" },
    { min: 120, rotulo: "Superior", cor: "#6366f1" },
    { min: 110, rotulo: "Média superior", cor: "#3b82f6" },
    { min: 90, rotulo: "Média", cor: "#22c55e" },
    { min: 80, rotulo: "Média inferior", cor: "#f59e0b" },
    { min: 70, rotulo: "Inferior à média", cor: "#ef4444" },
    { min: 0, rotulo: "Extremamente inferior", cor: "#b91c1c" },
  ],
};

export const PRESETS: Rubrica[] = [PRESET_GUILLMETTE, PRESET_CLINICA_7, PRESET_ESCORE_PADRAO];

/** Rubrica padrão quando o teste não define nenhuma (mantém o comportamento antigo). */
export const RUBRICA_PADRAO = PRESET_CLINICA_7;

/* ============================== Motor ============================== */

export type Classificacao = { rotulo: string; cor: string };

/** Ordena faixas por `min` desc (defensivo) e devolve a primeira que o valor alcança. */
function faixaDoValor(faixas: Faixa[], valor: number): Faixa | null {
  const ordenadas = [...faixas].sort((a, b) => b.min - a.min);
  for (const f of ordenadas) {
    if (valor >= f.min) return f;
  }
  return ordenadas.length ? ordenadas[ordenadas.length - 1] : null;
}

/**
 * Classifica um resultado pela rubrica. Lê percentil ou escore-padrão conforme
 * a base da rubrica; cai para o outro valor se o principal faltar.
 */
export function classificar(
  rubrica: Rubrica | null | undefined,
  valores: { percentil?: number | null; escorePadrao?: number | null },
): Classificacao | null {
  const r = rubrica ?? RUBRICA_PADRAO;
  const p = valores.percentil;
  const s = valores.escorePadrao;
  let valor: number | null | undefined = r.base === "escore_padrao" ? s : p;
  if (valor == null) valor = r.base === "escore_padrao" ? p : s; // fallback
  if (valor == null || Number.isNaN(Number(valor))) return null;
  const f = faixaDoValor(r.faixas ?? [], Number(valor));
  return f ? { rotulo: f.rotulo, cor: f.cor } : null;
}

/** Só o rótulo (string) — conveniência para gravar em `classificacao`. */
export function classificarRotulo(
  rubrica: Rubrica | null | undefined,
  valores: { percentil?: number | null; escorePadrao?: number | null },
): string | null {
  return classificar(rubrica, valores)?.rotulo ?? null;
}

/** Cor (hex) de um rótulo dentro de uma rubrica (para badges/gráficos). */
export function corDoRotulo(rubrica: Rubrica | null | undefined, rotulo: string | null): string | null {
  if (!rotulo) return null;
  const r = rubrica ?? RUBRICA_PADRAO;
  const f = (r.faixas ?? []).find((x) => x.rotulo === rotulo);
  return f?.cor ?? null;
}
