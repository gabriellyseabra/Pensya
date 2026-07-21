import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, TrendingUp, TrendingDown, Pencil } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { toast } from "sonner";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { MktIcon } from "./mkt-icons";
import type { MktIndicador } from "./types";

type Linha = { indicador: MktIndicador; atual: number; anterior: number; aviso?: string };
type CanalMarketing = { id: string; nome: string; tipo_origem: string | null };

async function count(table: string, coluna: string, ini: string, fim: string, extra?: (q: any) => any) {
  let q = supabase.from(table as any).select("*", { count: "exact", head: true }).gte(coluna, ini).lte(coluna, fim);
  if (extra) q = extra(q);
  const { count: c } = await q;
  return c ?? 0;
}

export function IndicadoresGerais() {
  const qc = useQueryClient();
  const [editar, setEditar] = useState<MktIndicador | null>(null);
  const [valorInput, setValorInput] = useState("");

  const compAtual = startOfMonth(new Date());
  const compAnterior = startOfMonth(subMonths(new Date(), 1));
  const compAtualStr = format(compAtual, "yyyy-MM-dd");

  const { data: linhas } = useQuery({
    queryKey: ["mkt-indicadores", "mkt-indicador-valores", compAtualStr],
    queryFn: async (): Promise<Linha[]> => {
      const { data: indicadores } = await supabase
        .from("marketing_indicadores").select("*").eq("ativo", true).order("ordem");
      const { data: canais } = await supabase.from("canais_marketing").select("id, nome, tipo_origem");

      const canalIdPorTipoOrigem = (tipoOrigem: string) =>
        ((canais ?? []) as CanalMarketing[]).find((canal) => canal.tipo_origem === tipoOrigem)?.id;

      const parseFonteCanal = (fonte: string | null) => {
        if (!fonte?.startsWith("canal:")) return null;
        return fonte.replace("canal:", "");
      };

      const meses = [compAtual, compAnterior].map((m) => ({
        ini: startOfMonth(m).toISOString(),
        fim: endOfMonth(m).toISOString(),
        iniDate: format(startOfMonth(m), "yyyy-MM-dd"),
      }));

      async function valorAuto(fonte: string | null, mi: number): Promise<{ valor: number; aviso?: string }> {
        const { ini, fim } = meses[mi];
        if (fonte === "pacientes_novos") return { valor: await count("pacientes", "created_at", ini, fim) };
        if (fonte === "interacoes_whatsapp") {
          return { valor: await count("lead_interacoes", "created_at", ini, fim, (q) => q.eq("tipo", "whatsapp")) };
        }

        const tipoOrigem = parseFonteCanal(fonte);
        if (tipoOrigem) {
          const canalId = canalIdPorTipoOrigem(tipoOrigem);
          if (!canalId) {
            return { valor: 0, aviso: `Configure um canal com tipo de origem "${tipoOrigem}".` };
          }
          return { valor: await count("leads", "entrou_em", ini, fim, (q) => q.eq("canal_id", canalId)) };
        }

        return { valor: 0, aviso: "Fonte automática não configurada." };
      }

      // valores manuais dos dois meses
      const { data: valores } = await supabase
        .from("marketing_indicador_valores")
        .select("indicador_id, competencia, valor")
        .in("competencia", [meses[0].iniDate, meses[1].iniDate]);
      const valorManual = (id: string, mi: number) =>
        Number((valores ?? []).find((v) => v.indicador_id === id && v.competencia === meses[mi].iniDate)?.valor ?? 0);

      const out: Linha[] = [];
      for (const ind of indicadores ?? []) {
        if (ind.tipo === "auto") {
          const atual = await valorAuto(ind.fonte, 0);
          const anterior = await valorAuto(ind.fonte, 1);
          out.push({ indicador: ind, atual: atual.valor, anterior: anterior.valor, aviso: atual.aviso ?? anterior.aviso });
        } else {
          out.push({ indicador: ind, atual: valorManual(ind.id, 0), anterior: valorManual(ind.id, 1) });
        }
      }
      return out;
    },
  });

  const salvarValor = useMutation({
    mutationFn: async ({ indicadorId, valor }: { indicadorId: string; valor: number }) => {
      const { error } = await supabase
        .from("marketing_indicador_valores")
        .upsert({ indicador_id: indicadorId, competencia: compAtualStr, valor }, { onConflict: "indicador_id,competencia" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Indicador atualizado"); setEditar(null); invalidarMarketing(qc); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Indicadores gerais — {format(compAtual, "MMMM 'de' yyyy")}</h3>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {(linhas ?? []).map(({ indicador, atual, anterior, aviso }) => {
          const delta = anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;
          const subiu = delta != null && delta >= 0;
          return (
            <Card key={indicador.id} className="group glass card-lift relative">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${indicador.cor}20`, color: indicador.cor }}>
                    <MktIcon nome={indicador.icone} className="h-4 w-4" />
                  </span>
                  <p className="text-[11px] leading-tight text-muted-foreground">{indicador.nome}</p>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-2xl font-semibold">{atual}</p>
                  {delta != null && (
                    <span className={`flex items-center gap-0.5 text-xs ${subiu ? "text-emerald-600" : "text-destructive"}`}>
                      {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {subiu ? "+" : ""}{delta}%
                    </span>
                  )}
                </div>
                {indicador.tipo === "manual" && (
                  <button
                    className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    onClick={() => { setEditar(indicador); setValorInput(String(atual || "")); }}
                    title="Lançar valor do mês"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {aviso && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-700">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{aviso}</span>
                  </div>
                )}
                {indicador.tipo === "manual" && (
                  <span className="absolute bottom-1.5 right-2 text-[9px] uppercase tracking-wide text-muted-foreground/60">manual</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editar} onOpenChange={(v) => !v && setEditar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editar?.nome} — {format(compAtual, "MMMM/yyyy")}</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Valor do mês</Label>
            <Input type="number" value={valorInput} onChange={(e) => setValorInput(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditar(null)}>Cancelar</Button>
            <Button
              className="gradient-brand text-white"
              disabled={salvarValor.isPending}
              onClick={() => editar && salvarValor.mutate({ indicadorId: editar.id, valor: Number(valorInput || 0) })}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
