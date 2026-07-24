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

type Modo = "quant" | "qual";
type LinhaQuant = { id: string; item: string; bruto: string; padrao: string; percentil: string };
type LinhaQual = { id: string; item: string; resultado: string; cor: string; nivel: string };
type Estilo = {
  corCabecalho: string; corTextoCab: string; corBorda: string; bordas: boolean; zebra: boolean; corZebra: string;
};
const ESTILO_PADRAO: Estilo = {
  corCabecalho: "#f1f5f9", corTextoCab: "#334155", corBorda: "#cbd5e1", bordas: true, zebra: false, corZebra: "#f8fafc",
};

type Celula = { texto: string; cor?: string };

let _s = 0;
const novaQuant = (): LinhaQuant => ({ id: `q${_s++}`, item: "", bruto: "", padrao: "", percentil: "" });
const novaQual = (): LinhaQual => ({ id: `l${_s++}`, item: "", resultado: "", cor: PALETA_SISTEMA[3].cor, nivel: "" });
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function TabelaResultados({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { rubricas, resolver } = useRubricas();
  const [titulo, setTitulo] = useState("");
  const [modo, setModo] = useState<Modo>("quant");
  const [rubricaId, setRubricaId] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<Estilo>(ESTILO_PADRAO);
  const [quant, setQuant] = useState<LinhaQuant[]>([novaQuant(), novaQuant()]);
  const [qual, setQual] = useState<LinhaQual[]>([novaQual(), novaQual()]);
  const [nomeModelo, setNomeModelo] = useState("");

  const rubrica = resolver(rubricaId);
  const setE = (c: keyof Estilo, v: string | boolean) => setEstilo((e) => ({ ...e, [c]: v }));

  const { data: modelos = [] } = useQuery({
    queryKey: ["tabela-modelos"],
    enabled: open,
    queryFn: async () => (await db.from("tabela_modelos").select("id, nome, config").order("nome")).data ?? [],
  });

  function setQ(id: string, c: keyof LinhaQuant, v: string) { setQuant((ls) => ls.map((l) => (l.id === id ? { ...l, [c]: v } : l))); }
  function setL(id: string, c: keyof LinhaQual, v: string) { setQual((ls) => ls.map((l) => (l.id === id ? { ...l, [c]: v } : l))); }

  const classifDe = (l: LinhaQuant) => classificar(rubrica, {
    percentil: l.percentil !== "" ? Number(l.percentil) : null,
    escorePadrao: l.padrao !== "" ? Number(l.padrao) : null,
  });

  // Estrutura da tabela (cabeçalhos + células), compartilhada pela prévia e pelo HTML.
  const tabela = useMemo(() => {
    if (modo === "quant") {
      const headers = ["Instrumento / variável", "Bruto", "Padrão", "Percentil", "Classificação"];
      const linhas: Celula[][] = quant.filter((l) => l.item.trim()).map((l) => {
        const cl = classifDe(l);
        return [
          { texto: l.item }, { texto: l.bruto || "—" }, { texto: l.padrao || "—" },
          { texto: l.percentil || "—" }, { texto: cl?.rotulo ?? "—", cor: cl?.cor },
        ];
      });
      return { headers, linhas };
    }
    const headers = ["Item", "Resultado / observação", "Nível"];
    const linhas: Celula[][] = qual.filter((l) => l.item.trim()).map((l) => [
      { texto: l.item }, { texto: l.resultado || "—" }, { texto: l.nivel || "—", cor: l.nivel ? l.cor : undefined },
    ]);
    return { headers, linhas };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, quant, qual, rubrica]);

  const bordaCss = estilo.bordas ? `1px solid ${estilo.corBorda}` : "1px solid transparent";

  /** HTML com estilos inline (cola formatado em Word/Docs). */
  function tabelaHtml(): { html: string; plain: string } {
    const th = (t: string) => `<th style="border:${bordaCss};padding:6px 10px;background:${estilo.corCabecalho};color:${estilo.corTextoCab};text-align:left;font-size:13px;">${esc(t)}</th>`;
    const td = (c: Celula) => {
      const s = c.cor ? `background:${c.cor}22;color:${c.cor};font-weight:600;` : "";
      return `<td style="border:${bordaCss};padding:6px 10px;font-size:13px;${s}">${esc(c.texto)}</td>`;
    };
    const body = tabela.linhas.map((row, i) => {
      const bg = estilo.zebra && i % 2 === 1 ? `background:${estilo.corZebra};` : "";
      return `<tr style="${bg}">${row.map(td).join("")}</tr>`;
    }).join("");
    const cap = titulo ? `<caption style="text-align:left;font-weight:600;font-size:14px;padding:4px 0;">${esc(titulo)}</caption>` : "";
    const html = `<table style="border-collapse:collapse;font-family:sans-serif;">${cap}<thead><tr>${tabela.headers.map(th).join("")}</tr></thead><tbody>${body}</tbody></table>`;
    const plain = (titulo ? titulo + "\n" : "") + [tabela.headers, ...tabela.linhas.map((r) => r.map((c) => c.texto))].map((r) => r.join("\t")).join("\n");
    return { html, plain };
  }

  async function copiar() {
    const { html, plain } = tabelaHtml();
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      })]);
      toast.success("Tabela copiada — cole no laudo (Word/Docs)");
    } catch {
      navigator.clipboard.writeText(plain).then(() => toast.success("Tabela copiada como texto"), () => toast.error("Não foi possível copiar"));
    }
  }

  async function salvarModelo() {
    if (!nomeModelo.trim()) { toast.error("Dê um nome ao modelo"); return; }
    const config = { modo, estilo, rubricaSlug: rubrica.slug ?? null };
    const { error } = await db.from("tabela_modelos").insert({ nome: nomeModelo.trim(), config });
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo salvo");
    setNomeModelo("");
    qc.invalidateQueries({ queryKey: ["tabela-modelos"] });
  }

  function carregarModelo(id: string) {
    const m = (modelos as any[]).find((x) => x.id === id);
    if (!m?.config) return;
    if (m.config.modo) setModo(m.config.modo);
    if (m.config.estilo) setEstilo({ ...ESTILO_PADRAO, ...m.config.estilo });
    if (m.config.rubricaSlug) {
      const r = rubricas.find((x) => x.slug === m.config.rubricaSlug);
      setRubricaId(r?.id ?? null);
    }
    toast.success(`Modelo "${m.nome}" aplicado`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tabela de resultados</DialogTitle></DialogHeader>

        {/* Cabeçalho: título, tipo, rubrica, modelos */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-xs">Título da tabela</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resultados quantitativos" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quant">Quantitativa</SelectItem>
                <SelectItem value="qual">Qualitativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modo === "quant" && (
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

        {/* Estilo */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estilo</span>
          <label className="flex items-center gap-1.5 text-xs">Cabeçalho
            <input type="color" value={estilo.corCabecalho} onChange={(e) => setE("corCabecalho", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" />
          </label>
          <label className="flex items-center gap-1.5 text-xs">Texto
            <input type="color" value={estilo.corTextoCab} onChange={(e) => setE("corTextoCab", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" />
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={estilo.bordas} onCheckedChange={(v) => setE("bordas", v)} className="scale-75" />Bordas
          </label>
          {estilo.bordas && (
            <input type="color" value={estilo.corBorda} onChange={(e) => setE("corBorda", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" title="Cor da borda" />
          )}
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={estilo.zebra} onCheckedChange={(v) => setE("zebra", v)} className="scale-75" />Linhas alternadas
          </label>
          {estilo.zebra && (
            <input type="color" value={estilo.corZebra} onChange={(e) => setE("corZebra", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-border/40 bg-transparent" title="Cor das linhas alternadas" />
          )}
        </div>

        {/* Editor */}
        {modo === "quant" ? (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Instrumento / variável</th>
                  <th className="w-20 px-1 py-1.5">Bruto</th><th className="w-20 px-1 py-1.5">Padrão</th>
                  <th className="w-20 px-1 py-1.5">Percentil</th><th className="w-40 px-1 py-1.5">Classificação</th><th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {quant.map((l) => {
                  const cl = classifDe(l);
                  return (
                    <tr key={l.id} className="border-t border-border/40">
                      <td className="px-1 py-1"><Input value={l.item} onChange={(e) => setQ(l.id, "item", e.target.value)} className="h-8 text-xs" placeholder="Nome" /></td>
                      <td className="px-1 py-1"><Input value={l.bruto} onChange={(e) => setQ(l.id, "bruto", e.target.value)} className="h-8 text-xs" /></td>
                      <td className="px-1 py-1"><Input type="number" value={l.padrao} onChange={(e) => setQ(l.id, "padrao", e.target.value)} className="h-8 text-xs" /></td>
                      <td className="px-1 py-1"><Input type="number" value={l.percentil} onChange={(e) => setQ(l.id, "percentil", e.target.value)} className="h-8 text-xs" /></td>
                      <td className="px-1 py-1">{cl ? <span className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${cl.cor}26`, color: cl.cor }}>{cl.rotulo}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="px-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQuant((ls) => ls.filter((x) => x.id !== l.id))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-2 py-1.5 text-left">Item</th><th className="px-2 py-1.5 text-left">Resultado / observação</th><th className="w-56 px-1 py-1.5">Nível</th><th className="w-8" /></tr>
              </thead>
              <tbody>
                {qual.map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="px-1 py-1"><Input value={l.item} onChange={(e) => setL(l.id, "item", e.target.value)} className="h-8 text-xs" placeholder="Ex.: Consciência fonológica" /></td>
                    <td className="px-1 py-1"><Input value={l.resultado} onChange={(e) => setL(l.id, "resultado", e.target.value)} className="h-8 text-xs" placeholder="Descrição" /></td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1.5">
                        <Input value={l.nivel} onChange={(e) => setL(l.id, "nivel", e.target.value)} className="h-8 flex-1 text-xs" placeholder="Ex.: Adquirido" />
                        <div className="flex gap-0.5">
                          {PALETA_SISTEMA.map((c) => (
                            <button key={c.cor} type="button" title={c.nome} onClick={() => setL(l.id, "cor", c.cor)}
                              className={`h-5 w-5 rounded-full border-2 ${l.cor === c.cor ? "border-foreground/70 scale-110" : "border-transparent"}`} style={{ backgroundColor: c.cor }} />
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQual((ls) => ls.filter((x) => x.id !== l.id))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => (modo === "quant" ? setQuant((l) => [...l, novaQuant()]) : setQual((l) => [...l, novaQual()]))}>
            <Plus className="mr-1 h-3.5 w-3.5" />Linha
          </Button>
          <Button size="sm" variant="outline" className="ml-auto h-8 text-xs" onClick={copiar}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar tabela
          </Button>
        </div>

        {/* Pré-visualização */}
        <div>
          <Label className="text-xs text-muted-foreground">Pré-visualização (como sai no laudo)</Label>
          <div className="mt-1 overflow-x-auto rounded-lg border border-border/40 bg-white p-3">
            {tabela.linhas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Preencha ao menos um item.</p>
            ) : (
              <table style={{ borderCollapse: "collapse", fontFamily: "sans-serif" }}>
                {titulo && <caption style={{ textAlign: "left", fontWeight: 600, fontSize: 14, padding: "4px 0", color: "#334155" }}>{titulo}</caption>}
                <thead>
                  <tr>{tabela.headers.map((h, i) => (
                    <th key={i} style={{ border: bordaCss, padding: "6px 10px", background: estilo.corCabecalho, color: estilo.corTextoCab, textAlign: "left", fontSize: 13 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {tabela.linhas.map((row, ri) => (
                    <tr key={ri} style={{ background: estilo.zebra && ri % 2 === 1 ? estilo.corZebra : undefined }}>
                      {row.map((c, ci) => (
                        <td key={ci} style={{ border: bordaCss, padding: "6px 10px", fontSize: 13, ...(c.cor ? { background: `${c.cor}22`, color: c.cor, fontWeight: 600 } : { color: "#334155" }) }}>{c.texto}</td>
                      ))}
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
              <SelectContent>
                {(modelos as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Salvar estilo atual como modelo</Label>
            <Input value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} placeholder="Nome do modelo" className="h-9" />
          </div>
          <Button size="sm" variant="outline" className="h-9" onClick={salvarModelo}>
            <Save className="mr-1.5 h-4 w-4" />Salvar modelo
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          O modelo guarda o tipo, a rubrica e o estilo (cores, bordas, linhas) — não os dados. "Copiar tabela" cola formatada e editável no Word/Docs.
        </p>
      </DialogContent>
    </Dialog>
  );
}
