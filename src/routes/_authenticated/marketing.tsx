import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, GitBranch, FileText, Handshake } from "lucide-react";
import { DashboardMarketing } from "@/components/marketing/DashboardMarketing";
import { Pipeline } from "@/components/marketing/Pipeline";
import { Scripts } from "@/components/marketing/Scripts";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: ComercialPage,
});

// Estratégia, Rotinas, Funil e Campanhas ficam ocultas por enquanto —
// o foco do Comercial é o CRM: pipeline, métricas e scripts.
const GRUPOS = [
  { key: "visao", label: "Painel", icon: LayoutDashboard, render: () => <DashboardMarketing /> },
  { key: "pipeline", label: "Pipeline", icon: GitBranch, render: () => <Pipeline /> },
  { key: "scripts", label: "Scripts", icon: FileText, render: () => <Scripts /> },
];

function ComercialPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={Handshake}
        eyebrow="Crescimento"
        title="Comercial"
        description="CRM de leads: pipeline, conversão por canal, follow-ups e scripts de contato."
      />

      <Tabs defaultValue={GRUPOS[0].key}>
        <TabsList className="glass h-auto flex-wrap">
          {GRUPOS.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="gap-1.5">
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {GRUPOS.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {g.render()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
