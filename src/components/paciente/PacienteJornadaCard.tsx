import { Link, useParams } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight, MapPin } from "lucide-react";
import { usePacienteCompletude, ETAPAS } from "@/lib/paciente-completude";
import { cn } from "@/lib/utils";

/**
 * Jornada do paciente + medidor de completude do cadastro.
 * Mostra em que etapa o caso está (Cadastro → Anamnese → Avaliação → Plano →
 * Acompanhamento) e o que falta preencher, com atalhos. Some quando completo.
 */
export function PacienteJornadaCard({ pacienteId }: { pacienteId: string }) {
  const params = useParams({ strict: false }) as { id?: string };
  const id = params.id ?? pacienteId;
  const { carregado, pct, etapaAtual, etapasFeitas, pendencias } = usePacienteCompletude(pacienteId);

  if (!carregado) return null;
  const tudoFeito = pendencias.length === 0 && pct === 100;
  if (tudoFeito) return null;

  return (
    <Card className="glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Stepper da jornada */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {ETAPAS.map((e, i) => {
            const feita = etapasFeitas[e.key];
            const atual = e.key === etapaAtual;
            return (
              <div key={e.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
                <span
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
                    atual
                      ? "bg-brand/10 text-brand ring-1 ring-brand/30"
                      : feita
                        ? "text-emerald-600"
                        : "text-muted-foreground/60",
                  )}
                >
                  {feita ? <CheckCircle2 className="h-3 w-3" /> : atual ? <MapPin className="h-3 w-3" /> : null}
                  {e.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Completude do cadastro */}
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 w-24" />
          <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
            cadastro {pct}%
          </span>
        </div>
      </div>

      {pendencias.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
          {pendencias.map((p) => (
            <Link
              key={p.key}
              to="/pacientes/$id"
              params={{ id }}
              search={p.sub ? { aba: p.aba, sub: p.sub } : ({ aba: p.aba } as any)}
              className="rounded-full border border-dashed px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-brand/50 hover:bg-brand/5 hover:text-foreground"
            >
              {p.label} →
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
