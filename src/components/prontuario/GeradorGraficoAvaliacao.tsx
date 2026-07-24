import { useMemo, useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { normalizarResultado } from "./VariaveisTesteEditor";
import { classificar, corPastel, PALETA_SISTEMA, type Rubrica } from "@/lib/avaliacao-classificacao";

type Tipo = "barras" | "linha" | "radar" | "pizza";

/** Níveis padrão (mesma paleta do sistema, do mais baixo ao mais alto). */
const NIVEIS = [
  { label: "Muito inferior", cor: PALETA_SISTEMA[0].cor },
  { label: "Inferior", cor: PALETA_SISTEMA[1].cor },
  { label: "Médio inferior", cor: PALETA_SISTEMA[2].cor },
  { label: "Médio", cor: PALETA_SISTEMA[3].cor },
  { label: "Médio superior", cor: PALETA_SISTEMA[4].cor },
  { label: "Superior", cor: PALETA_SISTEMA[5].cor },
  { label: "Muito superior", cor: PALETA_SISTEMA[6].cor },
];
const ordinalDaCor = (cor: string) => Math.max(1, PALETA_SISTEMA.findIndex((c) => c.cor === cor) + 1);

type Linha = { id: string; rotulo: string; valor: string; nivelLabel: string; cor: string };

let _seq = 0;
const novaLinha = (cor = NIVEIS[3].cor, nivelLabel = NIVEIS[3].label): Linha =>
  ({ id: `l${_seq++}`, rotulo: "", valor: "", nivelLabel, cor });

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
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
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

export function GeradorGraficoAvaliacao({
  open, onOpenChange, titulo, aplicados, rubricaDeTeste, catalogo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo?: string | null;
  aplicados?: any[];
  rubricaDeTeste?: (testeId?: string | null) => Rubrica;
  catalogo?: any[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [tituloGrafico, setTituloGrafico] = useState("");
  const [tipo, setTipo] = useState<Tipo>("barras");
  const [barSize, setBarSize] = useState(22);
  const [linhaBase, setLinhaBase] = useState("");
  const [origem, setOrigem] = useState("__completa__");
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha(), novaLinha(NIVEIS[3].cor), novaLinha(NIVEIS[3].cor)]);

  function setLinha(id: string, campo: keyof Linha, v: string) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: v } : l)));
  }
  function setNivel(id: string, cor: string) {
    const n = NIVEIS.find((x) => x.cor === cor);
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, cor, nivelLabel: n?.label ?? l.nivelLabel } : l)));
  }
  function addLinha() { setLinhas((ls) => [...ls, novaLinha()]); }
  function removeLinha(id: string) { setLinhas((ls) => ls.filter((l) => l.id !== id)); }

  const resultados = useMemo(
    () => (aplicados ?? []).filter((a) => a.classificacao !== "Qualitativo"),
    [aplicados],
  );

  function corDe(a: any, percentil: number | null, escore: number | null) {
    const cl = rubricaDeTeste ? classificar(rubricaDeTeste(a.teste_id), { percentil, escorePadrao: escore }) : null;
    return { cor: cl?.cor ?? NIVEIS[3].cor, nivel: cl?.rotulo ?? a.classificacao ?? "" };
  }

  // Uma linha por variável do teste (quando tem valores numéricos).
  function variaveisDe(a: any): Linha[] {
    const vv = a.variaveis_valores;
    if (!vv || typeof vv !== "object") return [];
    const defs = (catalogo ?? []).find((c: any) => c.id === a.teste_id)?.variaveis;
    const labelDe = (k: string) => (Array.isArray(defs) ? defs.find((d: any) => d.key === k)?.label : null) ?? k;
    const out: Linha[] = [];
    for (const [k, raw] of Object.entries(vv)) {
      const r = normalizarResultado(raw as any);
      const percentil = r.percentil != null ? Number(r.percentil) : null;
      const escore = r.padrao != null ? Number(r.padrao) : null;
      if (percentil == null && escore == null) continue;
      const { cor, nivel } = corDe(a, percentil, escore);
      out.push({ id: `l${_seq++}`, rotulo: labelDe(k), valor: String(percentil ?? escore), nivelLabel: nivel, cor });
    }
    return out;
  }

  // Linha do escore global/agregado do teste.
  function globalDe(a: any): Linha | null {
    const percentil = a.percentil != null ? Number(a.percentil) : mediaVariaveis(a.variaveis_valores, "percentil");
    const escore = a.escore_padrao != null ? Number(a.escore_padrao) : mediaVariaveis(a.variaveis_valores, "padrao");
    if (percentil == null && escore == null) return null;
    const { cor, nivel } = corDe(a, percentil, escore);
    return { id: `l${_seq++}`, rotulo: a.teste?.nome ?? "—", valor: String(percentil ?? escore), nivelLabel: nivel, cor };
  }

  // Puxa da avaliação completa (um item por teste) ou de um teste específico
  // (expande em variáveis, quando o teste tem).
  function puxar() {
    let novas: Linha[] = [];
    if (origem === "__completa__") {
      novas = resultados.map(globalDe).filter(Boolean) as Linha[];
      if (!tituloGrafico) setTituloGrafico(titulo ?? "Perfil da avaliação");
    } else {
      const a = resultados.find((x) => x.id === origem);
      if (!a) return;
      const vars = variaveisDe(a);
      novas = vars.length ? vars : ([globalDe(a)].filter(Boolean) as Linha[]);
      if (!tituloGrafico) setTituloGrafico(a.teste?.nome ?? "Resultado do teste");
    }
    if (novas.length === 0) { toast.info("Nada quantitativo para puxar."); return; }
    setLinhas(novas);
  }

  const dados = useMemo(() => linhas
    .filter((l) => l.rotulo.trim())
    .map((l) => {
      const num = l.valor.trim() !== "" && !Number.isNaN(Number(l.valor)) ? Number(l.valor) : ordinalDaCor(l.cor);
      return { nome: l.rotulo.trim(), valor: num, cor: l.cor, nivel: l.nivelLabel };
    }), [linhas]);

  // Legenda: níveis distintos usados.
  const legenda = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of dados) if (d.nivel && !seen.has(d.nivel)) seen.set(d.nivel, d.cor);
    return Array.from(seen.entries());
  }, [dados]);

  const vazio = dados.length === 0;
  const base = linhaBase.trim() !== "" && !Number.isNaN(Number(linhaBase)) ? Number(linhaBase) : null;
  const arquivo = `grafico-${(tituloGrafico || titulo || "avaliacao").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Gerador de gráficos</DialogTitle></DialogHeader>

        <p className="text-xs text-muted-foreground">
          Monte um gráfico do jeito que quiser — por teste, área, instrumento ou tarefa clínica. Não precisa ter
          resultado lançado: escreva os itens, dê um valor (ou deixe em branco para usar só o nível) e escolha o nível
          de cada um. Serve também para leitura qualitativa. As cores seguem a classificação do sistema.
        </p>

        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          {/* ------- Editor de dados ------- */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Título do gráfico</Label>
                <Input value={tituloGrafico} onChange={(e) => setTituloGrafico(e.target.value)} placeholder="Ex.: Perfil de leitura" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barras">Barras</SelectItem>
                    <SelectItem value="linha">Linha</SelectItem>
                    <SelectItem value="radar">Radar</SelectItem>
                    <SelectItem value="pizza">Pizza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(tipo === "barras" || tipo === "linha") && (
              <div className="flex flex-wrap items-end gap-4">
                {tipo === "barras" && (
                  <div>
                    <Label className="text-xs">Espessura das barras</Label>
                    <input
                      type="range" min={8} max={48} step={2} value={barSize}
                      onChange={(e) => setBarSize(Number(e.target.value))}
                      className="mt-2 block w-36 cursor-pointer accent-brand"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Linha de base (opcional)</Label>
                  <Input
                    type="number" value={linhaBase} onChange={(e) => setLinhaBase(e.target.value)}
                    placeholder="Ex.: 25" className="h-9 w-28"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_64px_auto_28px] items-center gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Item</span><span>Valor</span><span>Nível / cor</span><span></span>
              </div>
              {linhas.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_64px_auto_28px] items-center gap-2">
                  <Input value={l.rotulo} onChange={(e) => setLinha(l.id, "rotulo", e.target.value)} placeholder="Ex.: Consciência fonológica" className="h-8 text-xs" />
                  <Input value={l.valor} onChange={(e) => setLinha(l.id, "valor", e.target.value)} placeholder="—" className="h-8 text-xs" />
                  <div className="flex items-center gap-1">
                    {NIVEIS.map((n) => (
                      <button
                        key={n.cor}
                        type="button"
                        title={n.label}
                        onClick={() => setNivel(l.id, n.cor)}
                        className={`h-5 w-5 rounded-full border-2 transition ${l.cor === n.cor ? "border-foreground/70 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: n.cor }}
                      />
                    ))}
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLinha(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addLinha}>
                  <Plus className="mr-1 h-3 w-3" />Item
                </Button>
                {resultados.length > 0 && (
                  <>
                    <Select value={origem} onValueChange={setOrigem}>
                      <SelectTrigger className="h-7 w-auto min-w-[150px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__completa__">Avaliação completa</SelectItem>
                        {resultados.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.teste?.nome ?? "Teste"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={puxar}>
                      <Sparkles className="mr-1 h-3 w-3" />Puxar
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Dica: para leitura qualitativa, deixe o valor em branco e escolha só o nível — a barra usa a posição do nível.
              </p>
            </div>
          </div>

          {/* ------- Prévia ------- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Prévia</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={vazio} onClick={() => baixarPng(chartRef.current, arquivo)}>
                <Download className="mr-1 h-3.5 w-3.5" />PNG
              </Button>
            </div>
            <div ref={chartRef} className="rounded-lg border border-border/40 bg-white p-3">
              {tituloGrafico && <p className="mb-1 text-center text-sm font-semibold text-slate-700">{tituloGrafico}</p>}
              {vazio ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Adicione itens para ver o gráfico.</p>
              ) : tipo === "radar" ? (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={dados} outerRadius="72%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="nome" tick={{ fontSize: 10 }} />
                    <Radar dataKey="valor" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}${p?.payload?.nivel ? ` · ${p.payload.nivel}` : ""}`, "Valor"]} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : tipo === "pizza" ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={dados} dataKey="valor" nameKey="nome" outerRadius="75%" label={(p: any) => p.nome}>
                      {dados.map((d, i) => <Cell key={i} fill={corPastel(d.cor)} stroke={d.cor} strokeOpacity={0.55} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}${p?.payload?.nivel ? ` · ${p.payload.nivel}` : ""}`, p?.payload?.nome ?? ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : tipo === "linha" ? (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={dados} margin={{ left: 4, right: 24, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={54} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}${p?.payload?.nivel ? ` · ${p.payload.nivel}` : ""}`, "Valor"]} />
                    {base != null && (
                      <ReferenceLine y={base} stroke="#64748b" strokeDasharray="5 4"
                        label={{ value: `Linha de base ${base}`, position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />
                    )}
                    <Line type="monotone" dataKey="valor" stroke="#7c3aed" strokeWidth={2}
                      dot={(props: any) => {
                        const d = dados[props.index];
                        return <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={corPastel(d.cor)} stroke={d.cor} strokeWidth={1.5} />;
                      }}
                      isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, dados.length * 40 + 50)}>
                  <BarChart layout="vertical" data={dados} margin={{ left: 8, right: 44, top: 6, bottom: 6 }}>
                    <XAxis type="number" domain={[0, "dataMax"]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}${p?.payload?.nivel ? ` · ${p.payload.nivel}` : ""}`, "Valor"]} />
                    {base != null && (
                      <ReferenceLine x={base} stroke="#64748b" strokeDasharray="5 4"
                        label={{ value: `base ${base}`, position: "top", fontSize: 10, fill: "#64748b" }} />
                    )}
                    <Bar dataKey="valor" barSize={barSize} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="nivel" position="right" style={{ fontSize: 10, fill: "#334155" }} />
                      {dados.map((d, i) => <Cell key={i} fill={corPastel(d.cor)} stroke={d.cor} strokeOpacity={0.55} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {legenda.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {legenda.map(([nome, cor]) => (
                    <span key={nome} className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />{nome}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
