import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/shared/ComingSoon";
import { Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/protocolos")({
  component: () => (
    <ComingSoon
      title="Biblioteca de Protocolos"
      description="Protocolos clínicos vinculados a hipóteses, instrumentos e domínios"
      icon={Workflow}
      fase="Fase 3"
    />
  ),
});
