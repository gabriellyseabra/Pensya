import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, Minus, Download } from "lucide-react";
import { toast } from "sonner";
import { classificar, corPastel, RUBRICA_PADRAO } from "@/lib/avaliacao-classificacao";

const db = supabase as any;

/** Baixa o SVG do gráfico como PNG (fundo branco, 2x). */
function baixarPng(container: HTMLElement | null, filename: string) {
  const svg = container?.querySelector("svg");
  if (!svg) { toast.error("Nada para exportar"); return; }
  const w = svg.clientWidth || 800, h = svg.clientHeight || 420;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.scale(2, 2); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u); }, "image/png");
  };
  img.onerror = () => toast.error("Falha ao gerar a imagem");
  img.src = src;
}

const corDe = (percentil: number) => classificar(RUBRICA_PADRAO, { percentil })?.cor ?? "#94a3b8";

export function ComparadorAvaliacoes({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [pacienteId, setPacienteId] = useState("");
  const [avalA, setAvalA] = useState("");
  const [avalB, setAvalB] = useState("");

  const { data: pacientes = [] } = useQuery({
    queryKey: ["cmp-pacientes"],
    queryFn: async () => (await db.from("pacientes").select("id, nome").order("nome")).data ?? [],
    enabled: open,
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["cmp-avaliacoes", pacienteId],
    enabled: open && !!pacienteId,
    queryFn: async () => (await db.from("avaliacoes")
      .select("id, titulo, data_inicio").eq("paciente_id", pacienteId).order("data_inicio")).data ?? [],
  });

  const { data: aplicadosA = [] } = useQuery({
    queryKey: ["cmp-aplic", avalA],
    enabled: open && !!avalA,
    queryFn: async () => (await db.from("testes_aplicados")
      .select("teste_id, percentil, teste:testes_catalogo(nome)").eq("avaliacao_id", avalA)).data ?? [],
  });
  const { data: aplicadosB = [] } = useQuery({
    queryKey: ["cmp-aplic", avalB],
    enabled: open && !!avalB,
    queryFn: async () => (await db.from("testes_aplicados")
      .select("teste_id, percentil, teste:testes_catalogo(nome)").eq("avaliacao_id", avalB)).data ?? [],
  });

  // Testes presentes nas DUAS avaliações, com percentil nos dois momentos.
  const dados = useMemo(() => {
    const mapa = new Map<string, { nome: string; pre?: number; pos?: number }>();
    for (const a of aplicadosA as any[]) {
      if (a.percentil == null) continue;
      mapa.set(a.teste_id, { nome: a.teste?.nome ?? "—", pre: Number(a.percentil) });
    }
    for (const b of aplicadosB as any[]) {
      if (b.percentil == null) continue;
      const cur = mapa.get(b.teste_id);
      if (cur) cur.pos = Number(b.percentil);
    }
    return Array.from(mapa.values())
      .filter((d) => d.pre != null && d.pos != null)
      .map((d) => ({ ...d, delta: (d.pos! - d.pre!) }));
  }, [aplicadosA, aplicadosB]);

  const avalOptions = avaliacoes as any[];
  const nomePac = (pacientes as any[]).find((p) => p.id === pacienteId)?.nome ?? "avaliacao";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comparador de avaliações (evolução)</DialogTitle></DialogHeader>

        <p className="text-xs text-muted-foreground">
          Compara o <b>percentil</b> de cada teste em dois momentos. Aparecem só os testes presentes nas duas
          avaliações. As cores seguem a classificação (paleta do sistema): contorno = antes, preenchido = depois.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Paciente</Label>
            <Select value={pacienteId} onValueChange={(v) => { setPacienteId(v); setAvalA(""); setAvalB(""); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(pacientes as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Avaliação (antes)</Label>
            <Select value={avalA} onValueChange={setAvalA} disabled={!pacienteId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {avalOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Avaliação (depois)</Label>
            <Select value={avalB} onValueChange={setAvalB} disabled={!pacienteId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {avalOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {avalA && avalB && dados.length === 0 && (
          <p className="rounded-md bg-muted/30 p-3 text-center text-sm text-muted-foreground">
            Nenhum teste com percentil presente nas duas avaliações selecionadas.
          </p>
        )}

        {dados.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Gráfico</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => baixarPng(chartRef.current, `evolucao-${nomePac.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}.png`)}>
                <Download className="mr-1 h-3.5 w-3.5" />PNG
              </Button>
            </div>
            <div ref={chartRef} className="rounded-lg border border-border/40 bg-white p-3">
              <ResponsiveContainer width="100%" height={Math.max(240, dados.length * 54 + 40)}>
                <BarChart layout="vertical" data={dados} margin={{ left: 8, right: 40, top: 6, bottom: 6 }} barGap={2}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, n: any) => [v, n === "pre" ? "Antes" : "Depois"]} />
                  <Bar dataKey="pre" name="Antes" barSize={12} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {dados.map((d, i) => <Cell key={i} fill="#ffffff" stroke={corDe(d.pre!)} strokeWidth={1.5} />)}
                  </Bar>
                  <Bar dataKey="pos" name="Depois" barSize={12} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    <LabelList dataKey="pos" position="right" style={{ fontSize: 10, fill: "#334155" }} />
                    {dados.map((d, i) => <Cell key={i} fill={corPastel(corDe(d.pos!))} stroke={corDe(d.pos!)} strokeOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-[10px] text-muted-foreground">Percentil · contorno = antes · preenchido = depois</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Teste</th>
                    <th className="px-3 py-2 text-right">Antes</th>
                    <th className="px-3 py-2 text-right">Depois</th>
                    <th className="px-3 py-2 text-right">Evolução</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map((d, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-1.5">{d.nome}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.pre}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.pos}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`inline-flex items-center gap-1 tabular-nums ${d.delta > 0 ? "text-emerald-600" : d.delta < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                          {d.delta > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : d.delta < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          {d.delta > 0 ? "+" : ""}{d.delta}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
