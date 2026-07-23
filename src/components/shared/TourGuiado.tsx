import { createContext, useContext, useState, type ReactNode } from "react";
import { useNavigate, type NavigateOptions } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mockup } from "@/components/shared/AjudaMockups";
import { useTutorialGuiado, type PassoTutorial } from "@/lib/tutorial-guiado";
import { GraduationCap, ArrowRight, ListChecks, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

/**
 * Tour guiado persistente "Conheça o Pensya".
 *
 * Diferente de um simples link, o tour vive acima das páginas (montado no
 * AppShell): ao ir para uma tela, uma barra flutuante continua acompanhando a
 * pessoa e abre a janela explicativa do PRÓXIMO passo antes de levá-la adiante.
 * Assim a explicação aparece antes de cada etapa, não só na primeira.
 */

type TourApi = {
  total: number;
  ativo: boolean;
  /** Começa do primeiro passo ainda não visto (ou do início). */
  iniciar: () => void;
  /** Começa de um passo específico. */
  iniciarEm: (index: number) => void;
};

const TourCtx = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const ctx = useContext(TourCtx);
  if (!ctx) throw new Error("useTour precisa estar dentro de <TourProvider>");
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { passos, marcarPasso } = useTutorialGuiado();
  const [index, setIndex] = useState(0);
  const [ativo, setAtivo] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);

  const total = passos.length;
  const passo: PassoTutorial | undefined = ativo ? passos[index] : undefined;

  const abrirEm = (i: number) => {
    if (i < 0 || i >= passos.length) {
      encerrar(true);
      return;
    }
    setIndex(i);
    setAtivo(true);
    setDialogAberto(true);
  };

  const iniciar = () => {
    const proximoNaoVisto = passos.findIndex((p) => !p.done);
    abrirEm(proximoNaoVisto >= 0 ? proximoNaoVisto : 0);
  };

  const encerrar = (concluido = false) => {
    setAtivo(false);
    setDialogAberto(false);
    if (concluido)
      toast.success("Tour concluído! 🎉 A ajuda fica sempre no ícone de boia, no topo.");
  };

  const irParaPagina = () => {
    if (!passo) return;
    marcarPasso(passo.key);
    setDialogAberto(false); // fecha a janela mas mantém o tour ativo (barra flutuante)
    navigate({ to: passo.to, params: passo.params, search: passo.search } as NavigateOptions);
  };

  const proximo = () => abrirEm(index + 1);

  return (
    <TourCtx.Provider value={{ total, ativo, iniciar, iniciarEm: abrirEm }}>
      {children}

      {/* Barra flutuante — acompanha a pessoa em todas as páginas */}
      {ativo && !dialogAberto && passo && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex max-w-full items-center gap-3 rounded-full bg-rail py-2 pl-4 pr-2 text-rail-foreground shadow-elegant">
            <GraduationCap className="h-4 w-4 shrink-0 text-rail-active" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                Tour · passo {index + 1} de {total}
              </p>
              <p className="truncate text-sm font-medium">{passo.titulo}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pl-1">
              {index > 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                  title="Voltar ao passo 1"
                  onClick={() => abrirEm(0)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setDialogAberto(true)}
              >
                Explicação
              </Button>
              <Button
                size="sm"
                className="h-8 bg-white/15 text-white hover:bg-white/25"
                onClick={proximo}
              >
                {index + 1 >= total ? "Concluir" : "Próximo"}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
                title="Sair do tour"
                onClick={() => encerrar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Janela explicativa do passo atual */}
      <Dialog open={dialogAberto} onOpenChange={(o) => !o && setDialogAberto(false)}>
        <DialogContent className="glass-strong max-h-[90vh] max-w-lg overflow-y-auto">
          {passo && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                    Passo {index + 1} de {total}
                  </p>
                  {index > 0 && (
                    <button
                      onClick={() => abrirEm(0)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-brand"
                    >
                      <RotateCcw className="h-3 w-3" /> Voltar ao passo 1
                    </button>
                  )}
                </div>
                <DialogTitle className="flex items-start gap-2.5 text-left">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full gradient-brand text-brand-foreground">
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

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-2">
                <Button
                  variant="ghost"
                  className="text-muted-foreground sm:order-1"
                  onClick={() => (index + 1 >= total ? encerrar(true) : proximo())}
                >
                  {index + 1 >= total ? "Encerrar" : "Pular etapa"}
                </Button>
                <Button
                  className="gradient-brand text-brand-foreground sm:order-2"
                  onClick={irParaPagina}
                >
                  Ir para a página <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TourCtx.Provider>
  );
}
