import { useState } from "react";
import { useNavigate, type NavigateOptions } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  GraduationCap,
  PartyPopper,
  ListChecks,
} from "lucide-react";
import { useTutorialGuiado, type PassoTutorial } from "@/lib/tutorial-guiado";
import { Mockup } from "@/components/shared/AjudaMockups";
import { cn } from "@/lib/utils";

/**
 * "Conheça o Pensya" — tour guiado pelo sistema usando a paciente modelo.
 * Clicar num passo abre uma janela de preview que explica o que a pessoa vai
 * encontrar na tela (com ilustração e a função de cada item) ANTES de ir para
 * lá. Progresso individual por pessoa; some ao dispensar ou concluir, e pode
 * ser reaberto pela Central de Ajuda.
 */
export function TutorialGuiadoCard() {
  const navigate = useNavigate();
  const { passos, feitos, pct, completo, dispensado, carregado, marcarPasso, dispensar } =
    useTutorialGuiado();
  const [preview, setPreview] = useState<PassoTutorial | null>(null);

  if (!carregado || dispensado) return null;

  const proximo = passos.find((p) => !p.done);

  const irParaPagina = (p: PassoTutorial) => {
    marcarPasso(p.key);
    setPreview(null);
    navigate({ to: p.to, params: p.params, search: p.search } as NavigateOptions);
  };

  if (completo) {
    return (
      <Card className="glass relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Tutorial concluído! 🎉</h3>
              <p className="text-xs text-muted-foreground">
                Você conheceu as principais áreas do Pensya. A Central de Ajuda fica no menu sempre
                que precisar.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={dispensar}>
            Ocultar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Conheça o Pensya</h3>
              <p className="text-xs text-muted-foreground">
                {feitos} de {passos.length} passos — clique num passo para ver o que tem na tela
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            title="Dispensar tutorial (você pode reabrir pela Central de Ajuda)"
            onClick={dispensar}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={pct} className="mb-4 h-2" />

        <div className="grid gap-1.5 sm:grid-cols-2">
          {passos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreview(p)}
              className={cn(
                "group flex items-start gap-2.5 rounded-xl p-2.5 text-left transition",
                p.done ? "opacity-60" : "hover:bg-muted/60",
                !p.done && p.key === proximo?.key && "bg-brand/5 ring-1 ring-brand/20",
              )}
            >
              {p.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium leading-tight",
                    p.done && "line-through decoration-muted-foreground/40",
                  )}
                >
                  {p.titulo}
                </span>
                {!p.done && (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {p.descricao}
                  </span>
                )}
              </span>
              {!p.done && (
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              )}
            </button>
          ))}
        </div>
      </Card>

      <PassoPreviewDialog
        passo={preview}
        onClose={() => setPreview(null)}
        onIr={() => preview && irParaPagina(preview)}
      />
    </>
  );
}

function PassoPreviewDialog({
  passo,
  onClose,
  onIr,
}: {
  passo: PassoTutorial | null;
  onClose: () => void;
  onIr: () => void;
}) {
  return (
    <Dialog open={!!passo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-h-[90vh] max-w-lg overflow-y-auto">
        {passo && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-2.5 text-left">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full gradient-brand text-xs font-semibold text-brand-foreground">
                  <GraduationCap className="h-4 w-4" />
                </span>
                {passo.titulo}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {passo.resumo && (
                <p className="text-sm leading-relaxed text-muted-foreground">{passo.resumo}</p>
              )}

              {passo.mockup && <Mockup id={passo.mockup} />}

              {passo.itens && passo.itens.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" /> O que tem nesta tela
                  </p>
                  <div className="space-y-2">
                    {passo.itens.map((it, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-snug">
                          <span className="font-medium">{it.titulo}</span>{" "}
                          <span className="text-muted-foreground">— {it.descricao}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={onClose}>
                Fechar
              </Button>
              <Button className="gradient-brand text-brand-foreground" onClick={onIr}>
                Ir para a página <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
