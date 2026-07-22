import { supabase } from "@/integrations/supabase/client";

export type FaltaPendente = { id: string; data_referencia: string; motivo: string | null };

/**
 * Reposições pendentes = faltas JUSTIFICADAS ainda não repostas.
 * Falta não justificada NÃO gera reposição.
 */
export async function listarFaltasPendentes(pacienteId: string): Promise<FaltaPendente[]> {
  const { data } = await supabase
    .from("frequencia")
    .select("id, data_referencia, motivo")
    .eq("paciente_id", pacienteId)
    .eq("tipo", "falta_justificada")
    .is("reposto_em", null)
    .order("data_referencia", { ascending: true });
  return (data ?? []) as FaltaPendente[];
}

/**
 * Marca uma falta justificada como reposta. Se `faltaId` for informado, repõe
 * aquela falta específica; senão, repõe a mais antiga pendente do paciente.
 */
export async function consumirReposicaoPendente(
  pacienteId: string,
  dataReposicao: string,
  faltaId?: string | null,
) {
  let alvo = faltaId ?? null;
  if (!alvo) {
    const pendentes = await listarFaltasPendentes(pacienteId);
    alvo = pendentes[0]?.id ?? null;
  }
  if (alvo) {
    await supabase.from("frequencia").update({ reposto_em: dataReposicao }).eq("id", alvo);
  }
}

/** Uma falta só conta como reposição pendente se for justificada e não reposta. */
export function ehReposicaoPendente(r: { tipo?: string | null; reposto_em?: string | null }): boolean {
  return r.tipo === "falta_justificada" && !r.reposto_em;
}
