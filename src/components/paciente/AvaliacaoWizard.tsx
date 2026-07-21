import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { AnamneseHub } from "@/components/paciente/anamnese/AnamneseHub";
import { RaciocinioClinicoTab } from "@/components/paciente/RaciocinioClinicoTab";
import { VisaoGeralAvaliacao } from "@/components/paciente/avaliacao/VisaoGeralAvaliacao";
import { TestagemResultados } from "@/components/paciente/avaliacao/TestagemResultados";

/**
 * Wizard de Avaliação — unifica em um fluxo único todas as etapas
 * que antes eram abas separadas.
 *
 * Reaproveita componentes existentes sem mudar lógica interna.
 */
export function AvaliacaoWizard({ pacienteId, onNavigateToTab }: { pacienteId: string; onNavigateToTab?: (tab: string, subTab?: string) => void }) {
  const steps = [
    {
      key: "visao-geral", label: "Visão Geral & Raciocínio",
      render: () => (
        <div className="space-y-8">
          <VisaoGeralAvaliacao pacienteId={pacienteId} onNavigateToStep={(i) => setActive(i)} onNavigateToTab={onNavigateToTab} />
          <div>
            <h3 className="text-base font-semibold mb-3">Raciocínio clínico</h3>
            <RaciocinioClinicoTab pacienteId={pacienteId} />
          </div>
        </div>
      ),
    },
    { key: "anamnese", label: "Anamnese", render: () => <AnamneseHub pacienteId={pacienteId} /> },
    { key: "testagem", label: "Testagem & Resultados", render: () => <TestagemResultados pacienteId={pacienteId} /> },
  ];
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-4">
      <Card className="glass p-3 sm:p-4">
        <ol className="flex items-center gap-2 overflow-x-auto">
          {steps.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={s.key} className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    current && "gradient-brand text-brand-foreground shadow-soft",
                    done && !current && "bg-emerald-500/10 text-emerald-600",
                    !current && !done && "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-background/40 text-[10px]">
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              </li>
            );
          })}
        </ol>
      </Card>

      <div>{steps[active].render()}</div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={active === 0}
          onClick={() => setActive((a) => Math.max(0, a - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Etapa {active + 1} de {steps.length}
        </span>
        <Button
          size="sm"
          disabled={active === steps.length - 1}
          onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
        >
          Próxima <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
