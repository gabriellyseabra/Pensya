import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { CentralImportacao } from "@/components/shared/CentralImportacao";

export const Route = createFileRoute("/_authenticated/importar")({
  component: ImportarPage,
});

function ImportarPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={Upload}
        eyebrow="Migração e carga de dados"
        title="Importação"
        description="Traga pacientes, prontuários antigos e histórico financeiro de outros sistemas ou planilhas."
        variant="dark"
      />
      <CentralImportacao />
    </div>
  );
}
