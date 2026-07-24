import { useMemo, useRef, useState } from "react";
import {
  Bar, BarChart, Cell, LabelList, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { normalizarResultado } from "./VariaveisTesteEditor";
import { classificar, corDoRotulo, RUBRICA_PADRAO, type Rubrica } from "@/lib/avaliacao-classificacao";

type Metrica = "percentil" | "escore_padrao";
type TipoGrafico = "barras_teste" | "barras_dominio" | "radar";

const COR_NEUTRA = "#94a3b8";

/** Média das variáveis (quando o teste não tem escore global). */
function mediaVariaveis(vv: any, campo: "percentil" | "padrao"): number | null {
  if (!vv || typeof vv !== "object") return null;
  const nums: number[] = [];
  for (const raw of Object.values(vv)) {
    const r = normalizarResultado(raw as any);
    const v = campo === "percentil" ? r.percentil : r.padrao;
    if (v != null && !Number.isNaN(Number(v))) nums.push(Number(v));
  }
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

function valorDe(a: any, metrica: Metrica): number | null {
  if (metrica === "escore_padrao") {
    return a.escore_padrao != null ? Number(a.escore_padrao) : mediaVariaveis(a.variaveis_valores, "padrao");
  }
  return a.percentil != null ? Number(a.percentil) : mediaVariaveis(a.variaveis_valores, "percentil");
}

/** Serializa o SVG do gráfico e baixa como PNG (fundo branco, 2x). */
function baixarPng(container: HTMLElement | null, filename: string) {
  const svg = container?.querySelector("svg");
  if (!svg) { toast.error("Nada para exportar"); return; }
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 420;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => toast.error("Falha ao gerar a imagem");
  img.src = src;
}

export function GeradorGraficoAvaliacao({
  open, onOpenChange, titulo, aplicados, rubricaDeTeste,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo?: string | null;
  aplicados: any[];
  rubricaDeTeste: (testeId?: string | null) => Rubrica;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [metrica, setMetrica] = useState<Metrica>("percentil");
  const [tipo, setTipo] = useState<TipoGrafico>("barras_teste");

  // Só resultados numéricos (com percentil/escore ou variáveis numéricas).
  const validos = useMemo(
    () => (aplicados ?? []).filter((a) => a.classificacao !== "Qualitativo" && valorDe(a, metrica) != null),
    [aplicados, metrica],
  );

  // Sugestão de tipo: com muitos domínios, radar comunica melhor o perfil.
  const nDominios = useMemo(
    () => new Set(validos.map((a) => a.teste?.dominio?.nome).filter(Boolean)).size,
    [validos],
  );
  const sugestao: TipoGrafico = nDominios >= 3 ? "radar" : "barras_teste";

  // Dados por teste (cor pela classificação da rubrica do próprio teste).
  const dadosTeste = useMemo(() => validos.map((a) => {
    const valor = Number(valorDe(a, metrica));
    const cl = classificar(rubricaDeTeste(a.teste_id), {
      percentil: metrica === "percentil" ? valor : (a.percentil ?? null),
      escorePadrao: metrica === "escore_padrao" ? valor : (a.escore_padrao ?? null),
    });
    return { nome: a.teste?.nome ?? "—", valor, cor: cl?.cor ?? COR_NEUTRA, classif: cl?.rotulo ?? "" };
  }), [validos, metrica, rubricaDeTeste]);

  // Dados por domínio: média da métrica; cor pela classificação da média
  // (rubrica padrão do sistema, já que um domínio agrega testes variados).
  const dadosDominio = useMemo(() => {
    const grupos = new Map<string, number[]>();
    for (const a of validos) {
      const dom = a.teste?.dominio?.nome ?? "Sem domínio";
      const arr = grupos.get(dom) ?? [];
      arr.push(Number(valorDe(a, metrica)));
      grupos.set(dom, arr);
    }
    return Array.from(grupos.entries()).map(([nome, vals]) => {
      const media = vals.reduce((s, n) => s + n, 0) / vals.length;
      const cl = classificar(RUBRICA_PADRAO, {
        percentil: metrica === "percentil" ? media : null,
        escorePadrao: metrica === "escore_padrao" ? media : null,
      });
      return { nome, valor: Math.round(media * 10) / 10, cor: cl?.cor ?? COR_NEUTRA, classif: cl?.rotulo ?? "" };
    });
  }, [validos, metrica]);

  const dominioAxisMax = metrica === "percentil" ? 100 : undefined;
  const arquivo = `grafico-${(titulo ?? "avaliacao").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;

  const vazio = validos.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Gráfico da avaliação</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoGrafico)}>
              <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="barras_teste">Barras por teste</SelectItem>
                <SelectItem value="barras_dominio">Barras por domínio</SelectItem>
                <SelectItem value="radar">Radar por domínio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Métrica</Label>
            <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentil">Percentil</SelectItem>
                <SelectItem value="escore_padrao">Escore-padrão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" disabled={vazio} onClick={() => baixarPng(chartRef.current, arquivo)}>
            <Download className="mr-1.5 h-4 w-4" />Baixar PNG
          </Button>
        </div>

        {tipo !== sugestao && !vazio && (
          <button
            type="button"
            onClick={() => setTipo(sugestao)}
            className="flex items-center gap-1.5 self-start rounded-md bg-brand/10 px-2 py-1 text-[11px] text-brand hover:bg-brand/15"
          >
            <Lightbulb className="h-3 w-3" />
            Sugestão: {sugestao === "radar" ? "radar por domínio" : "barras por teste"} comunica melhor este conjunto.
          </button>
        )}

        <div ref={chartRef} className="mt-1 rounded-lg border border-border/40 bg-white p-3">
          {vazio ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhum resultado numérico com {metrica === "percentil" ? "percentil" : "escore-padrão"} para plotar.
            </p>
          ) : tipo === "radar" ? (
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={dadosDominio} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <Radar dataKey="valor" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                <Tooltip formatter={(v: any) => [v, metrica === "percentil" ? "Percentil (média)" : "Escore (média)"]} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, (tipo === "barras_teste" ? dadosTeste : dadosDominio).length * 42 + 60)}>
              <BarChart
                layout="vertical"
                data={tipo === "barras_teste" ? dadosTeste : dadosDominio}
                margin={{ left: 12, right: 40, top: 8, bottom: 8 }}
              >
                <XAxis type="number" domain={[0, dominioAxisMax ?? "dataMax"]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}${p?.payload?.classif ? ` · ${p.payload.classif}` : ""}`, metrica === "percentil" ? "Percentil" : "Escore-padrão"]} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="valor" position="right" style={{ fontSize: 11, fill: "#334155" }} />
                  {(tipo === "barras_teste" ? dadosTeste : dadosDominio).map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          As cores seguem a classificação de cada resultado (mesma paleta do sistema). O PNG pode ser anexado ao laudo.
        </p>
      </DialogContent>
    </Dialog>
  );
}
