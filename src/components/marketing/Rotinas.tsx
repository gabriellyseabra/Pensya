import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, Minus, Plus, RefreshCw, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { periodoAtual, rotuloPeriodo } from "@/lib/marketing-periodos";
import { CADENCIA_LABEL, type Cadencia, type MktFunil, type MktRotina, type MktRotinaExecucao } from "./types";

const CADENCIA_ORDER: Cadencia[] = ["semanal", "mensal", "bimestral"];

export function Rotinas() {
  const qc = useQueryClient();
  const invalidar = () => invalidarMarketing(qc);

  const { data: funis } = useQuery({
    queryKey: ["mkt-funis"],
    queryFn: async () =>
      ((await supabase.from("marketing_funis").select("*").eq("ativo", true).order("ordem")).data ?? []) as unknown as MktFunil[],
  });
  const { data: rotinas } = useQuery({
    queryKey: ["mkt-rotinas"],
    queryFn: async () =>
      ((await supabase.from("marketing_rotinas").select("*").eq("ativo", true).order("ordem")).data ?? []) as MktRotina[],
  });

  // Períodos atuais das 3 cadências — buscamos as execuções desses períodos de uma vez.
  const periodosAtuais = useMemo(
    () => Array.from(new Set(CADENCIA_ORDER.map((c) => periodoAtual(c)))),
    [],
  );
  const { data: execucoes } = useQuery({
    queryKey: ["mkt-rotina-execucoes", ...periodosAtuais],
    queryFn: async () =>
      ((await supabase.from("marketing_rotina_execucoes").select("*").in("periodo", periodosAtuais)).data ?? []) as MktRotinaExecucao[],
  });

  const execDe = (rotina: MktRotina): MktRotinaExecucao | undefined => {
    const per = periodoAtual(rotina.cadencia as Cadencia);
    return (execucoes ?? []).find((e) => e.rotina_id === rotina.id && e.periodo === per);
  };
  const estaFeito = (rotina: MktRotina): boolean => {
    const ex = execDe(rotina);
    return !!ex && (ex.feito || ex.quantidade >= rotina.meta_qtd);
  };

  const setExecucao = useMutation({
    mutationFn: async ({ rotina, quantidade }: { rotina: MktRotina; quantidade: number }) => {
      const periodo = periodoAtual(rotina.cadencia as Cadencia);
      const qtd = Math.max(0, Math.min(quantidade, rotina.meta_qtd));
      const feito = qtd >= rotina.meta_qtd;
      const { error } = await supabase
        .from("marketing_rotina_execucoes")
        .upsert(
          { rotina_id: rotina.id, periodo, quantidade: qtd, feito, feito_em: feito ? new Date().toISOString() : null },
          { onConflict: "rotina_id,periodo" },
        );
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast.error(e.message),
  });

  const limpar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketing_rotina_execucoes").delete().in("periodo", periodosAtuais);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rotinas do período reiniciadas"); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Agrupa por funil, preservando a ordem dos funis.
  const grupos = useMemo(() => {
    const byFunil = new Map<string | null, MktRotina[]>();
    for (const r of rotinas ?? []) {
      const k = r.funil_id ?? null;
      if (!byFunil.has(k)) byFunil.set(k, []);
      byFunil.get(k)!.push(r);
    }
    const ordered: { funil?: MktFunil; itens: MktRotina[] }[] = [];
    for (const f of funis ?? []) {
      const itens = byFunil.get(f.id);
      if (itens?.length) ordered.push({ funil: f, itens });
    }
    const semFunil = byFunil.get(null);
    if (semFunil?.length) ordered.push({ itens: semFunil });
    return ordered;
  }, [rotinas, funis]);

  const total = rotinas?.length ?? 0;
  const feitas = (rotinas ?? []).filter(estaFeito).length;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl gradient-brand text-white">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Rotinas do período</p>
              <p className="text-xs text-muted-foreground">
                {feitas} de {total} concluídas · {rotuloPeriodo("semanal")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block w-40">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Progresso</span><span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full gradient-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reiniciar período</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reiniciar rotinas do período?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Desmarca todas as rotinas do período atual (semana/mês/bimestre). O histórico de períodos anteriores é mantido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => limpar.mutate()}>Reiniciar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g, gi) => {
          const feitasG = g.itens.filter(estaFeito).length;
          return (
            <Card key={g.funil?.id ?? `sem-${gi}`} className="glass card-lift">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {g.funil && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.funil.cor }} />}
                    {g.funil?.nome ?? "Outras rotinas"}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{feitasG}/{g.itens.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {g.itens.map((r) => {
                  const ex = execDe(r);
                  const qtd = ex?.quantidade ?? 0;
                  const feito = estaFeito(r);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${feito ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60"}`}
                    >
                      <button
                        onClick={() => setExecucao.mutate({ rotina: r, quantidade: feito ? 0 : r.meta_qtd })}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-brand"}`}
                      >
                        {feito && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug ${feito ? "text-muted-foreground line-through" : ""}`}>{r.titulo}</p>
                        <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
                          {CADENCIA_LABEL[r.cadencia as Cadencia]}{r.meta_qtd > 1 ? ` · ${r.meta_qtd}x` : ""}
                        </Badge>
                      </div>
                      {r.meta_qtd > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setExecucao.mutate({ rotina: r, quantidade: qtd - 1 })}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-40"
                            disabled={qtd <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-9 text-center text-xs tabular-nums">{qtd}/{r.meta_qtd}</span>
                          <button
                            onClick={() => setExecucao.mutate({ rotina: r, quantidade: qtd + 1 })}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent disabled:opacity-40"
                            disabled={qtd >= r.meta_qtd}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {grupos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhuma rotina cadastrada.
        </div>
      )}
    </div>
  );
}
