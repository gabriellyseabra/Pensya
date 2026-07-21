import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckCircle2, Lightbulb, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CATEGORIAS = ["curso", "equipamento", "software", "reforma", "manutencao", "marketing", "outro"];
const STATUS = ["ideia", "aprovado", "em_andamento", "concluido", "descartado"];

export function Investimentos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>("ativos");

  const { data: rows } = useQuery({
    queryKey: ["investimentos", statusFiltro],
    queryFn: async () => {
      let q = supabase.from("investimentos").select("*").order("prioridade").order("prazo", { nullsFirst: false });
      if (statusFiltro === "ativos") q = q.in("status", ["ideia", "aprovado", "em_andamento"]);
      else if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Simulador: pega burn rate dos últimos 3 meses e saldo atual
  const { data: financialContext } = useQuery({
    queryKey: ["invest-ctx"],
    queryFn: async () => {
      const ini = startOfMonth(subMonths(new Date(), 3));
      const [contasRes, lancsRes, pagsRes] = await Promise.all([
        supabase.from("contas_financeiras").select("saldo_inicial").eq("ativo", true),
        supabase.from("lancamentos_financeiros").select("valor, tipo, status, vencimento, pago_em")
          .eq("status", "confirmado").gte("vencimento", ini.toISOString().slice(0, 10)),
        supabase.from("pagamentos").select("valor, status, pago_em")
          .eq("status", "pago").gte("pago_em", ini.toISOString().slice(0, 10)),
      ]);
      const saldoInicial = (contasRes.data ?? []).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
      const receitas = (lancsRes.data ?? []).filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0)
        + (pagsRes.data ?? []).reduce((s, p) => s + Number(p.valor), 0);
      const despesas = (lancsRes.data ?? []).filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
      const saldo = saldoInicial + receitas - despesas;
      const burn = Math.max(0, (despesas - receitas) / 3);
      const sobra = Math.max(0, (receitas - despesas) / 3);
      return { saldo, burn, sobra };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investimentos"] }); toast.success("Removido"); },
  });

  const aprovar = useMutation({
    mutationFn: async (inv: any) => {
      const vencimento = inv.prazo ?? new Date().toISOString().slice(0, 10);
      const { data: lanc, error: lErr } = await supabase.from("lancamentos_financeiros").insert({
        tipo: "despesa", status: "previsto",
        descricao: `Investimento • ${inv.nome}`,
        valor: Number(inv.valor),
        competencia: vencimento, vencimento,
        plano_conta_id: inv.plano_conta_id, fornecedor_id: inv.fornecedor_id,
        observacoes: `Categoria: ${inv.categoria}. ${inv.observacoes ?? ""}`.trim(),
      }).select("id").single();
      if (lErr) throw lErr;
      const { error } = await supabase.from("investimentos")
        .update({ status: "aprovado", aprovado_em: new Date().toISOString(), lancamento_id: lanc.id })
        .eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investimentos"] });
      invalidarFinanceiro(qc);
      toast.success("Aprovado e lançado como despesa prevista");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const totalIdeia = (rows ?? []).filter((r) => r.status === "ideia").reduce((s, r) => s + Number(r.valor), 0);
  const totalAprovado = (rows ?? []).filter((r) => r.status === "aprovado" || r.status === "em_andamento").reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="space-y-4">
      <Card className="glass gradient-brand text-white">
        <CardHeader><CardTitle className="text-base text-white/90">Simulador de capacidade de investimento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs opacity-80">Saldo estimado hoje</p>
              <p className="text-2xl font-semibold">{currency(financialContext?.saldo ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Burn rate (média 3 meses)</p>
              <p className="text-2xl font-semibold">{currency(financialContext?.burn ?? 0)}/mês</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Sobra média (3 meses)</p>
              <p className="text-2xl font-semibold">{currency(financialContext?.sobra ?? 0)}/mês</p>
            </div>
          </div>
          <p className="text-xs mt-3 opacity-80">
            Em ideias: <strong>{currency(totalIdeia)}</strong> • Aprovados/em andamento: <strong>{currency(totalAprovado)}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos (ideias + aprovados)</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-white">
          <Plus className="w-4 h-4 mr-1" />Nova intenção
        </Button>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Simulação</TableHead>
                <TableHead className="w-44 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => {
                const meses = financialContext?.sobra
                  ? Math.ceil(Number(r.valor) / financialContext.sobra)
                  : null;
                const cabe = financialContext?.saldo != null && Number(r.valor) <= financialContext.saldo;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell><Badge variant="outline">{r.categoria}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.prioridade === "alta" ? "destructive" : r.prioridade === "baixa" ? "secondary" : "default"}>
                        {r.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.prazo ? format(parseISO(r.prazo), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{currency(Number(r.valor))}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {cabe ? (
                        <span className="text-emerald-600">Cabe no caixa</span>
                      ) : meses ? (
                        <span>Em ~{meses} meses</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "ideia" && (
                        <Button size="sm" variant="outline" onClick={() => aprovar.mutate(r)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />Aprovar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(r.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  <Lightbulb className="w-4 h-4 inline mr-1" />Nenhuma intenção. Adicione cursos, equipamentos, reformas e manutenções planejadas.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InvestDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["investimentos"] })} />
    </div>
  );
}

function InvestDialog({ open, onOpenChange, editing, onSaved }: any) {
  const defaults = { nome: "", categoria: "curso", valor: 0, prioridade: "media", status: "ideia", prazo: "", roi_esperado: "", reserva_mensal: 0, observacoes: "" };
  const [form, setForm] = useState<any>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(editing ?? defaults); }, [open, editing]);

  async function salvar() {
    setSaving(true);
    try {
      const payload = {
        nome: form.nome,
        categoria: form.categoria,
        valor: Number(form.valor || 0),
        prazo: form.prazo || null,
        prioridade: form.prioridade,
        status: form.status,
        roi_esperado: form.roi_esperado || null,
        reserva_mensal: Number(form.reserva_mensal || 0),
        observacoes: form.observacoes || null,
      };
      if (editing?.id) {
        const { error } = await supabase.from("investimentos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investimentos").insert(payload);
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} intenção de investimento</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={form.prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
          </div>
          <div>
            <Label>Reserva mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.reserva_mensal} onChange={(e) => setForm({ ...form, reserva_mensal: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>ROI esperado</Label>
            <Input value={form.roi_esperado ?? ""} placeholder="ex: aumentar capacidade em 20%" onChange={(e) => setForm({ ...form, roi_esperado: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
