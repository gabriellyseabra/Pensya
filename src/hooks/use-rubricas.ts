import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRESETS, RUBRICA_PADRAO, type Rubrica } from "@/lib/avaliacao-classificacao";

/**
 * Carrega as rubricas de classificação (presets compartilhados + custom da
 * própria clínica) e expõe índices por id e por slug, além de um resolvedor
 * que sempre devolve uma rubrica válida (cai no preset padrão).
 */
export function useRubricas() {
  const { data: rubricas = [], isLoading } = useQuery({
    queryKey: ["rubricas-classificacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rubricas_classificacao")
        .select("id, org_id, slug, nome, base, faixas, is_preset")
        .order("is_preset", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Rubrica[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const lista = rubricas.length ? rubricas : PRESETS;
    const byId = new Map<string, Rubrica>();
    const bySlug = new Map<string, Rubrica>();
    for (const r of lista) {
      if (r.id) byId.set(r.id, r);
      if (r.slug) bySlug.set(r.slug, r);
    }
    /** Rubrica de um teste pelo rubrica_id (cai no preset padrão se faltar). */
    const resolver = (rubricaId?: string | null): Rubrica =>
      (rubricaId ? byId.get(rubricaId) : null) ?? bySlug.get(RUBRICA_PADRAO.slug ?? "") ?? RUBRICA_PADRAO;
    return { rubricas: lista, byId, bySlug, resolver, isLoading };
  }, [rubricas, isLoading]);
}
