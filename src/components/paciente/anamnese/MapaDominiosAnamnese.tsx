import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SECOES_RADAR } from "@/lib/anamnese-schema";
import { AlertTriangle, CheckCircle2, AlertCircle, HelpCircle, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  scores: Record<string, number>;
  /** Recalcula o mapa via IA a partir das respostas atuais. */
  onRegenerar?: () => void;
  loading?: boolean;
}

type Nivel = "ok" | "atencao" | "risco" | "sem_dados";

function classificar(score: number | undefined): { nivel: Nivel; statusLabel: string; cor: string; icon: any } {
  if (score == null || Number.isNaN(score)) {
    return { nivel: "sem_dados", statusLabel: "Sem dados", cor: "bg-muted text-muted-foreground border-border", icon: HelpCircle };
  }
  if (score >= 7) return { nivel: "ok", statusLabel: "Adequado", cor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 };
  if (score >= 4) return { nivel: "atencao", statusLabel: "Atenção", cor: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: AlertCircle };
  return { nivel: "risco", statusLabel: "Risco", cor: "bg-rose-500/10 text-rose-700 border-rose-500/30", icon: AlertTriangle };
}

export function MapaDominiosAnamnese({ scores, onRegenerar, loading }: Props) {
  const items = SECOES_RADAR.map((s) => {
    const v = typeof scores[s.key] === "number" ? scores[s.key] : undefined;
    return { ...s, valor: v, ...classificar(v) };
  });

  const totais = items.reduce(
    (acc, i) => ({ ...acc, [i.nivel]: (acc[i.nivel] ?? 0) + 1 }),
    {} as Record<Nivel, number>
  );

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
          <span>Mapa de domínios da anamnese</span>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-normal text-muted-foreground flex items-center gap-2">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Adequado: {totais.ok ?? 0}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Atenção: {totais.atencao ?? 0}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Risco: {totais.risco ?? 0}</span>
            </span>
            {onRegenerar && (
              <Button size="sm" variant="secondary" onClick={onRegenerar} disabled={loading} className="h-7">
                {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {loading ? "Analisando…" : "Atualizar mapa"}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.key} className={cn("rounded-lg border p-3 flex items-start gap-2 transition-colors", it.cor)}>
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{it.label}</p>
                  <p className="text-[11px] opacity-80">{it.valor != null ? `Score ${it.valor}/10` : "Aguardando análise"}</p>
                  <p className="text-[10px] mt-0.5 font-medium uppercase tracking-wide">{
                    it.nivel === "ok" ? "Adequado" : it.nivel === "atencao" ? "Atenção" : it.nivel === "risco" ? "Domínio de risco" : "Sem dados"
                  }</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          O mapa reflete a última análise. Após alterar respostas, clique em <strong>Atualizar mapa</strong> para recalcular.
          Classificação: ≥7 adequado · 4–6 atenção · &lt;4 risco.
        </p>
      </CardContent>
    </Card>
  );
}
