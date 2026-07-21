import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingDown, TrendingUp, Minus, Loader2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { analisarEvolucaoMetas, gerarInsightSemanal } from "@/lib/insights.functions";

export function InsightsCard({ pacienteId }: { pacienteId: string }) {
  const analisar = useServerFn(analisarEvolucaoMetas);
  const gerar = useServerFn(gerarInsightSemanal);
  const [insight, setInsight] = useState<any>(null);
  const [gerando, setGerando] = useState(false);

  const { data: evolucao } = useQuery({
    queryKey: ["evolucao-metas", pacienteId],
    queryFn: async () => await analisar({ data: { paciente_id: pacienteId } }) as any,
  });

  // Buscar insight cacheado (se houver) ao montar
  useQuery({
    queryKey: ["insight-inicial", pacienteId],
    queryFn: async () => {
      try {
        const r: any = await gerar({ data: { paciente_id: pacienteId } });
        if (r?.cached) setInsight(r);
        return r;
      } catch { return null; }
    },
    staleTime: Infinity,
  });

  async function regerar() {
    setGerando(true);
    try {
      const r: any = await gerar({ data: { paciente_id: pacienteId, force: true } });
      setInsight(r);
      toast.success("Insight atualizado");
    } catch (e: any) {
      toast.error("Falha ao gerar insight", { description: e.message });
    } finally { setGerando(false); }
  }

  const atencao = (evolucao?.metas ?? []).filter((m: any) =>
    m.tendencia === "estagnada" || m.tendencia === "regressao"
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Insight semanal */}
      <Card className="glass border-primary/30">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Insight semanal
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={regerar} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!insight && !gerando && (
            <div className="text-sm text-muted-foreground">
              <p>Gere uma síntese clínica proativa com base nas últimas sessões e tarefas.</p>
              <Button size="sm" variant="secondary" onClick={regerar} className="mt-3">
                <Sparkles className="h-4 w-4 mr-1.5" />Gerar agora
              </Button>
            </div>
          )}
          {gerando && !insight && <p className="text-sm text-muted-foreground">Analisando…</p>}
          {insight && (
            <>
              <p className="text-sm font-medium">{insight.destaque}</p>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {insight.insight}
              </div>
              {insight.acoes_sugeridas?.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Ações sugeridas</p>
                  <ul className="text-sm space-y-1">
                    {insight.acoes_sugeridas.map((a: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-brand">→</span>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {insight.gerado_em && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  {insight.cached ? "Cache · " : ""}
                  Gerado {format(parseISO(insight.gerado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Metas em atenção */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-brand" />
            Metas em atenção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {atencao.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todas as metas com registros estão evoluindo ✨
            </p>
          )}
          {atencao.map((m: any) => (
            <div key={m.meta_id} className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{m.titulo}</p>
                <TendenciaBadge tendencia={m.tendencia} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Nível atual: <strong>{m.nivel_atual ?? "—"}</strong>
                {m.dias_sem_mudanca > 0 && ` · ${m.dias_sem_mudanca} dias sem mudança`}
                {m.n_registros > 0 && ` · ${m.n_registros} registros`}
              </div>
            </div>
          ))}
          {(evolucao?.metas ?? []).filter((m: any) => m.tendencia === "progresso").length > 0 && (
            <p className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              {(evolucao?.metas ?? []).filter((m: any) => m.tendencia === "progresso").length} metas em progresso
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TendenciaBadge({ tendencia }: { tendencia: string }) {
  if (tendencia === "regressao")
    return <Badge variant="destructive" className="text-[10px]"><TrendingDown className="w-3 h-3 mr-1" />Regressão</Badge>;
  if (tendencia === "estagnada")
    return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600"><Minus className="w-3 h-3 mr-1" />Estagnada</Badge>;
  if (tendencia === "progresso")
    return <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600"><TrendingUp className="w-3 h-3 mr-1" />Progresso</Badge>;
  return <Badge variant="outline" className="text-[10px]">—</Badge>;
}
