import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isAfter } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Link2, Copy, TrendingUp, TrendingDown, Wallet, AlertTriangle } from "lucide-react";
import { gerarLinkCobranca } from "@/lib/infinitepay.functions";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

type Pag = {
  id: string; competencia: string; valor: number; vencimento: string;
  status: string; pago_em: string | null; forma_pagamento: string | null;
  observacoes: string | null; infinitepay_checkout_url: string | null;
  nf_emitida: boolean | null; nf_numero: string | null;
};

const STATUS = ["pendente", "pago", "atrasado", "cancelado", "isento"];

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FinanceiroPacienteTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pag | null>(null);
  const gerarLink = useServerFn(gerarLinkCobranca);

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pag-paciente", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("vencimento", { ascending: false });
      return (data ?? []) as Pag[];
    },
  });

  const totals = useMemo(() => {
    let pago = 0, pendente = 0, atrasado = 0;
    pagamentos.forEach((p) => {
      const v = Number(p.valor);
      if (p.status === "pago") pago += v;
      else if (p.status === "pendente" && isAfter(today, parseISO(p.vencimento))) atrasado += v;
      else if (p.status === "pendente") pendente += v;
    });
    return { pago, pendente, atrasado };
  }, [pagamentos]);

  const marcarPago = useMutation({
    mutationFn: async (p: Pag) => {
      const { error } = await supabase.from("pagamentos")
        .update({ status: "pago", pago_em: new Date().toISOString().slice(0, 10) })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como pago");
      invalidarFinanceiro(qc);
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      invalidarFinanceiro(qc);
    },
  });

  async function criarLink(p: Pag) {
    try {
      toast.loading("Gerando link...", { id: "ipay" });
      const r: any = await gerarLink({ data: { pagamentoId: p.id } });
      toast.dismiss("ipay");
      if (r?.url) {
        await navigator.clipboard.writeText(r.url).catch(() => {});
        toast.success("Link gerado e copiado");
      } else {
        toast.success("Link gerado");
      }
      qc.invalidateQueries({ queryKey: ["pag-paciente", pacienteId] });
    } catch (e: any) {
      toast.dismiss("ipay");
      toast.error("Falha: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Recebido (histórico)" value={currency(totals.pago)} tone="success" />
        <KpiCard icon={Wallet} label="A receber" value={currency(totals.pendente)} tone="brand" />
        <KpiCard icon={AlertTriangle} label="Atrasado" value={currency(totals.atrasado)} tone="danger" />
        <KpiCard icon={TrendingDown} label="Total no histórico" value={currency(totals.pago + totals.pendente + totals.atrasado)} tone="muted" />
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Pagamentos do paciente</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo pagamento
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right w-56">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentos.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum pagamento registrado.</TableCell></TableRow>
              )}
              {pagamentos.map((p) => {
                const atrasado = p.status === "pendente" && isAfter(today, parseISO(p.vencimento));
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(p.competencia), "MM/yyyy")}</TableCell>
                    <TableCell className="whitespace-nowrap">{format(parseISO(p.vencimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right font-medium">{currency(p.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "pago" ? "default" : atrasado ? "destructive" : "outline"}>
                        {atrasado ? "atrasado" : p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.pago_em ? format(parseISO(p.pago_em), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      {p.status === "pendente" && (
                        <Button size="sm" variant="ghost" onClick={() => marcarPago.mutate(p)}>
                          <Check className="w-4 h-4 mr-1" /> Pago
                        </Button>
                      )}
                      {p.infinitepay_checkout_url ? (
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(p.infinitepay_checkout_url!);
                          toast.success("Link copiado");
                        }}>
                          <Copy className="w-4 h-4 mr-1" /> Link
                        </Button>
                      ) : p.status === "pendente" && (
                        <Button size="sm" variant="ghost" onClick={() => criarLink(p)}>
                          <Link2 className="w-4 h-4 mr-1" /> Gerar link
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) remover.mutate(p.id); }}>×</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PagamentoDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        pacienteId={pacienteId}
        onSaved={() => invalidarFinanceiro(qc)}
      />
    </div>
  );
}

function PagamentoDialog({
  open, onOpenChange, editing, pacienteId, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Pag | null; pacienteId: string; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Partial<Pag>>(editing ?? {
    competencia: today, vencimento: today, valor: 0, status: "pendente",
  });
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    setForm(editing ?? { competencia: today, vencimento: today, valor: 0, status: "pendente" });
  }, [editing, open]);

  async function salvar() {
    setSaving(true);
    try {
      const payload: any = {
        paciente_id: pacienteId,
        competencia: form.competencia,
        vencimento: form.vencimento,
        valor: Number(form.valor || 0),
        status: form.status,
        pago_em: form.status === "pago" ? (form.pago_em || today) : null,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
      };
      const res = editing
        ? await supabase.from("pagamentos").update(payload).eq("id", editing.id)
        : await supabase.from("pagamentos").insert(payload);
      if (res.error) throw res.error;
      toast.success("Salvo");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar pagamento" : "Novo pagamento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="date" value={form.competencia ?? ""} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={form.vencimento ?? ""} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor ?? 0} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status ?? "pendente"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.status === "pago" && (
            <div>
              <Label className="text-xs">Pago em</Label>
              <Input type="date" value={form.pago_em ?? today} onChange={(e) => setForm({ ...form, pago_em: e.target.value })} />
            </div>
          )}
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Input value={form.forma_pagamento ?? ""} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} placeholder="PIX, dinheiro, cartão..." />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "brand" | "success" | "danger" | "muted" }) {
  const toneClasses: Record<string, string> = {
    brand: "gradient-brand text-white",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-destructive/15 text-destructive",
    muted: "bg-secondary text-foreground",
  };
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-soft shrink-0 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
