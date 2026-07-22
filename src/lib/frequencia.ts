import { supabase } from "@/integrations/supabase/client";

/**
 * Reposições pendentes = faltas JUSTIFICADAS ainda não repostas.
 * Falta não justificada NÃO gera reposição.
 *
 * Ao lançar uma sessão de reposição, consumimos a falta justificada pendente
 * mais antiga do paciente (marcando reposto_em), para o contador de reposições
 * pendentes se atualizar.
 */
export async function consumirReposicaoPendente(pacienteId: string, dataReposicao: string) {
  const { data: falta } = await supabase
    .from("frequencia")
    .select("id")
    .eq("paciente_id", pacienteId)
    .eq("tipo", "falta_justificada")
    .is("reposto_em", null)
    .order("data_referencia", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (falta?.id) {
    await supabase
      .from("frequencia")
      .update({ reposto_em: dataReposicao })
      .eq("id", falta.id);
  }
}

/** Uma falta só conta como reposição pendente se for justificada e não reposta. */
export function ehReposicaoPendente(r: { tipo?: string | null; reposto_em?: string | null }): boolean {
  return r.tipo === "falta_justificada" && !r.reposto_em;
}
