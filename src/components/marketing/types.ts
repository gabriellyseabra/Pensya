import type { Database } from "@/integrations/supabase/types";

export type Etapa = Database["public"]["Tables"]["pipeline_etapas"]["Row"];
export type Canal = Database["public"]["Tables"]["canais_marketing"]["Row"];
export type Campanha = Database["public"]["Tables"]["campanhas"]["Row"];
export type LeadInteracao = Database["public"]["Tables"]["lead_interacoes"]["Row"];
export type Script = Database["public"]["Tables"]["scripts"]["Row"];

// ===== Sistema de Marketing (camada estratégica) =====
export type MktObjetivo = Database["public"]["Tables"]["marketing_objetivos"]["Row"];
export type MktFunilAcao = Database["public"]["Tables"]["marketing_funil_acoes"]["Row"];
export type MktRotina = Database["public"]["Tables"]["marketing_rotinas"]["Row"];
export type MktRotinaExecucao = Database["public"]["Tables"]["marketing_rotina_execucoes"]["Row"];
export type MktIndicador = Database["public"]["Tables"]["marketing_indicadores"]["Row"];
export type MktIndicadorValor = Database["public"]["Tables"]["marketing_indicador_valores"]["Row"];
export type MktPrincipio = Database["public"]["Tables"]["marketing_principios"]["Row"];

export type MktEtapaChip = { label: string; cor: string };
export type MktFunil = Omit<Database["public"]["Tables"]["marketing_funis"]["Row"], "etapas"> & {
  etapas: MktEtapaChip[];
};

export type Cadencia = "semanal" | "mensal" | "bimestral";
export const CADENCIA_LABEL: Record<Cadencia, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  bimestral: "Bimestral",
};

export type Lead = Database["public"]["Tables"]["leads"]["Row"] & {
  canal?: Pick<Canal, "id" | "nome"> | null;
  campanha?: Pick<Campanha, "id" | "nome"> | null;
  responsavel?: { id: string; nome: string } | null;
};

export const CATEGORIAS_SCRIPT = [
  { value: "abordagem_inicial", label: "Abordagem inicial" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "agendamento", label: "Agendamento" },
  { value: "objecoes", label: "Objeções" },
  { value: "follow_up", label: "Follow-up" },
  { value: "pos_venda", label: "Pós-venda" },
  { value: "outro", label: "Outro" },
] as const;

export function labelCategoriaScript(v: string) {
  return CATEGORIAS_SCRIPT.find((c) => c.value === v)?.label ?? v;
}

export function currency(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
