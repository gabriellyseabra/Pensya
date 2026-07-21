import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { analisarCicloRegras, revisarCicloIA, aprovarRevisaoCiclo } from "@/lib/plano-ciclo.functions";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planoId: string;
};

const STATUS_OPTS = [
  { value: "ativa", label: "Manter ativa" },
  { value: "concluida", label: "Concluída" },
  { value: "suspensa", label: "Suspender" },
  { value: "revisada", label: "Revisada (substituir)" },
];

const TEND_ICON: Record<string, React.ReactNode> = {
  progresso: <TrendingUp className="h-3 w-3 text-emerald-600" />,
  regressao: <TrendingDown className="h-3 w-3 text-rose-600" />,
  estavel: <Minus className="h-3 w-3 text-amber-600" />,
  sem_dados: <Minus className="h-3 w-3 text-muted-foreground" />,
};

const SUGESTAO_TO_STATUS: Record<string, string> = {
  manter: "ativa",
  ajustar: "ativa",
  encerrar: "concluida",
  suspender: "suspensa",
};

export function RevisaoCicloDialog({ open, onOpenChange, planoId }: Props) {
  const qc = useQueryClient();
  const analisar = useServerFn(analisarCicloRegras);
  const rodarIA = useServerFn(revisarCicloIA);
  const aprovar = useServerFn(aprovarRevisaoCiclo);

  const [analise, setAnalise] = useState<any>(null);
  const [ia, setIa] = useState<any>(null);
  const [decisoes, setDecisoes] = useState<Record<string, { status: string; gas: string }>>({});
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setIa(null); setObs("");
    analisar({ data: { plano_id: planoId } })
      .then((r: any) => {
        setAnalise(r);
        const init: Record<string, { status: string; gas: string }> = {};
        for (const m of r.metas) {
          init[m.meta_id] = {
            status: SUGESTAO_TO_STATUS[m.sugestao] ?? "ativa",
            gas: m.gas_ultimo != null ? String(m.gas_ultimo) : "",
          };
        }
        setDecisoes(init);
      })
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, planoId]);

  async function aprofundarIA() {
    if (!analise) return;
    setIaLoading(true);
    try {
      const r = await rodarIA({ data: { plano_id: planoId, analise_regras: analise } });
      setIa(r);
      toast.success("Análise IA gerada");
    } catch (e: any) { toast.error(e.message); }
    finally { setIaLoading(false); }
  }

  async function salvarRevisao() {
    if (!analise) return;
    setSalvando(true);
    try {
      const decisoesArr = analise.metas.map((m: any) => ({
        meta_id: m.meta_id,
        novo_status: (decisoes[m.meta_id]?.status ?? "ativa") as any,
        nivel_gas_atingido: decisoes[m.meta_id]?.gas ? parseInt(decisoes[m.meta_id].gas, 10) : null,
      }));
      await aprovar({
        data: {
          plano_id: planoId,
          tipo: ia ? "ia" : "automatica_regras",
          resumo: analise,
          sugestoes: ia ?? undefined,
          observacao: obs || undefined,
          decisoes: decisoesArr,
        },
      });
      toast.success("Revisão aprovada");
      qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
      qc.invalidateQueries({ queryKey: ["plano", planoId] });
      qc.invalidateQueries({ queryKey: ["plano-ciclo-revisoes", planoId] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisão de ciclo</DialogTitle>
        </DialogHeader>

        {loading || !analise ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Analisando ciclo…
          </div>
        ) : (
          <div className="space-y-4">
            {analise.alertas?.length > 0 && (
              <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <CardContent className="p-3 space-y-1">
                  {analise.alertas.map((a: string, i: number) => (
                    <div key={i} className="text-xs text-amber-900 dark:text-amber-200 flex gap-2 items-start">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {a}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Análise determinística baseada nas pontuações registradas. Para uma análise narrativa clínica, use IA.
              </p>
              <Button size="sm" variant="outline" onClick={aprofundarIA} disabled={iaLoading}>
                {iaLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Aprofundar com IA
              </Button>
            </div>

            {ia?.sintese_clinica && (
              <Card className="border-brand/30 bg-brand/5">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-brand">Síntese clínica (IA)</p>
                  <p className="text-sm">{ia.sintese_clinica}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {analise.metas.map((m: any) => {
                const dec = decisoes[m.meta_id] ?? { status: "ativa", gas: "" };
                const iaDecisao = ia?.metas?.find((x: any) => x.meta_id === m.meta_id);
                return (
                  <Card key={m.meta_id} className="glass">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{m.titulo}</p>
                          <div className="mt-1 flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                            {m.dominio && <Badge variant="outline" className="text-[10px]">{m.dominio}</Badge>}
                            <span className="flex items-center gap-1">{TEND_ICON[m.tendencia]} {m.tendencia.replace("_", " ")}</span>
                            <span>{m.total_sessoes} sessões</span>
                            {m.desempenho_medio != null && <span>desempenho médio {m.desempenho_medio}/5</span>}
                            {m.gas_ultimo != null && <Badge variant="secondary" className="text-[10px]">GAS {m.gas_ultimo > 0 ? "+" : ""}{m.gas_ultimo}</Badge>}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Sugestão por regras: <strong>{m.sugestao}</strong> — {m.motivo}</p>
                      {iaDecisao && (
                        <p className="text-xs"><Sparkles className="h-3 w-3 inline mr-1 text-brand" />
                          <strong>IA:</strong> {iaDecisao.decisao} — {iaDecisao.racional}
                          {iaDecisao.ajuste_sugerido && <><br /><em>Ajuste:</em> {iaDecisao.ajuste_sugerido}</>}
                        </p>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground">Decisão</label>
                          <Select value={dec.status} onValueChange={(v) => setDecisoes((p) => ({ ...p, [m.meta_id]: { ...dec, status: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground">Nível GAS final (opcional)</label>
                          <Select value={dec.gas || "__none"} onValueChange={(v) => setDecisoes((p) => ({ ...p, [m.meta_id]: { ...dec, gas: v === "__none" ? "" : v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">— sem definir —</SelectItem>
                              {[-2, -1, 0, 1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n > 0 ? "+" : ""}{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {ia?.novas_metas_sugeridas?.length > 0 && (
              <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Novas metas sugeridas pela IA
                  </p>
                  {ia.novas_metas_sugeridas.map((nm: any, i: number) => (
                    <div key={i} className="text-xs border-l-2 border-emerald-400 pl-2">
                      <p className="font-medium">{nm.titulo_smart}</p>
                      {nm.dominio && <p className="text-muted-foreground">Domínio: {nm.dominio}</p>}
                      {nm.baseline && <p className="text-muted-foreground">Baseline: {nm.baseline}</p>}
                      {nm.racional && <p className="italic">{nm.racional}</p>}
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Estas sugestões são salvas no histórico da revisão para uso ao iniciar o próximo ciclo.</p>
                </CardContent>
              </Card>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Observação geral</label>
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Comentários sobre o ciclo, próximos passos…" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={salvarRevisao} disabled={salvando || !analise}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Aprovar revisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
