import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, Trash2, Workflow, StickyNote, ZoomIn, ZoomOut, Download, ArrowLeftRight, ArrowUpDown, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Atividade, Fluxograma, FlowNode, FlowTipo, Orientacao } from "./types";
import { FLOW_SIZE, gerarFluxograma, relayout, novoId } from "./types";

const CORES: Record<FlowTipo, string> = {
  inicio: "bg-emerald-200 border-emerald-500 text-emerald-950",
  fim: "bg-emerald-200 border-emerald-500 text-emerald-950",
  processo: "bg-amber-200 border-amber-500 text-amber-950",
  decisao: "bg-slate-800 border-slate-900 text-white",
  subetapa: "bg-white border-amber-300 text-amber-900 border-dashed",
  postit: "bg-yellow-200 border-yellow-300 text-yellow-950 shadow-md",
};

// Cor de preenchimento padrão por tipo (para export PNG e swatches).
const FILL: Record<FlowTipo, string> = {
  inicio: "#bbf7d0", fim: "#bbf7d0", processo: "#fde68a", decisao: "#1f2937", subetapa: "#ffffff", postit: "#fef08a",
};
const STROKE: Record<FlowTipo, string> = {
  inicio: "#22c55e", fim: "#22c55e", processo: "#f59e0b", decisao: "#0f172a", subetapa: "#fbbf24", postit: "#fde047",
};
const PALETA = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e2e8f0", "#1f2937"];

/** Ponto na borda da caixa do nó, na direção de (tx,ty). */
function anchor(n: FlowNode, tx: number, ty: number) {
  const { w, h } = FLOW_SIZE[n.tipo];
  const dx = tx - n.x, dy = ty - n.y;
  if (dx === 0 && dy === 0) return { x: n.x, y: n.y };
  const s = Math.min((w / 2) / (Math.abs(dx) || 1e-6), (h / 2) / (Math.abs(dy) || 1e-6));
  return { x: n.x + dx * s, y: n.y + dy * s };
}

export function FluxogramaEditor({
  atividades = [], fluxograma, onChange, readOnly = false,
}: {
  atividades?: Atividade[];
  fluxograma?: Fluxograma;
  onChange?: (f: Fluxograma) => void;
  readOnly?: boolean;
}) {
  const graph: Fluxograma = fluxograma && fluxograma.nodes?.length ? fluxograma : { nodes: [], edges: [], orientacao: "horizontal" };
  const orientacao: Orientacao = graph.orientacao ?? "horizontal";
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ id: string; ox: number; oy: number; moved: boolean } | null>(null);

  const bounds = useMemo(() => {
    let maxX = 480, maxY = 300;
    for (const n of graph.nodes) {
      const { w, h } = FLOW_SIZE[n.tipo];
      maxX = Math.max(maxX, n.x + w / 2 + 40);
      maxY = Math.max(maxY, n.y + h / 2 + 40);
    }
    return { w: maxX, h: maxY };
  }, [graph.nodes]);

  function set(next: Fluxograma) { onChange?.(next); }
  function updNode(id: string, patch: Partial<FlowNode>) {
    set({ ...graph, nodes: graph.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) });
  }

  function sincronizar() {
    if (!atividades.flatMap((a) => a.itens ?? []).some((i) => i.texto?.trim())) { set({ nodes: [], edges: [], orientacao }); return; }
    set(gerarFluxograma(atividades, graph, orientacao));
  }
  function limpar() {
    if (graph.nodes.length && !confirm("Apagar todo o fluxograma? Você pode gerar de novo pelo passo a passo.")) return;
    set({ nodes: [], edges: [], orientacao });
    setSel(null);
  }
  function refazerDoZero() {
    set(gerarFluxograma(atividades, undefined, orientacao));
    setSel(null);
  }
  function trocarOrientacao() {
    set(relayout(graph, orientacao === "horizontal" ? "vertical" : "horizontal"));
  }
  function adicionarEtapa() {
    const idx = graph.nodes.filter((n) => !n.parent && n.tipo !== "postit").length;
    const pos = orientacao === "horizontal" ? { x: 110 + idx * 240, y: 90 } : { x: 150, y: 50 + idx * 165 };
    const novo: FlowNode = { id: novoId(), tipo: "processo", texto: "Nova etapa", ...pos };
    const ultimo = sel ? graph.nodes.find((n) => n.id === sel) : [...graph.nodes].reverse().find((n) => n.tipo !== "postit");
    const edges = ultimo && ultimo.tipo !== "postit" ? [...graph.edges, { id: novoId(), de: ultimo.id, para: novo.id, rotulo: "" }] : graph.edges;
    set({ ...graph, nodes: [...graph.nodes, novo], edges });
    setSel(novo.id);
  }
  function adicionarPostit() {
    const novo: FlowNode = { id: novoId(), tipo: "postit", texto: "Anotação", x: 120, y: (bounds.h || 200) + 20 };
    set({ ...graph, nodes: [...graph.nodes, novo] });
    setSel(novo.id);
  }
  function remover(id: string) {
    set({ ...graph, nodes: graph.nodes.filter((n) => n.id !== id), edges: graph.edges.filter((e) => e.de !== id && e.para !== id) });
    setSel(null);
  }

  // ---- drag (compensando o zoom) ----
  function onPointerDown(e: React.PointerEvent, n: FlowNode) {
    if (readOnly) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: n.id, ox: e.clientX, oy: e.clientY, moved: false };
  }
  function onPointerMove(e: React.PointerEvent, n: FlowNode) {
    const d = dragRef.current;
    if (!d || d.id !== n.id) return;
    const dx = (e.clientX - d.ox) / zoom, dy = (e.clientY - d.oy) / zoom;
    if (!d.moved && Math.hypot(e.clientX - d.ox, e.clientY - d.oy) < 3) return;
    d.moved = true; d.ox = e.clientX; d.oy = e.clientY;
    updNode(n.id, { x: Math.max(60, n.x + dx), y: Math.max(30, n.y + dy) });
  }
  function onPointerUp(n: FlowNode) {
    const d = dragRef.current;
    if (d && d.id === n.id && !d.moved) setSel(n.id === sel ? null : n.id);
    dragRef.current = null;
  }

  function exportarPNG() {
    const svg = construirSVG(graph);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = bounds.w * scale; canvas.height = bounds.h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "fluxograma.png";
        a.click();
      });
    };
    img.src = url;
  }

  const selNode = graph.nodes.find((n) => n.id === sel) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && (
          <>
            <Button size="sm" variant="secondary" onClick={sincronizar}><Sparkles className="w-3.5 h-3.5 mr-1" />Gerar do passo a passo</Button>
            {graph.nodes.length > 0 && <Button size="sm" variant="outline" onClick={refazerDoZero}><Sparkles className="w-3.5 h-3.5 mr-1" />Refazer</Button>}
            {graph.nodes.length > 0 && <Button size="sm" variant="outline" onClick={limpar}><Eraser className="w-3.5 h-3.5 mr-1" />Limpar</Button>}
            <Button size="sm" variant="outline" onClick={adicionarEtapa}><Plus className="w-3.5 h-3.5 mr-1" />Etapa</Button>
            <Button size="sm" variant="outline" onClick={adicionarPostit}><StickyNote className="w-3.5 h-3.5 mr-1" />Post-it</Button>
            <Button size="sm" variant="outline" onClick={trocarOrientacao}>
              {orientacao === "horizontal" ? <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> : <ArrowUpDown className="w-3.5 h-3.5 mr-1" />}
              {orientacao === "horizontal" ? "Horizontal" : "Vertical"}
            </Button>
          </>
        )}
        {/* zoom + export (também no modo leitura) */}
        <div className="flex items-center gap-1 ml-auto">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}><ZoomOut className="w-4 h-4" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}><ZoomIn className="w-4 h-4" /></Button>
          {graph.nodes.length > 0 && <Button size="sm" variant="outline" onClick={exportarPNG}><Download className="w-3.5 h-3.5 mr-1" />PNG</Button>}
        </div>
      </div>

      {!readOnly && selNode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Input value={selNode.texto} onChange={(e) => updNode(selNode.id, { texto: e.target.value })} className="h-8 w-56" />
          {selNode.tipo !== "postit" && (
            <Select value={selNode.tipo} onValueChange={(v) => updNode(selNode.id, { tipo: v as FlowTipo })}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inicio">Início</SelectItem>
                <SelectItem value="processo">Etapa</SelectItem>
                <SelectItem value="subetapa">Subetapa</SelectItem>
                <SelectItem value="decisao">Decisão (condicional)</SelectItem>
                <SelectItem value="fim">Fim</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            {PALETA.map((c) => (
              <button key={c} onClick={() => updNode(selNode.id, { cor: c })} className="h-5 w-5 rounded-full border shrink-0" style={{ backgroundColor: c }} title="Cor" />
            ))}
            <input type="color" value={selNode.cor ?? FILL[selNode.tipo]} onChange={(e) => updNode(selNode.id, { cor: e.target.value })} className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent" title="Cor personalizada" />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updNode(selNode.id, { cor: undefined })}>Padrão</Button>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remover(selNode.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      )}

      {graph.nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Workflow className="w-6 h-6 mx-auto mb-2 opacity-60" />
          Preencha o passo a passo e clique em <strong>Gerar do passo a passo</strong> para montar o fluxograma.
        </div>
      ) : (
        <div className="relative overflow-auto overscroll-contain rounded-lg border bg-muted/20" style={{ maxHeight: 560 }}>
          <div style={{ width: bounds.w * zoom, height: bounds.h * zoom }}>
            <div className="relative origin-top-left" style={{ width: bounds.w, height: bounds.h, transform: `scale(${zoom})` }}>
              <svg className="absolute inset-0 pointer-events-none" width={bounds.w} height={bounds.h}>
                <defs>
                  <marker id="fluxo-seta" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
                  </marker>
                </defs>
                {graph.edges.map((edge) => {
                  const de = graph.nodes.find((n) => n.id === edge.de);
                  const para = graph.nodes.find((n) => n.id === edge.para);
                  if (!de || !para) return null;
                  const a = anchor(de, para.x, para.y);
                  const b = anchor(para, de.x, de.y);
                  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                  return (
                    <g key={edge.id}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#64748b" strokeWidth={1.5} markerEnd="url(#fluxo-seta)" />
                      {edge.rotulo ? (
                        <g>
                          <circle cx={mx} cy={my} r={11} fill={edge.rotulo === "Não" ? "#f87171" : "#86efac"} />
                          <text x={mx} y={my + 3} textAnchor="middle" fontSize="9" fill="#0f172a" fontWeight="600">{edge.rotulo}</text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {graph.nodes.map((n) => {
                const { w, h } = FLOW_SIZE[n.tipo];
                const isDiamond = n.tipo === "decisao";
                const style: React.CSSProperties = { left: n.x - w / 2, top: n.y - h / 2, width: w, height: h };
                if (n.cor) { style.backgroundColor = n.cor; style.color = "#0f172a"; style.borderColor = n.cor; }
                return (
                  <div
                    key={n.id}
                    onPointerDown={(e) => onPointerDown(e, n)}
                    onPointerMove={(e) => onPointerMove(e, n)}
                    onPointerUp={() => onPointerUp(n)}
                    className={cn(
                      "absolute flex items-center justify-center border-2 text-center text-[11px] font-medium select-none",
                      CORES[n.tipo],
                      n.tipo === "inicio" || n.tipo === "fim" ? "rounded-full" : isDiamond ? "" : "rounded-md",
                      !readOnly && "cursor-move",
                      sel === n.id && "ring-2 ring-brand ring-offset-2",
                      isDiamond && "rotate-45",
                    )}
                    style={style}
                  >
                    <span className={cn("px-1.5 leading-tight break-words", isDiamond && "-rotate-45 block w-[120px]")}>{n.texto}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!readOnly && graph.nodes.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Arraste os blocos · clique para editar/cor · verde = início/fim · amarelo = processo · losango = decisão · post-it = anotação.</p>
      )}
    </div>
  );
}

/* ---------- Export para SVG (rasterizado em PNG) ---------- */
function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function quebrar(texto: string, maxChars: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if ((atual + " " + p).trim().length > maxChars && atual) { linhas.push(atual); atual = p; }
    else atual = (atual + " " + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 4);
}
function textoSVG(texto: string, cx: number, cy: number, w: number, cor: string) {
  const linhas = quebrar(texto, Math.max(6, Math.floor((w - 16) / 6.6)));
  const lh = 13;
  const y0 = cy - ((linhas.length - 1) * lh) / 2;
  return linhas.map((l, i) =>
    `<text x="${cx}" y="${y0 + i * lh + 4}" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif" font-weight="500" fill="${cor}">${escapar(l)}</text>`
  ).join("");
}
function construirSVG(graph: Fluxograma): string {
  let maxX = 480, maxY = 300;
  for (const n of graph.nodes) {
    const { w, h } = FLOW_SIZE[n.tipo];
    maxX = Math.max(maxX, n.x + w / 2 + 40);
    maxY = Math.max(maxY, n.y + h / 2 + 40);
  }
  const partes: string[] = [];
  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">`);
  partes.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  partes.push(`<defs><marker id="s" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#64748b"/></marker></defs>`);

  for (const edge of graph.edges) {
    const de = graph.nodes.find((n) => n.id === edge.de);
    const para = graph.nodes.find((n) => n.id === edge.para);
    if (!de || !para) continue;
    const a = anchor(de, para.x, para.y);
    const b = anchor(para, de.x, de.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    partes.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#64748b" stroke-width="1.5" marker-end="url(#s)"/>`);
    if (edge.rotulo) {
      partes.push(`<circle cx="${mx}" cy="${my}" r="11" fill="${edge.rotulo === "Não" ? "#f87171" : "#86efac"}"/>`);
      partes.push(`<text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a" font-family="system-ui, sans-serif">${escapar(edge.rotulo)}</text>`);
    }
  }
  for (const n of graph.nodes) {
    const { w, h } = FLOW_SIZE[n.tipo];
    const fill = n.cor ?? FILL[n.tipo];
    const stroke = n.cor ?? STROKE[n.tipo];
    const textCor = n.cor ? "#0f172a" : (n.tipo === "decisao" ? "#ffffff" : "#0f172a");
    const left = n.x - w / 2, top = n.y - h / 2;
    if (n.tipo === "inicio" || n.tipo === "fim") {
      partes.push(`<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    } else if (n.tipo === "decisao") {
      partes.push(`<polygon points="${n.x},${top} ${left + w},${n.y} ${n.x},${top + h} ${left},${n.y}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    } else {
      partes.push(`<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
    }
    partes.push(textoSVG(n.texto, n.x, n.y, n.tipo === "decisao" ? 120 : w, textCor));
  }
  partes.push(`</svg>`);
  return partes.join("");
}
