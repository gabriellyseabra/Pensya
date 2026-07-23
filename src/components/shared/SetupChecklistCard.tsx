import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, X, Rocket } from "lucide-react";
import { useSetupChecklist, dismissSetup } from "@/lib/setup-checklist";
import { cn } from "@/lib/utils";

/**
 * "Primeiros passos" — guia de configuração inicial no dashboard.
 * Auto-oculta quando tudo está feito ou quando a pessoa dispensa.
 */
export function SetupChecklistCard() {
  const { itens, feitos, pct, completo, carregado, dismissed } = useSetupChecklist();
  const [oculto, setOculto] = useState(false);

  if (dismissed || oculto || !carregado || completo) return null;

  const proximo = itens.find((i) => !i.done);

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
              {feitos} de {itens.length} concluídos — deixe a clínica com a sua cara
            </p>
          </div>
        </div>
        {pct >= 50 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            title="Dispensar guia"
            onClick={() => { dismissSetup(); setOculto(true); }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Progress value={pct} className="mb-4 h-2" />

      <div className="grid gap-1.5 sm:grid-cols-2">
        {itens.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "group flex items-start gap-2.5 rounded-xl p-2.5 transition",
              item.done ? "opacity-60" : "hover:bg-muted/60",
              !item.done && item.key === proximo?.key && "bg-brand/5 ring-1 ring-brand/20",
            )}
          >
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium leading-tight", item.done && "line-through decoration-muted-foreground/40")}>
                {item.label}
              </span>
              {!item.done && (
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {item.descricao}
                </span>
              )}
            </span>
            {!item.done && (
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
