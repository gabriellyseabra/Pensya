import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/shared/ComingSoon";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/ia")({
  component: () => (
    <ComingSoon
      title="IA & Automações"
      description="Configuração de modelos, prompts e automações inteligentes"
      icon={Brain}
      fase="Fase 4"
    />
  ),
});
