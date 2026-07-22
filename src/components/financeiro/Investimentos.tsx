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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckCircle2, Lightbulb, Trash2, PiggyBank, Target } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, subMonths, addMonths } from "date-fns";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Projeção de atingimento da meta pelo aporte mensal e prazo.
function projecaoMeta(meta: number, acumulado: number, aporteMensal: number, prazo: string | null) {
  const restante = Math.max(0, meta - acumulado);
  if (meta > 0 && restante <= 0) return { restante: 0, texto: "Meta atingida 🎉", tone: "ok" as const };
  if (!aporteMensal || aporteMensal <= 0) return { restante, texto: "Defina o aporte mensal", tone: "muted" as const };
  const meses = Math.ceil(restante / aporteMensal);
  const dataProj = addMonths(new Date(), meses);
  let tone: "ok" | "late" | "brand" = "brand";
  let suffix = "";
  if (prazo) {
    const prazoD = parseISO(prazo);
    if (dataProj > prazoD) { tone = "late"; suffix = " · após o prazo"; }
    else { tone = "ok"; suffix = " · dentro do prazo"; }
  }
  return { restante, meses, dataProj, texto: `~${meses} ${meses === 1 ? "mês" : "meses"} · ${format(dataProj, "MM/yyyy")}${suffix}`, tone };
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

  const [aporteInv, setAporteInv] = useState<any>(null);

  // Aportes de cada investimento (o quanto já foi guardado rumo à meta).
  const ids = (rows ?? []).map((r) => r.id);
  const { data: aportes } = useQuery({
    queryKey: ["invest-aportes", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("investimento_aportes")
        .select("investimento_id, valor")
        .in("investimento_id", ids);
      return data ?? [];
    },
  });
  const acumuladoPorInv = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of aportes ?? []) m[a.investimento_id] = (m[a.investimento_id] ?? 0) + Number(a.valor);
    return m;
  }, [aportes]);

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
                <TableHead>Meta</TableHead>
                <TableHead className="text-right">Valor-meta</TableHead>
                <TableHead className="w-56">Alcance</TableHead>
                <TableHead className="text-right">Aporte mensal</TableHead>
                <TableHead>Projeção</TableHead>
                <TableHead className="w-56 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => {
                const meta = Number(r.valor || 0);
                const acumulado = acumuladoPorInv[r.id] ?? 0;
                const pct = meta > 0 ? Math.min(100, Math.round((acumulado / meta) * 100)) : 0;
                const proj = projecaoMeta(meta, acumulado, Number(r.reserva_mensal || 0), r.prazo);
                const projTone =
                  proj.tone === "ok" ? "text-emerald-600" : proj.tone === "late" ? "text-destructive" : proj.tone === "brand" ? "text-brand" : "text-muted-foreground";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.nome}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{r.categoria}</Badge>
                        {r.prazo && <span className="text-[11px] text-muted-foreground">prazo {format(parseISO(r.prazo), "MM/yyyy")}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{currency(meta)}</TableCell>
                    <TableCell>
                      <Progress value={pct} className="h-2" />
                      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{currency(acumulado)}</span>
                        <span>{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{currency(Number(r.reserva_mensal || 0))}</TableCell>
                    <TableCell className={`text-xs ${projTone}`}>{proj.texto}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => setAporteInv(r)}>
                        <PiggyBank className="w-3 h-3 mr-1" />Aporte
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(r.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  <Lightbulb className="w-4 h-4 inline mr-1" />Nenhuma meta de investimento. Adicione cursos, equipamentos, reformas e manutenções que você quer conquistar.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InvestDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["investimentos"] })} />
      <AporteDialog investimento={aporteInv} onClose={() => setAporteInv(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["invest-aportes"] }); invalidarFinanceiro(qc); }} />
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

// Registrar um aporte (valor guardado) rumo à meta de um investimento.
function AporteDialog({ investimento, onClose, onSaved }: { investimento: any; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [lancar, setLancar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (investimento) { setValor(""); setData(new Date().toISOString().slice(0, 10)); setObs(""); setLancar(false); }
  }, [investimento?.id]);

  if (!investimento) return null;

  async function salvar() {
    const v = Number(valor);
    if (!v || v <= 0) { toast.error("Informe um valor"); return; }
    setSaving(true);
    try {
      let lancamento_id: string | null = null;
      if (lancar) {
        const { data: lanc, error: lErr } = await supabase.from("lancamentos_financeiros").insert({
          tipo: "despesa", status: "confirmado",
          descricao: `Aporte • ${investimento.nome}`,
          valor: v, competencia: data, vencimento: data, pago_em: data,
        }).select("id").single();
        if (lErr) throw lErr;
        lancamento_id = lanc.id;
      }
      const { error } = await supabase.from("investimento_aportes").insert({
        investimento_id: investimento.id, valor: v, data, observacoes: obs || null, lancamento_id,
      });
      if (error) throw error;
      toast.success("Aporte registrado");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!investimento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar aporte — {investimento.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={lancar} onCheckedChange={(v) => setLancar(!!v)} />
            Também lançar como despesa paga no fluxo de caixa
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
