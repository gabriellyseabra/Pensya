import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Save } from "lucide-react";
import { toast } from "sonner";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";
import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";

type Linha = { aplicar: boolean; data: string; descricao: string; valor: number; tipo: "receita" | "despesa"; categoria: string; erro?: string };

function parseData(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF?.parse_date_code?.(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  for (const fmt of ["yyyy-MM-dd","dd/MM/yyyy","d/M/yyyy","dd-MM-yyyy"]) {
    const d = parse(s, fmt, new Date());
    if (isValid(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}
function parseValor(v: any): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
function parseTipo(v: any): "receita" | "despesa" {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("rec") || s.startsWith("ent") || s === "+") return "receita";
  return "despesa";
}

export function ColarPlanilha() {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);

  function processarMatriz(matriz: any[][]) {
    if (!matriz.length) { toast.error("Vazio"); return; }
    // detectar cabeçalho
    const header = matriz[0].map((c: any) => String(c ?? "").toLowerCase().trim());
    const idx = {
      data: header.findIndex(h => /data|venc|compet/.test(h)),
      desc: header.findIndex(h => /descr|hist|item/.test(h)),
      valor: header.findIndex(h => /valor|preco|preço|montante/.test(h)),
      tipo: header.findIndex(h => /^tipo$|natur/.test(h)),
      cat: header.findIndex(h => /categ|conta|servic|serviço/.test(h)),
    };
    const temHeader = idx.data >= 0 || idx.valor >= 0;
    const body = temHeader ? matriz.slice(1) : matriz;
    const map = temHeader ? idx : { data: 0, desc: 1, valor: 2, tipo: 3, cat: 4 };

    const out: Linha[] = body.filter(r => r.some((c: any) => c !== null && c !== undefined && String(c).trim() !== "")).map(r => {
      const data = parseData(r[map.data]);
      const valor = parseValor(r[map.valor]);
      const erros: string[] = [];
      if (!data) erros.push("data inválida");
      if (!valor) erros.push("valor inválido");
      return {
        aplicar: erros.length === 0,
        data: data ?? "",
        descricao: String(r[map.desc] ?? "Importação"),
        valor: Math.abs(valor),
        tipo: parseTipo(r[map.tipo] ?? (valor < 0 ? "despesa" : "receita")),
        categoria: String(r[map.cat] ?? ""),
        erro: erros.join(", ") || undefined,
      };
    });
    setLinhas(out);
    toast.success(`${out.length} linha(s) detectadas — revise antes de salvar`);
  }

  function processarTexto() {
    const linhas = texto.trim().split(/\r?\n/).map(l => l.split(/\t|;|,/));
    processarMatriz(linhas);
  }

  async function processarArquivo(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const mat: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    processarMatriz(mat);
  }

  async function salvar() {
    const sel = linhas.filter(l => l.aplicar && !l.erro);
    if (!sel.length) { toast.error("Nada selecionado"); return; }
    setSaving(true);
    try {
      const inserts = sel.map(l => ({
        tipo: l.tipo,
        status: "confirmado",
        descricao: l.descricao,
        valor: l.valor,
        vencimento: l.data,
        competencia: l.data,
        pago_em: l.data,
        observacoes: l.categoria ? `Categoria importada: ${l.categoria}` : null,
      }));
      for (let i = 0; i < inserts.length; i += 200) {
        const { error } = await supabase.from("lancamentos_financeiros").insert(inserts.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`${inserts.length} lançamento(s) importados`);
      setLinhas([]); setTexto("");
      invalidarFinanceiro(qc);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Upload XLSX/CSV</Label>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) processarArquivo(f); }} />
          <p className="text-[11px] text-muted-foreground mt-1">Colunas detectadas: data, descrição, valor, tipo, categoria.</p>
        </div>
        <div>
          <Label className="text-xs">Ou cole (TSV/CSV)</Label>
          <Textarea rows={4} placeholder="data;descrição;valor;tipo;categoria" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Button size="sm" variant="outline" className="mt-1" onClick={processarTexto} disabled={!texto.trim()}><Upload className="w-3 h-3 mr-1" />Processar texto</Button>
        </div>
      </div>

      {linhas.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {linhas.filter(l => l.aplicar && !l.erro).length} de {linhas.length} prontos para importar
            </div>
            <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Importar selecionados
            </Button>
          </div>
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l, i) => (
                  <TableRow key={i} className={l.erro ? "bg-destructive/5" : ""}>
                    <TableCell><Checkbox checked={l.aplicar} disabled={!!l.erro} onCheckedChange={(v) => { const n = [...linhas]; n[i].aplicar = !!v; setLinhas(n); }} /></TableCell>
                    <TableCell className="text-xs">{l.data || "—"}</TableCell>
                    <TableCell className="text-xs">{l.descricao}</TableCell>
                    <TableCell><Badge variant={l.tipo === "receita" ? "default" : "destructive"}>{l.tipo}</Badge></TableCell>
                    <TableCell className="text-xs">{l.categoria}</TableCell>
                    <TableCell className="text-right text-xs">{l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell className="text-xs text-destructive">{l.erro}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
