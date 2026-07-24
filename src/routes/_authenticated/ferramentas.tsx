import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Wrench, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { GeradorGraficoAvaliacao } from "@/components/prontuario/GeradorGraficoAvaliacao";

export const Route = createFileRoute("/_authenticated/ferramentas")({
  component: FerramentasPage,
});

function FerramentasPage() {
  const [graficoOpen, setGraficoOpen] = useState(false);

  const ferramentas = [
    {
      key: "graficos",
      titulo: "Gerador de gráficos",
      descricao:
        "Monte gráficos do zero — por teste, área, instrumento ou tarefa clínica — com as cores da classificação. Barras, linha, radar ou pizza; exporta PNG para o laudo.",
      icon: BarChart3,
      onClick: () => setGraficoOpen(true),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={Wrench}
        eyebrow="Gestão"
        title="Ferramentas"
        description="Utilidades avulsas da clínica — independentes de um paciente ou avaliação específica."
        variant="brand"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ferramentas.map((f) => (
          <Card key={f.key} className="glass card-lift">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{f.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.descricao}</p>
              </div>
              <Button variant="outline" size="sm" className="self-start" onClick={f.onClick}>
                Abrir <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <GeradorGraficoAvaliacao open={graficoOpen} onOpenChange={setGraficoOpen} />
    </div>
  );
}
