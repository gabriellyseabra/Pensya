import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PortalPaciente } from "@/lib/portal.functions";

type PortalCtx = {
  pacientes: PortalPaciente[];
  paciente: PortalPaciente;
  setPacienteId: (id: string) => void;
};

const Ctx = createContext<PortalCtx | null>(null);

const STORAGE_KEY = "portal-paciente-selecionado";

export function PortalProvider({ pacientes, children }: { pacientes: PortalPaciente[]; children: React.ReactNode }) {
  const [pacienteId, setPacienteId] = useState<string>(() => {
    if (typeof window === "undefined") return pacientes[0]?.paciente_id ?? "";
    const saved = localStorage.getItem(STORAGE_KEY);
    return pacientes.some((p) => p.paciente_id === saved) ? saved! : pacientes[0]?.paciente_id ?? "";
  });

  useEffect(() => {
    if (pacienteId) localStorage.setItem(STORAGE_KEY, pacienteId);
  }, [pacienteId]);

  const value = useMemo<PortalCtx>(() => {
    const paciente = pacientes.find((p) => p.paciente_id === pacienteId) ?? pacientes[0];
    return { pacientes, paciente, setPacienteId };
  }, [pacientes, pacienteId]);

  if (!value.paciente) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortal deve ser usado dentro de PortalProvider");
  return ctx;
}

export function primeiroNome(nome: string) {
  return nome.split(" ")[0] ?? nome;
}
