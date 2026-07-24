import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRubricas } from "@/hooks/use-rubricas";
import { classificar, PALETA_SISTEMA } from "@/lib/avaliacao-classificacao";

type Modo = "quant" | "qual";
type LinhaQuant = { id: string; item: string; bruto: string; padrao: string; percentil: string };
type LinhaQual = { id: string; item: string; resultado: string; cor: string; nivel: string };

let _s = 0;
const novaQuant = (): LinhaQuant => ({ id: `q${_s++}`, item: "", bruto: "", padrao: "", percentil: "" });
const novaQual = (): LinhaQual => ({ id: `l${_s++}`, item: "", resultado: "", cor: PALETA_SISTEMA[3].cor, nivel: "" });

const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function TabelaResultados({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rubricas, resolver } = useRubricas();
  const [titulo, setTitulo] = useState("");
  const [modo, setModo] = useState<Modo>("quant");
  const [rubricaId, setRubricaId] = useState<string | null>(null);
  const [quant, setQuant] = useState<LinhaQuant[]>([novaQuant(), novaQuant()]);
  const [qual, setQual] = useState<LinhaQual[]>([novaQual(), novaQual()]);

  const rubrica = resolver(rubricaId);

  function setQ(id: string, c: keyof LinhaQuant, v: string) {
    setQuant((ls) => ls.map((l) => (l.id === id ? { ...l, [c]: v } : l)));
  }
  function setL(id: string, c: keyof LinhaQual, v: string) {
    setQual((ls) => ls.map((l) => (l.id === id ? { ...l, [c]: v } : l)));
  }

  const classifDe = (l: LinhaQuant) =>
    classificar(rubrica, {
      percentil: l.percentil !== "" ? Number(l.percentil) : null,
      escorePadrao: l.padrao !== "" ? Number(l.padrao) : null,
    });

  /** Gera a tabela como HTML com estilos inline (cola formatada em Word/Docs). */
  function tabelaHtml(): { html: string; plain: string } {
    const th = (t: string) => `<th style="border:1px solid #cbd5e1;padding:6px 10px;background:#f1f5f9;text-align:left;font-size:13px;">${esc(t)}</th>`;
    const td = (t: string, style = "") => `<td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:13px;${style}">${esc(t)}</td>`;
    let head = "";
    let body = "";
    const plainRows: string[][] = [];
    if (modo === "quant") {
      head = th("Instrumento / variável") + th("Bruto") + th("Padrão") + th("Percentil") + th("Classificação");
      for (const l of quant) {
        if (!l.item.trim()) continue;
        const cl = classifDe(l);
        const clStyle = cl ? `background:${cl.cor}22;color:${cl.cor};font-weight:600;` : "";
        body += `<tr>${td(l.item)}${td(l.bruto || "—")}${td(l.padrao || "—")}${td(l.percentil || "—")}${td(cl?.rotulo ?? "—", clStyle)}</tr>`;
        plainRows.push([l.item, l.bruto || "—", l.padrao || "—", l.percentil || "—", cl?.rotulo ?? "—"]);
      }
    } else {
      head = th("Item") + th("Resultado / observação") + th("Nível");
      for (const l of qual) {
        if (!l.item.trim()) continue;
        const style = l.nivel ? `background:${l.cor}22;color:${l.cor};font-weight:600;` : "";
        body += `<tr>${td(l.item)}${td(l.resultado || "—")}${td(l.nivel || "—", style)}</tr>`;
        plainRows.push([l.item, l.resultado || "—", l.nivel || "—"]);
      }
    }
    const cap = titulo ? `<caption style="text-align:left;font-weight:600;font-size:14px;padding:4px 0;">${esc(titulo)}</caption>` : "";
    const html = `<table style="border-collapse:collapse;border:1px solid #cbd5e1;font-family:sans-serif;">${cap}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    const plain = (titulo ? titulo + "\n" : "") + plainRows.map((r) => r.join("\t")).join("\n");
    return { html, plain };
  }

  async function copiar() {
    const { html, plain } = tabelaHtml();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      toast.success("Tabela copiada — cole no laudo (Word/Docs)");
    } catch {
      navigator.clipboard.writeText(plain).then(
        () => toast.success("Tabela copiada como texto"),
        () => toast.error("Não foi possível copiar"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tabela de resultados</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs">Título da tabela</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resultados quantitativos" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__padrao__">Padrão (7 faixas)</SelectItem>
                  {rubricas.filter((r) => r.id).map((r) => <SelectItem key={r.id} value={r.id!}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" className="ml-auto h-9" onClick={copiar}>
            <Copy className="mr-1.5 h-4 w-4" />Copiar tabela
          </Button>
        </div>

        {modo === "quant" ? (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Instrumento / variável</th>
                  <th className="w-20 px-1 py-1.5">Bruto</th>
                  <th className="w-20 px-1 py-1.5">Padrão</th>
                  <th className="w-20 px-1 py-1.5">Percentil</th>
                  <th className="w-40 px-1 py-1.5">Classificação</th>
                  <th className="w-8" />
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
                      <td className="px-1 py-1">
                        {cl
                          ? <span className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${cl.cor}26`, color: cl.cor }}>{cl.rotulo}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
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
                <tr>
                  <th className="px-2 py-1.5 text-left">Item</th>
                  <th className="px-2 py-1.5 text-left">Resultado / observação</th>
                  <th className="w-56 px-1 py-1.5">Nível</th>
                  <th className="w-8" />
                </tr>
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
                              className={`h-5 w-5 rounded-full border-2 ${l.cor === c.cor ? "border-foreground/70 scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: c.cor }} />
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

        <Button size="sm" variant="outline" className="h-8 self-start text-xs"
          onClick={() => (modo === "quant" ? setQuant((l) => [...l, novaQuant()]) : setQual((l) => [...l, novaQual()]))}>
          <Plus className="mr-1 h-3.5 w-3.5" />Linha
        </Button>

        <p className="text-[11px] text-muted-foreground">
          "Copiar tabela" copia formatada (com as cores) para colar no laudo em Word ou Google Docs — onde continua editável.
        </p>
      </DialogContent>
    </Dialog>
  );
}
