import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ImpactoCif } from "@/components/prontuario/ImpactosCIFEditor";
import { normalizarResultado, type VariavelResultado } from "@/components/prontuario/VariaveisTesteEditor";

export type TesteRow = {
  id: string;
  data_aplicacao: string | null;
  escore_bruto: number | null;
  escore_padrao: number | null;
  percentil: number | null;
  classificacao: string | null;
  observacoes_qualitativas: string | null;
  interpretacao_clinica?: string | null;
  impactos_cif?: ImpactoCif[] | null;
  variaveis_valores?: Record<string, any> | null;
  teste: {
    nome: string;
    formula_agregacao?: string | null;
    variaveis?: Array<{ key: string; label: string }> | null;
    dominio: { id: string; nome: string } | null;
  } | null;
  avaliacao: { titulo: string; data_inicio: string | null } | null;
};

export type Metrica = {
  testeId: string;
  testeNome: string;
  dominio: string;
  data: string | null;
  variavelKey: string | null; // null = escore agregado do teste
  variavelLabel: string; // "Total" quando agregado
  bruto: number | string | null;
  padrao: number | null;
  percentil: number | null;
  percentilEstimado?: boolean; // true quando derivado do escore padrão
};

/** Converte escore padrão (média=100, DP=15) para percentil aproximado via CDF normal. */
export function padraoToPercentil(s: number | null): number | null {
  if (s == null || isNaN(s)) return null;
  const z = (s - 100) / 15;
  // Aproximação Abramowitz & Stegun 26.2.17
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  const cdf = 0.5 * (1 + sign * y);
  return Math.max(0.1, Math.min(99.9, +(cdf * 100).toFixed(1)));
}

export function classifPercentil(p: number | null): { label: string; cor: string; bg: string; tone: "ok" | "default" | "warn" | "danger" } {
  if (p == null) return { label: "Sem dados", cor: "text-muted-foreground", bg: "bg-muted", tone: "default" };
  if (p >= 98) return { label: "Muito superior", cor: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/15", tone: "ok" };
  if (p >= 91) return { label: "Superior", cor: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", tone: "ok" };
  if (p >= 75) return { label: "Médio superior", cor: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/15", tone: "ok" };
  if (p >= 25) return { label: "Médio", cor: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", tone: "default" };
  if (p >= 9)  return { label: "Médio inferior", cor: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", tone: "warn" };
  if (p >= 2)  return { label: "Rebaixado", cor: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/10", tone: "danger" };
  return { label: "Muito rebaixado", cor: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/20", tone: "danger" };
}

export function corHeatPercentil(p: number | null): string {
  if (p == null) return "bg-muted/40 text-muted-foreground";
  if (p >= 91) return "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100";
  if (p >= 25) return "bg-sky-500/20 text-sky-900 dark:text-sky-100";
  if (p >= 9)  return "bg-amber-500/25 text-amber-900 dark:text-amber-100";
  return "bg-rose-500/30 text-rose-900 dark:text-rose-100";
}

function num(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Decompõe um teste em métricas (uma por variável + o escore agregado, quando presente). */
export function expandirTeste(t: TesteRow): Metrica[] {
  const dominio = t.teste?.dominio?.nome ?? "Sem domínio";
  const testeNome = t.teste?.nome ?? "Teste";
  const out: Metrica[] = [];

  const valores = (t.variaveis_valores ?? {}) as Record<string, VariavelResultado | string | number>;
  const schema = (t.teste?.variaveis ?? []) as Array<{ key: string; label: string }>;

  // Linha por variável (usa schema se houver, ou as chaves presentes nos valores)
  const keys = schema.length ? schema.map((s) => s.key) : Object.keys(valores ?? {});
  const labelOf = (k: string) => schema.find((s) => s.key === k)?.label ?? k;

  for (const key of keys) {
    const r = normalizarResultado(valores?.[key]);
    const padrao = num(r.padrao);
    let percentil = num(r.percentil);
    let percentilEstimado = false;
    if (percentil == null && padrao != null) {
      percentil = padraoToPercentil(padrao);
      percentilEstimado = percentil != null;
    }
    const bruto = r.bruto ?? null;
    // só inclui se tiver algum valor numérico ou bruto
    if (padrao == null && percentil == null && (bruto == null || bruto === "")) continue;
    out.push({
      testeId: t.id,
      testeNome,
      dominio,
      data: t.data_aplicacao,
      variavelKey: key,
      variavelLabel: labelOf(key),
      bruto,
      padrao,
      percentil,
      percentilEstimado,
    });
  }

  // Linha agregada do teste (se houver pontuação no nível do teste)
  if (t.percentil != null || t.escore_padrao != null || t.escore_bruto != null) {
    let pct = t.percentil;
    let estimado = false;
    if (pct == null && t.escore_padrao != null) {
      pct = padraoToPercentil(t.escore_padrao);
      estimado = pct != null;
    }
    out.push({
      testeId: t.id,
      testeNome,
      dominio,
      data: t.data_aplicacao,
      variavelKey: null,
      variavelLabel: out.length > 0 ? "Total (agregado)" : "Total",
      bruto: t.escore_bruto,
      padrao: t.escore_padrao,
      percentil: pct,
      percentilEstimado: estimado,
    });
  }

  return out;
}

export const PERFIL_COGNITIVO_KEY = (pacienteId: string) => ["perfil-cognitivo", pacienteId] as const;

/**
 * Carrega os testes aplicados de um paciente e deriva as métricas (por variável e
 * agregadas), agrupamento por domínio e dados do radar — reaproveitado pela aba
 * Perfil Cognitivo completa e pelo card condensado da Visão Geral da Avaliação.
 */
export function usePerfilCognitivo(pacienteId: string) {
  const { data, isLoading } = useQuery({
    queryKey: PERFIL_COGNITIVO_KEY(pacienteId),
    queryFn: async () => {
      const { data: testes } = await supabase
        .from("testes_aplicados")
        .select(`
          id, data_aplicacao, escore_bruto, escore_padrao, percentil, classificacao, observacoes_qualitativas,
          interpretacao_clinica, impactos_cif, variaveis_valores,
          teste:testes_catalogo(nome, formula_agregacao, variaveis, dominio:dominios_cognitivos(id, nome)),
          avaliacao:avaliacoes!inner(titulo, data_inicio, paciente_id)
        `)
        .eq("avaliacao.paciente_id", pacienteId)
        .order("data_aplicacao", { ascending: false, nullsFirst: false });
      return (testes ?? []) as unknown as TesteRow[];
    },
  });

  // Todas as métricas (variável-nível) achatadas
  const metricas = useMemo<Metrica[]>(() => {
    const out: Metrica[] = [];
    for (const t of data ?? []) out.push(...expandirTeste(t));
    return out;
  }, [data]);

  // Agrega por domínio (média de TODOS os percentis de variável + agregado)
  const porDominio = useMemo(() => {
    const map: Record<string, { nome: string; metricas: Metrica[]; testes: Set<string> }> = {};
    for (const m of metricas) {
      const d = (map[m.dominio] = map[m.dominio] ?? { nome: m.dominio, metricas: [], testes: new Set() });
      d.metricas.push(m);
      d.testes.add(m.testeId);
    }
    return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [metricas]);

  const radarData = useMemo(() => {
    return porDominio
      .map((d) => {
        const pcts = d.metricas.map((m) => m.percentil).filter((p): p is number => p != null);
        const media = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
        return { dominio: d.nome, percentil: media != null ? Math.round(media) : 0, _media: media };
      })
      .filter((r) => r.dominio !== "Sem domínio" || r.percentil > 0);
  }, [porDominio]);

  return { testes: data ?? [], isLoading, metricas, porDominio, radarData };
}
