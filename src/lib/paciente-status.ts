export const PACIENTE_STATUS = ["ativo", "pausado", "alta", "interrompido"] as const;

export type PacienteStatus = (typeof PACIENTE_STATUS)[number];

export const PACIENTE_STATUS_LABEL: Record<PacienteStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  alta: "Alta",
  // Tratamento interrompido pela família (não é alta clínica).
  interrompido: "Interrompido",
};
