import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, X, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

type Insights = {
  marcos_relevantes?: string[];
  fatores_protetivos?: string[];
  fatores_de_risco?: string[];
  hipoteses_a_considerar?: string[];
  lacunas_a_investigar?: string[];
  correlacoes_clinicas?: { descricao: string; justificativa?: string }[];
  encaminhamentos_sugeridos?: string[];
};

interface Props {
  insights: Insights | null;
  loading: boolean;
  validados: Record<string, string[]>;
  onValidar: (categoria: string, item: string) => void;
  onDescartar: (categoria: string, item: string) => void;
  onAplicarPerfilVivo?: () => void;
  onRegenerar: () => void;
}

const BLOCOS: { key: keyof Insights; label: string; tone?: string }[] = [
  { key: "marcos_relevantes", label: "Marcos relevantes" },
  { key: "fatores_protetivos", label: "Fatores protetivos", tone: "text-emerald-600" },
  { key: "fatores_de_risco", label: "Fatores de risco", tone: "text-amber-600" },
  { key: "hipoteses_a_considerar", label: "Hipóteses a considerar" },
  { key: "correlacoes_clinicas", label: "Correlações clínicas" },
  { key: "lacunas_a_investigar", label: "Lacunas a investigar", tone: "text-blue-600" },
  { key: "encaminhamentos_sugeridos", label: "Encaminhamentos sugeridos" },
];

export function PainelInsights({ insights, loading, validados, onValidar, onDescartar, onAplicarPerfilVivo, onRegenerar }: Props) {
  return (
    <Card className="glass border-brand/30 sticky top-4">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" /> Insights clínicos
        </CardTitle>
        <div className="flex gap-1">
          {onAplicarPerfilVivo && (
            <Button size="sm" variant="secondary" onClick={onAplicarPerfilVivo}>
              <ArrowDownToLine className="h-3 w-3 mr-1" />Perfil Vivo
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRegenerar} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        {!insights && !loading && (
          <p className="text-xs text-muted-foreground">
            A IA acompanha o preenchimento em segundo plano. Os primeiros cards aparecem quando houver dados suficientes.
          </p>
        )}
        {loading && !insights && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Analisando dados…</div>
        )}
        {insights && BLOCOS.map((b) => {
          const items = (insights[b.key] as any[]) ?? [];
          if (!items.length) return null;
          return (
            <div key={b.key}>
              <p className={cn("text-xs font-semibold mb-2", b.tone)}>{b.label}</p>
              <ul className="space-y-1.5">
                {items.map((it, i) => {
                  const txt = typeof it === "string" ? it : it.descricao;
                  const just = typeof it === "string" ? null : it.justificativa;
                  const isValidado = (validados[b.key] ?? []).includes(txt);
                  return (
                    <li key={i} className={cn(
                      "rounded-md border p-2 text-xs space-y-1",
                      isValidado ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-muted/30"
                    )}>
                      <p>{txt}</p>
                      {just && <p className="text-[11px] text-muted-foreground italic">{just}</p>}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="h-4 text-[9px] px-1">
                          {isValidado ? "Validado" : "Sugestão IA · aguardando validação"}
                        </Badge>
                        <div className="flex gap-1">
                          {!isValidado && (
                            <button onClick={() => onValidar(b.key, txt)} className="text-emerald-600 hover:bg-emerald-500/10 rounded p-0.5" title="Validar">
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button onClick={() => onDescartar(b.key, txt)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-0.5" title="Descartar">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground italic pt-2 border-t border-border/30">
          As sugestões nunca substituem o julgamento clínico. Valide ou descarte cada item.
        </p>
      </CardContent>
    </Card>
  );
}
