import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRESETS, RUBRICA_PADRAO, type Rubrica } from "@/lib/avaliacao-classificacao";

const db = supabase as any;

/**
 * Carrega as rubricas (presets compartilhados + custom da clínica) e o vínculo
 * teste → rubrica por organização (tabela teste_rubrica). O catálogo de testes é
 * compartilhado e não pode ser escrito pela clínica, então a escolha da rubrica
 * de cada teste fica nessa tabela por-org.
 */
export function useRubricas() {
  const { data: rubricas = [], isLoading } = useQuery({
    queryKey: ["rubricas-classificacao"],
    queryFn: async () => {
      const { data, error } = await db
        .from("rubricas_classificacao")
        .select("id, org_id, slug, nome, base, faixas, is_preset")
        .order("is_preset", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Rubrica[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["teste-rubrica-map"],
    queryFn: async () => {
      const { data, error } = await db.from("teste_rubrica").select("teste_id, rubrica_id");
      if (error) throw error;
      return (data ?? []) as { teste_id: string; rubrica_id: string | null }[];
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
    const padrao = bySlug.get(RUBRICA_PADRAO.slug ?? "") ?? RUBRICA_PADRAO;
    const testeMap = new Map<string, string>();
    for (const v of vinculos) if (v.rubrica_id) testeMap.set(v.teste_id, v.rubrica_id);

    /** Rubrica direto por id (cai no preset padrão). */
    const resolver = (rubricaId?: string | null): Rubrica =>
      (rubricaId ? byId.get(rubricaId) : null) ?? padrao;
    /** Rubrica de um teste pelo vínculo da organização (cai no preset padrão). */
    const rubricaDeTeste = (testeId?: string | null): Rubrica =>
      resolver(testeId ? testeMap.get(testeId) : null);
    /** Id da rubrica vinculada a um teste (para exibir a seleção atual). */
    const rubricaIdDeTeste = (testeId?: string | null): string | null =>
      (testeId ? testeMap.get(testeId) : null) ?? null;

    return { rubricas: lista, byId, bySlug, resolver, rubricaDeTeste, rubricaIdDeTeste, isLoading };
  }, [rubricas, vinculos, isLoading]);
}

/**
 * Salva (upsert) a rubrica escolhida para um teste, na organização atual.
 * O org_id é preenchido pelo default my_org_id() da coluna — não vai no payload.
 */
export async function salvarRubricaDeTeste(testeId: string, rubricaId: string | null): Promise<void> {
  const { error } = await db.from("teste_rubrica").upsert(
    { teste_id: testeId, rubrica_id: rubricaId, updated_at: new Date().toISOString() },
    { onConflict: "org_id,teste_id" },
  );
  if (error) throw error;
}
