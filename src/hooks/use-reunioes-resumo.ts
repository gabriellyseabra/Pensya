import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export type ReuniaoResumo = {
  id: string;
  tipo: "pais" | "escola" | "equipe" | "outro";
  data_reuniao: string;
  decisoes?: string | null;
  ata?: string | null;
  status: string;
};

const LIMIAR_DIAS_ALERTA = 90;

/**
 * Última reunião de cada tipo (escola e equipe), com a mesma janela de alerta
 * (≥90 dias) já usada para o card de reunião escolar em ResumoTab.
 */
export function useReunioesResumo(pacienteId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["reunioes-resumo", pacienteId],
    queryFn: async () => {
      const [escola, equipe] = await Promise.all([
        supabase.from("reunioes" as any).select("id, tipo, data_reuniao, decisoes, ata, status").eq("paciente_id", pacienteId).eq("tipo", "escola").order("data_reuniao", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("reunioes" as any).select("id, tipo, data_reuniao, decisoes, ata, status").eq("paciente_id", pacienteId).eq("tipo", "equipe").order("data_reuniao", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        ultimaEscola: (escola.data ?? null) as ReuniaoResumo | null,
        ultimaEquipe: (equipe.data ?? null) as ReuniaoResumo | null,
      };
    },
  });

  const diasDesdeEscola = data?.ultimaEscola?.data_reuniao ? differenceInDays(new Date(), parseISO(data.ultimaEscola.data_reuniao)) : null;
  const diasDesdeEquipe = data?.ultimaEquipe?.data_reuniao ? differenceInDays(new Date(), parseISO(data.ultimaEquipe.data_reuniao)) : null;

  return {
    isLoading,
    ultimaEscola: data?.ultimaEscola ?? null,
    ultimaEquipe: data?.ultimaEquipe ?? null,
    diasDesdeEscola,
    diasDesdeEquipe,
    alertaEscola: diasDesdeEscola == null || diasDesdeEscola >= LIMIAR_DIAS_ALERTA,
    alertaEquipe: diasDesdeEquipe == null || diasDesdeEquipe >= LIMIAR_DIAS_ALERTA,
  };
}
