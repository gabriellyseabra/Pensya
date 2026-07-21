import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
type Row = { kind: "receita" | "despesa"; id: string; nome: string; valores: (number | "")[] };

export function GradeAnual() {
  const qc = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [status, setStatus] = useState<"previsto" | "confirmado">("previsto");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: tipos } = useQuery({
    queryKey: ["grade-tipos"],
    queryFn: async () => (await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: planos } = useQuery({
    queryKey: ["grade-planos"],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome, tipo, parent_id, codigo").eq("ativo", true).order("codigo")).data ?? [],
  });

  useMemo(() => {
    if (!tipos || !planos) return;
    if (rows.length) return;
    const r: Row[] = [];
    tipos.forEach((t: any) => r.push({ kind: "receita", id: t.id, nome: t.nome, valores: Array(12).fill("") }));
    planos.filter((p: any) => p.tipo === "despesa" && p.parent_id).forEach((p: any) =>
      r.push({ kind: "despesa", id: p.id, nome: p.nome, valores: Array(12).fill("") })
    );
    setRows(r);
  }, [tipos, planos]);

  function setCell(ri: number, mi: number, v: string) {
    const next = [...rows];
    next[ri].valores[mi] = v === "" ? "" : Number(v);
    setRows(next);
  }

  function replicarColuna(mi: number) {
    const next = rows.map(r => {
      const v = r.valores[mi];
      if (v === "" || v === 0) return r;
      const novos = [...r.valores];
      for (let i = mi + 1; i < 12; i++) if (novos[i] === "") novos[i] = v;
      return { ...r, valores: novos };
    });
    setRows(next);
    toast.success(`Coluna ${MESES[mi]} replicada para os meses seguintes`);
  }

  async function salvar() {
    setSaving(true);
    try {
      const inserts: any[] = [];
      for (const r of rows) {
        for (let m = 0; m < 12; m++) {
          const v = r.valores[m];
          if (v === "" || !v || Number(v) <= 0) continue;
          const data = `${ano}-${String(m + 1).padStart(2, "0")}-01`;
          inserts.push({
            tipo: r.kind,
            status,
            descricao: r.nome + ` — ${MESES[m]}/${ano}`,
            valor: Number(v),
            vencimento: data,
            competencia: data,
            pago_em: status === "confirmado" ? data : null,
            tipo_servico_id: r.kind === "receita" ? r.id : null,
            plano_conta_id: r.kind === "despesa" ? r.id : null,
          });
        }
      }
      if (!inserts.length) { toast.error("Preencha pelo menos uma célula"); setSaving(false); return; }
      // chunks de 200
      for (let i = 0; i < inserts.length; i += 200) {
        const { error } = await supabase.from("lancamentos_financeiros").insert(inserts.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`${inserts.length} lançamento(s) criados`);
      setRows(rows.map(r => ({ ...r, valores: Array(12).fill("") })));
      invalidarFinanceiro(qc);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally { setSaving(false); }
  }

  const totaisCol = MESES.map((_, m) =>
    rows.reduce((s, r) => s + (Number(r.valores[m]) || 0) * (r.kind === "despesa" ? -1 : 1), 0)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Ano</Label>
          <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-24 h-9" />
        </div>
        <div>
          <Label className="text-xs">Status dos lançamentos</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="previsto">Previsto (orçamento)</SelectItem>
              <SelectItem value="confirmado">Confirmado / Realizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar lançamentos
        </Button>
      </div>

      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Categoria</TableHead>
              {MESES.map((m, i) => (
                <TableHead key={m} className="text-center min-w-[90px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{m}</span>
                    <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => replicarColuna(i)} title="Replicar para meses seguintes">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, ri) => (
              <TableRow key={`${r.kind}-${r.id}`}>
                <TableCell className={`sticky left-0 bg-card z-10 text-xs ${r.kind === "despesa" ? "text-destructive" : "text-emerald-600"}`}>
                  <div className="font-medium">{r.nome}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{r.kind}</div>
                </TableCell>
                {r.valores.map((v, mi) => (
                  <TableCell key={mi} className="p-1">
                    <Input
                      type="number" step="0.01" value={v} onChange={(e) => setCell(ri, mi, e.target.value)}
                      className="h-8 text-xs text-right" placeholder="—"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-muted/40">
              <TableCell className="sticky left-0 bg-muted/40 z-10">Saldo do mês</TableCell>
              {totaisCol.map((t, i) => (
                <TableCell key={i} className={`text-right text-xs ${t < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {t.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
