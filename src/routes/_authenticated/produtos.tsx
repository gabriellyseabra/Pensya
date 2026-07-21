import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/shared/ComingSoon";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: () => (
    <ComingSoon
      title="Produtos"
      description="Catálogo de serviços, pacotes e modalidades"
      icon={Package}
      fase="Fase 5"
    />
  ),
});
