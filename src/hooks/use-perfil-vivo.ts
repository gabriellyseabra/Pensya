import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PerfilVivo = {
  // contextos
  reforcadores?: { descricao: string; intensidade?: "baixa" | "media" | "alta" }[];
  barreiras?: { descricao: string }[];
  interesses?: string[];
  preferencias?: string[];
  potencializadores?: string[];
  estrategias_funcionam?: string[];
  estrategias_nao_funcionam?: string[];
  objetivos_generalizacao?: string[];
  hipoteses_ativas?: string[];

  contexto_social?: { rotina?: string; suporte_familiar?: string; ambiente_social?: string; observacoes?: string };
  contexto_escolar_detalhes?: { ambiente?: string; suporte_pedagogico?: string; dificuldades?: string; observacoes?: string };
  contexto_clinico?: { medicacoes?: string; comorbidades?: string; profissionais?: string; observacoes?: string };

  // Observações gerais consolidadas (substitui as observações repetidas por contexto)
  observacoes_gerais?: string;

  perfil_cif?: {
    funcoes_corporais?: string;
    estruturas_corporais?: string;
    atividade_participacao?: string;
    fatores_ambientais?: string;
    fatores_pessoais?: string;
  };
  atualizado_em?: string;
};

const KEY = (id: string) => ["paciente-perfil-vivo", id] as const;

export function usePerfilVivo(pacienteId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(pacienteId),
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, perfil_vivo")
        .eq("id", pacienteId)
        .maybeSingle();
      return (data?.perfil_vivo ?? {}) as PerfilVivo;
    },
  });

  const save = useMutation({
    mutationFn: async (next: PerfilVivo) => {
      const payload = { ...next, atualizado_em: new Date().toISOString() };
      const { error } = await supabase
        .from("pacientes")
        .update({ perfil_vivo: payload as any })
        .eq("id", pacienteId);
      if (error) throw error;
      return payload;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(pacienteId) }),
    onError: (e: any) => toast.error("Erro ao salvar perfil: " + e.message),
  });

  /**
   * Merge parcial — útil para a Anamnese IA aplicar achados sem sobrescrever
   * o que a profissional já preencheu.
   */
  const merge = useMutation({
    mutationFn: async (partial: Partial<PerfilVivo>) => {
      const current = (query.data ?? {}) as PerfilVivo;
      const merged: PerfilVivo = {
        ...current,
        ...partial,
        // objetos aninhados: merge campo-a-campo (sem isso, partial.contexto_social
        // sobrescreveria o objeto inteiro e apagaria campos não enviados)
        contexto_social: { ...current.contexto_social, ...partial.contexto_social },
        contexto_clinico: { ...current.contexto_clinico, ...partial.contexto_clinico },
        contexto_escolar_detalhes: { ...current.contexto_escolar_detalhes, ...partial.contexto_escolar_detalhes },
        // arrays: dedupe por valor
        interesses: dedupe([...(current.interesses ?? []), ...(partial.interesses ?? [])]),
        preferencias: dedupe([...(current.preferencias ?? []), ...(partial.preferencias ?? [])]),
        potencializadores: dedupe([...(current.potencializadores ?? []), ...(partial.potencializadores ?? [])]),
        estrategias_funcionam: dedupe([...(current.estrategias_funcionam ?? []), ...(partial.estrategias_funcionam ?? [])]),
        estrategias_nao_funcionam: dedupe([...(current.estrategias_nao_funcionam ?? []), ...(partial.estrategias_nao_funcionam ?? [])]),
        objetivos_generalizacao: dedupe([...(current.objetivos_generalizacao ?? []), ...(partial.objetivos_generalizacao ?? [])]),
        hipoteses_ativas: dedupe([...(current.hipoteses_ativas ?? []), ...(partial.hipoteses_ativas ?? [])]),
        reforcadores: dedupeBy([...(current.reforcadores ?? []), ...(partial.reforcadores ?? [])], (x) => x.descricao),
        barreiras: dedupeBy([...(current.barreiras ?? []), ...(partial.barreiras ?? [])], (x) => x.descricao),
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await supabase.from("pacientes").update({ perfil_vivo: merged as any }).eq("id", pacienteId);
      if (error) throw error;
      return merged;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(pacienteId) }),
    onError: (e: any) => toast.error("Erro ao mesclar perfil: " + e.message),
  });

  return { perfil: query.data ?? ({} as PerfilVivo), isLoading: query.isLoading, save, merge };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter(Boolean)));
}
function dedupeBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = key(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
