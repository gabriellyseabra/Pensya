import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { useRubricas } from "@/hooks/use-rubricas";
import { classificar, PALETA_SISTEMA } from "@/lib/avaliacao-classificacao";

const db = supabase as any;

type ColTipo = "texto" | "numero" | "nivel" | "classificacao";
type Coluna = { id: string; nome: string; tipo: ColTipo; fonte?: string };
type ValorNivel = { texto: string; cor: string };
type Celula = { texto: string; cor?: string };
type Linha = { id: string; cells: Record<string, string | ValorNivel> };
type Estilo = { corCabecalho: string; corTextoCab: string; corBorda: string; bordas: boolean; zebra: boolean; corZebra: string };

const ESTILO_PADRAO: Estilo = { corCabecalho: "#f1f5f9", corTextoCab: "#334155", corBorda: "#cbd5e1", bordas: true, zebra: false, corZebra: "#f8fafc" };
const TIPO_LABEL: Record<ColTipo, string> = { texto: "Texto", numero: "Número", nivel: "Nível (cor)", classificacao: "Classificação (auto)" };

let _s = 0;
const cid = () => `c${_s++}`;
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function colsQuant(): Coluna[] {
  const perc: Coluna = { id: cid(), nome: "Percentil", tipo: "numero" };
  return [
    { id: cid(), nome: "Instrumento / variável", tipo: "texto" },
    { id: cid(), nome: "Bruto", tipo: "numero" },
    { id: cid(), nome: "Padrão", tipo: "numero" },
    perc,
    { id: cid(), nome: "Classificação", tipo: "classificacao", fonte: perc.id },
  ];
}
function colsQual(): Coluna[] {
  return [
    { id: cid(), nome: "Item", tipo: "texto" },
    { id: cid(), nome: "Resultado / observação", tipo: "texto" },
    { id: cid(), nome: "Nível", tipo: "nivel" },
  ];
}
const novaLinha = (): Linha => ({ id: `r${_s++}`, cells: {} });

export function TabelaResultados({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { rubricas, resolver } = useRubricas();
  const [titulo, setTitulo] = useState("");
  const [rubricaId, setRubricaId] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<Estilo>(ESTILO_PADRAO);
  const [colunas, setColunas] = useState<Coluna[]>(colsQuant);
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha(), novaLinha()]);
  const [nomeModelo, setNomeModelo] = useState("");

  const rubrica = resolver(rubricaId);
  const temClassif = colunas.some((c) => c.tipo === "classificacao");
  const colsNumericas = colunas.filter((c) => c.tipo === "numero");
  const setE = (c: keyof Estilo, v: string | boolean) => setEstilo((e) => ({ ...e, [c]: v }));

  const { data: modelos = [] } = useQuery({
    queryKey: ["tabela-modelos"],
    enabled: open,
    queryFn: async () => (await db.from("tabela_modelos").select("id, nome, config").order("nome")).data ?? [],
  });

  /* ---- colunas ---- */
  function setCol(id: string, patch: Partial<Coluna>) { setColunas((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function addColuna() { setColunas((cs) => [...cs, { id: cid(), nome: "Nova coluna", tipo: "texto" }]); }
  function removeColuna(id: string) {
    setColunas((cs) => cs.filter((c) => c.id !== id).map((c) => (c.fonte === id ? { ...c, fonte: undefined } : c)));
  }
  function aplicarTemplate(t: "quant" | "qual") {
    setColunas(t === "quant" ? colsQuant() : colsQual());
    setLinhas([novaLinha(), novaLinha()]);
  }

  /* ---- células ---- */
  const getCel = (row: Linha, colId: string) => row.cells[colId];
  function setCel(rowId: string, colId: string, v: string | ValorNivel) {
    setLinhas((ls) => ls.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: v } } : r)));
  }
  const getNivel = (row: Linha, colId: string): ValorNivel => {
    const v = row.cells[colId];
    return typeof v === "object" && v ? v : { texto: "", cor: PALETA_SISTEMA[3].cor };
  };
  function classifDaFonte(row: Linha, col: Coluna): Celula | null {
    if (!col.fonte) return null;
    const raw = row.cells[col.fonte];
    const val = typeof raw === "string" && raw !== "" ? Number(raw) : null;
    if (val == null || Number.isNaN(val)) return null;
    const cl = classificar(rubrica, { percentil: val, escorePadrao: val });
    return cl ? { texto: cl.rotulo, cor: cl.cor } : null;
  }

  // Estrutura para prévia/HTML.
  const tabela = useMemo(() => {
    const headers = colunas.map((c) => c.nome);
    const linhasCel: Celula[][] = linhas
      .filter((r) => colunas.some((c) => { const v = r.cells[c.id]; return typeof v === "object" ? v.texto?.trim() : (v ?? "").toString().trim(); }))
      .map((r) => colunas.map((c): Celula => {
        if (c.tipo === "classificacao") return classifDaFonte(r, c) ?? { texto: "—" };
        if (c.tipo === "nivel") { const n = getNivel(r, c.id); return { texto: n.texto || "—", cor: n.texto ? n.cor : undefined }; }
        const v = r.cells[c.id]; return { texto: (typeof v === "string" ? v : "") || "—" };
      }));
    return { headers, linhas: linhasCel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas, linhas, rubrica]);

  const bordaCss = estilo.bordas ? `1px solid ${estilo.corBorda}` : "1px solid transparent";

  function tabelaHtml(): { html: string; plain: string } {
    const th = (t: string) => `<th style="border:${bordaCss};padding:6px 10px;background:${estilo.corCabecalho};color:${estilo.corTextoCab};text-align:left;font-size:13px;">${esc(t)}</th>`;
    const td = (c: Celula) => `<td style="border:${bordaCss};padding:6px 10px;font-size:13px;${c.cor ? `background:${c.cor}22;color:${c.cor};font-weight:600;` : ""}">${esc(c.texto)}</td>`;
    const body = tabela.linhas.map((row, i) => `<tr style="${estilo.zebra && i % 2 === 1 ? `background:${estilo.corZebra};` : ""}">${row.map(td).join("")}</tr>`).join("");
    const cap = titulo ? `<caption style="text-align:left;font-weight:600;font-size:14px;padding:4px 0;">${esc(titulo)}</caption>` : "";
    const html = `<table style="border-collapse:collapse;font-family:sans-serif;">${cap}<thead><tr>${tabela.headers.map(th).join("")}</tr></thead><tbody>${body}</tbody></table>`;
    const plain = (titulo ? titulo + "\n" : "") + [tabela.headers, ...tabela.linhas.map((r) => r.map((c) => c.texto))].map((r) => r.join("\t")).join("\n");
    return { html, plain };
  }

  async function copiar() {
    const { html, plain } = tabelaHtml();
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
      toast.success("Tabela copiada — cole no laudo (Word/Docs)");
    } catch {
      navigator.clipboard.writeText(plain).then(() => toast.success("Tabela copiada como texto"), () => toast.error("Não foi possível copiar"));
    }
  }

  async function salvarModelo() {
    if (!nomeModelo.trim()) { toast.error("Dê um nome ao modelo"); return; }
    const config = { colunas, estilo, rubricaSlug: rubrica.slug ?? null };
    const { error } = await db.from("tabela_modelos").insert({ nome: nomeModelo.trim(), config });
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo salvo");
    setNomeModelo("");
    qc.invalidateQueries({ queryKey: ["tabela-modelos"] });
  }
  function carregarModelo(id: string) {
    const m = (modelos as any[]).find((x) => x.id === id);
    if (!m?.config) return;
    if (Array.isArray(m.config.colunas)) { setColunas(m.config.colunas); setLinhas([novaLinha(), novaLinha()]); }
    if (m.config.estilo) setEstilo({ ...ESTILO_PADRAO, ...m.config.estilo });
    if (m.config.rubricaSlug) setRubricaId(rubricas.find((x) => x.slug === m.config.rubricaSlug)?.id ?? null);
    toast.success(`Modelo "${m.nome}" aplicado`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tabela de resultados</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-xs">Título da tabela</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resultados quantitativos" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Começar de</Label>
            <Select value="" onValueChange={(v) => aplicarTemplate(v as "quant" | "qual")}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Modelo base" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quant">Quantitativa</SelectItem>
                <SelectItem value="qual">Qualitativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {temClassif && (
            <div>
              <Label className="text-xs">Rubrica</Label>
              <Select value={rubricaId ?? "__padrao__"} onValueChange={(v) => setRubricaId(v === "__padrao__" ? null : v)}>
                <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__padrao__">Padrão (7 faixas)</SelectItem>
                  {rubricas.filter((r) => r.id).map((r) => <SelectItem key={r.id} value={r.id!}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Configurador de colunas */}
        <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Colunas</span>
          <div className="flex flex-wrap gap-2">
            {colunas.map((c) => (
              <div key={c.id} className="flex items-center gap-1 rounded-md border border-border/40 bg-background/60 p-1">
                <Input value={c.nome} onChange={(e) => setCol(c.id, { nome: e.target.value })} className="h-7 w-32 text-xs" />
                <Select value={c.tipo} onValueChange={(v) => setCol(c.id, { tipo: v as ColTipo })}>
                  <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["texto", "numero", "nivel", "classificacao"] as ColTipo[]).map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {c.tipo === "classificacao" && (
                  <Select value={c.fonte ?? "__none__"} onValueChange={(v) => setCol(c.id, { fonte: v === "__none__" ? undefined : v })}>
                    <SelectTrigger className="h-7 w-24 text-[11px]"><SelectValue placeholder="fonte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— fonte —</SelectItem>
                      {colsNumericas.map((n) => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeColuna(c.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addColuna}><Plus className="mr-1 h-3.5 w-3.5" />Coluna</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">"Classificação (auto)" calcula pela rubrica a partir de uma coluna numérica (a fonte, ex.: Percentil). "Nível (cor)" você define o rótulo e a cor por célula.</p>
        </div>

        {/* Estilo */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estilo</span>
          <label className="flex items-center gap-1.5 text-xs">Cabeçalho<input type="color" value={estilo.corCabecalho} onChange={(e) => setE("corCabecalho", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" /></label>
          <label className="flex items-center gap-1.5 text-xs">Texto<input type="color" value={estilo.corTextoCab} onChange={(e) => setE("corTextoCab", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" /></label>
          <label className="flex items-center gap-1.5 text-xs"><Switch checked={estilo.bordas} onCheckedChange={(v) => setE("bordas", v)} className="scale-75" />Bordas</label>
          {estilo.bordas && <input type="color" value={estilo.corBorda} onChange={(e) => setE("corBorda", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" title="Cor da borda" />}
          <label className="flex items-center gap-1.5 text-xs"><Switch checked={estilo.zebra} onCheckedChange={(v) => setE("zebra", v)} className="scale-75" />Linhas alternadas</label>
          {estilo.zebra && <input type="color" value={estilo.corZebra} onChange={(e) => setE("corZebra", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" title="Cor das linhas alternadas" />}
        </div>

        {/* Editor de dados */}
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {colunas.map((c) => <th key={c.id} className="px-2 py-1.5 text-left">{c.nome}</th>)}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  {colunas.map((c) => (
                    <td key={c.id} className="px-1 py-1">
                      {c.tipo === "classificacao" ? (
                        (() => { const cl = classifDaFonte(row, c); return cl ? <span className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${cl.cor}26`, color: cl.cor }}>{cl.texto}</span> : <span className="text-xs text-muted-foreground">—</span>; })()
                      ) : c.tipo === "nivel" ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={getNivel(row, c.id).texto} onChange={(e) => setCel(row.id, c.id, { texto: e.target.value, cor: getNivel(row, c.id).cor })} className="h-8 flex-1 text-xs" placeholder="Ex.: Adquirido" />
                          <div className="flex gap-0.5">
                            {PALETA_SISTEMA.map((p) => (
                              <button key={p.cor} type="button" title={p.nome} onClick={() => setCel(row.id, c.id, { texto: getNivel(row, c.id).texto, cor: p.cor })}
                                className={`h-5 w-5 rounded-full border-2 ${getNivel(row, c.id).cor === p.cor ? "border-foreground/70 scale-110" : "border-transparent"}`} style={{ backgroundColor: p.cor }} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Input type={c.tipo === "numero" ? "number" : "text"} value={(getCel(row, c.id) as string) ?? ""} onChange={(e) => setCel(row.id, c.id, e.target.value)} className="h-8 text-xs" />
                      )}
                    </td>
                  ))}
                  <td className="px-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== row.id))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLinhas((l) => [...l, novaLinha()])}><Plus className="mr-1 h-3.5 w-3.5" />Linha</Button>
          <Button size="sm" variant="outline" className="ml-auto h-8 text-xs" onClick={copiar}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar tabela</Button>
        </div>

        {/* Pré-visualização */}
        <div>
          <Label className="text-xs text-muted-foreground">Pré-visualização (como sai no laudo)</Label>
          <div className="mt-1 overflow-x-auto rounded-lg border border-border/40 bg-white p-3">
            {tabela.linhas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Preencha ao menos uma linha.</p>
            ) : (
              <table style={{ borderCollapse: "collapse", fontFamily: "sans-serif" }}>
                {titulo && <caption style={{ textAlign: "left", fontWeight: 600, fontSize: 14, padding: "4px 0", color: "#334155" }}>{titulo}</caption>}
                <thead><tr>{tabela.headers.map((h, i) => <th key={i} style={{ border: bordaCss, padding: "6px 10px", background: estilo.corCabecalho, color: estilo.corTextoCab, textAlign: "left", fontSize: 13 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {tabela.linhas.map((row, ri) => (
                    <tr key={ri} style={{ background: estilo.zebra && ri % 2 === 1 ? estilo.corZebra : undefined }}>
                      {row.map((c, ci) => <td key={ci} style={{ border: bordaCss, padding: "6px 10px", fontSize: 13, ...(c.cor ? { background: `${c.cor}22`, color: c.cor, fontWeight: 600 } : { color: "#334155" }) }}>{c.texto}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modelos */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/40 bg-muted/20 p-3">
          <div>
            <Label className="text-xs">Aplicar um modelo salvo</Label>
            <Select value="" onValueChange={carregarModelo}>
              <SelectTrigger className="h-9 w-52"><SelectValue placeholder={(modelos as any[]).length ? "Escolher modelo" : "Nenhum modelo salvo"} /></SelectTrigger>
              <SelectContent>{(modelos as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Salvar como modelo (colunas + estilo)</Label>
            <Input value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Nome do modelo" className="h-9" />
          </div>
          <Button size="sm" variant="outline" className="h-9" onClick={salvarModelo}><Save className="mr-1.5 h-4 w-4" />Salvar modelo</Button>
        </div>

        <p className="text-[11px] text-muted-foreground">O modelo guarda as colunas, a rubrica e o estilo — não os dados. "Copiar tabela" cola formatada e editável no Word/Docs.</p>
      </DialogContent>
    </Dialog>
  );
}
