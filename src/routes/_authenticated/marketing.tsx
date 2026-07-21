import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, GitBranch, Megaphone, FileText, Filter, Compass, ListChecks } from "lucide-react";
import { DashboardMarketing } from "@/components/marketing/DashboardMarketing";
import { Estrategia } from "@/components/marketing/Estrategia";
import { Rotinas } from "@/components/marketing/Rotinas";
import { Funil } from "@/components/marketing/Funil";
import { Pipeline } from "@/components/marketing/Pipeline";
import { Campanhas } from "@/components/marketing/Campanhas";
import { Scripts } from "@/components/marketing/Scripts";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
});

const GRUPOS = [
  { key: "visao", label: "Painel", icon: LayoutDashboard, render: () => <DashboardMarketing /> },
  { key: "estrategia", label: "Estratégia", icon: Compass, render: () => <Estrategia /> },
  { key: "rotinas", label: "Rotinas", icon: ListChecks, render: () => <Rotinas /> },
  { key: "pipeline", label: "Pipeline", icon: GitBranch, render: () => <Pipeline /> },
  { key: "funil", label: "Funil", icon: Filter, render: () => <Funil /> },
  { key: "campanhas", label: "Campanhas", icon: Megaphone, render: () => <Campanhas /> },
  { key: "scripts", label: "Scripts", icon: FileText, render: () => <Scripts /> },
];

function MarketingPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={Megaphone}
        eyebrow="Crescimento"
        title="Marketing"
        description="Pipeline de leads, campanhas e scripts para o time comercial girar mais rápido."
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
