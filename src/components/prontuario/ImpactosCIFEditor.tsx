import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sugerirImpactosCIF } from "@/lib/baterias.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, TrendingUp, TrendingDown, Eye, Sparkles, Loader2 } from "lucide-react";

export type CifDim =
  | "funcoes_corporais"
  | "estruturas_corporais"
  | "atividade_participacao"
  | "fatores_ambientais"
  | "fatores_pessoais";

export const CIF_DIM_LABEL: Record<CifDim, string> = {
  funcoes_corporais: "Funções corporais",
  estruturas_corporais: "Estruturas corporais",
  atividade_participacao: "Atividade e participação",
  fatores_ambientais: "Fatores ambientais",
  fatores_pessoais: "Fatores pessoais",
};

export type ImpactoCif = { dim: CifDim; tipo: "forca" | "fragilidade" | "observacao"; nota?: string };

const TIPO_META: Record<ImpactoCif["tipo"], { label: string; cls: string; icon: React.ReactNode }> = {
  forca: { label: "Força", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: <TrendingUp className="w-3 h-3" /> },
  fragilidade: { label: "Fragilidade", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", icon: <TrendingDown className="w-3 h-3" /> },
  observacao: { label: "Observação", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", icon: <Eye className="w-3 h-3" /> },
};

export function ImpactosCIFEditor({
  value, onChange, sugestoes, contextoIA,
}: {
  value: ImpactoCif[];
  onChange: (v: ImpactoCif[]) => void;
  sugestoes?: { dim: CifDim; detalhe?: string }[];
  /** Dados para a IA sugerir impactos automaticamente */
  contextoIA?: {
    teste_nome?: string | null;
    dominio?: string | null;
    escore_bruto?: number | string | null;
    escore_padrao?: number | string | null;
    percentil?: number | string | null;
    classificacao?: string | null;
    observacoes?: string | null;
    interpretacao?: string | null;
    idade?: string | null;
    queixa?: string | null;
    variaveis?: Record<string, any> | null;
  };
}) {
  const [dim, setDim] = useState<CifDim>("atividade_participacao");
  const [tipo, setTipo] = useState<ImpactoCif["tipo"]>("fragilidade");
  const [nota, setNota] = useState("");
  const [sugIA, setSugIA] = useState<ImpactoCif[]>([]);
  const [carregando, setCarregando] = useState(false);
  const chamarIA = useServerFn(sugerirImpactosCIF);

  function add(d: CifDim, t: ImpactoCif["tipo"], n?: string) {
    onChange([...value, { dim: d, tipo: t, nota: n?.trim() || undefined }]);
    setNota("");
  }

  function adicionarSugestao(s: ImpactoCif, idx: number) {
    onChange([...value, s]);
    setSugIA(sugIA.filter((_, i) => i !== idx));
  }

  async function sugerirIA() {
    if (!contextoIA?.teste_nome) {
      toast.error("Selecione um teste primeiro");
      return;
    }
    setCarregando(true);
    try {
      const res = await chamarIA({ data: contextoIA as any });
      const novos = (res?.impactos ?? []) as ImpactoCif[];
      if (novos.length === 0) toast.info("A IA não retornou sugestões adicionais");
      setSugIA(novos);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar IA");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Impactos no CIF</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {sugestoes && sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sugestoes.map((s, i) => (
                <button key={i} type="button" onClick={() => setDim(s.dim)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border/60 text-muted-foreground hover:text-foreground">
                  catálogo: {CIF_DIM_LABEL[s.dim]}
                </button>
              ))}
            </div>
          )}
          {contextoIA && (
            <Button type="button" size="sm" variant="outline" onClick={sugerirIA} disabled={carregando} className="h-7 text-xs">
              {carregando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Sugerir com IA
            </Button>
          )}
        </div>
      </div>

      {sugIA.length > 0 && (
        <div className="rounded-md border border-dashed border-brand/40 bg-brand/5 p-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" />Sugestões da IA — clique para adicionar
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sugIA.map((s, i) => {
              const meta = TIPO_META[s.tipo];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => adicionarSugestao(s, i)}
                  className={`text-xs rounded-md border px-2 py-1 ${meta.cls} hover:opacity-80 text-left`}
                >
                  <div className="flex items-center gap-1 font-medium">{meta.icon}{CIF_DIM_LABEL[s.dim]}</div>
                  {s.nota && <div className="text-[10px] opacity-80 max-w-[280px]">{s.nota}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-2">
        <select className="col-span-5 h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={dim} onChange={(e) => setDim(e.target.value as CifDim)}>
          {(Object.keys(CIF_DIM_LABEL) as CifDim[]).map((k) => (
            <option key={k} value={k}>{CIF_DIM_LABEL[k]}</option>
          ))}
        </select>
        <select className="col-span-3 h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={tipo} onChange={(e) => setTipo(e.target.value as ImpactoCif["tipo"])}>
          <option value="forca">Força</option>
          <option value="fragilidade">Fragilidade</option>
          <option value="observacao">Observação</option>
        </select>
        <Input className="col-span-3" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(dim, tipo, nota); } }} />
        <Button type="button" size="sm" variant="secondary" className="col-span-1" onClick={() => add(dim, tipo, nota)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Nenhum impacto registrado. Conecte o resultado às dimensões da CIF.</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((imp, i) => {
            const meta = TIPO_META[imp.tipo];
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5 text-sm">
                <Badge variant="outline" className={`gap-1 ${meta.cls}`}>{meta.icon}{meta.label}</Badge>
                <span className="font-medium">{CIF_DIM_LABEL[imp.dim]}</span>
                {imp.nota && <span className="text-muted-foreground text-xs truncate">— {imp.nota}</span>}
                <button type="button" className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
