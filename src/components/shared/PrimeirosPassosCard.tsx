import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  Rocket,
  Building2,
  GraduationCap,
} from "lucide-react";
import { useSetupChecklist, dismissSetup } from "@/lib/setup-checklist";
import { useTour } from "@/components/shared/TourGuiado";
import { cn } from "@/lib/utils";

/**
 * "Primeiros passos" — único card de onboarding do dashboard (substitui o
 * antigo checklist + o card do tour, que eram repetitivos).
 *
 * O 1º passo é SEMPRE configurar a identidade da clínica, em destaque no topo.
 * Ao final, um botão inicia o tour guiado "Conheça o Pensya".
 * Some quando a clínica já está configurada ou quando a pessoa dispensa.
 */
export function PrimeirosPassosCard() {
  const { itens, feitos, pct, completo, carregado, dismissed } = useSetupChecklist();
  const tour = useTour();
  const [oculto, setOculto] = useState(false);

  if (dismissed || oculto || !carregado || completo) return null;

  const identidade = itens.find((i) => i.key === "identidade");
  const restantes = itens.filter((i) => i.key !== "identidade");

  return (
    <Card className="glass relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Primeiros passos</h3>
            <p className="text-xs text-muted-foreground">
              {feitos} de {itens.length} concluídos — deixe a clínica pronta para usar
            </p>
          </div>
        </div>
        {pct >= 40 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            title="Dispensar"
            onClick={() => {
              dismissSetup();
              setOculto(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Progress value={pct} className="mb-4 h-2" />

      {/* 1º passo, sempre em destaque: identidade da clínica */}
      {identidade && (
        <Link to={identidade.href} className="group mb-3 block">
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3.5 transition-all group-hover:-translate-y-0.5",
              identidade.done
                ? "border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-400/5"
                : "border-brand/30 bg-brand/5 shadow-soft ring-1 ring-brand/10",
            )}
          >
            <div
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                identidade.done
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "gradient-brand text-brand-foreground",
              )}
            >
              {identidade.done ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!identidade.done && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                    Comece por aqui
                  </span>
                )}
                <p
                  className={cn(
                    "font-medium",
                    identidade.done &&
                      "text-muted-foreground line-through decoration-muted-foreground/40",
                  )}
                >
                  {identidade.label}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{identidade.descricao}</p>
            </div>
            {!identidade.done && (
              <ArrowRight className="h-4 w-4 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
        </Link>
      )}

      {/* Demais passos */}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {restantes.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "group flex items-start gap-2.5 rounded-xl p-2.5 transition",
              item.done ? "opacity-60" : "hover:bg-muted/60",
            )}
          >
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-medium leading-tight",
                  item.done && "line-through decoration-muted-foreground/40",
                )}
              >
                {item.label}
              </span>
              {!item.done && (
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {item.descricao}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>

      {/* Tour guiado — conhecer o sistema pela paciente modelo */}
      <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4 text-brand" />
          Prefere conhecer o sistema primeiro?
        </p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={tour.iniciar}>
          Fazer o tour guiado <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
