import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type LancMes = { conta_fixa_id: string; lancamento_id: string; valor: number; status: string; vencimento: string; pago_em: string | null };

/**
 * Contas fixas (aluguel, luz, INSS/Simples, combustível…): cadastradas
 * uma vez, geram os lançamentos "a pagar/receber" de cada mês com um
 * clique. Contas marcadas como "variáveis" usam o valor cadastrado
 * apenas como projeção — o lançamento gerado pode ter o valor real
 * ajustado aqui mesmo, na hora de registrar o pagamento.
 */
export function ContasFixas() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ tipo: "despesa", dia_vencimento: 5, variavel: false });
  const [editandoValor, setEditandoValor] = useState<string | null>(null);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-fixas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_fixas")
        .select("*, plano_conta:plano_contas(nome), fornecedor:fornecedores(nome)")
        .order("descricao");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: lancamentosMes = [] } = useQuery({
    queryKey: ["contas-fixas-lancamentos", hoje.getFullYear(), hoje.getMonth() + 1],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contas_fixas_lancamentos", {
        _ano: hoje.getFullYear(), _mes: hoje.getMonth() + 1,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as LancMes[];
    },
  });
  const lancPorConta = new Map(lancamentosMes.map((l) => [l.conta_fixa_id, l]));

  const { data: planoContas = [] } = useQuery({
    queryKey: ["plano-contas-ativas"],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome, tipo").order("nome")).data ?? [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-todos"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").order("nome")).data ?? [],
  });

  const invalidarMes = () => {
    qc.invalidateQueries({ queryKey: ["contas-fixas-lancamentos"] });
    invalidarFinanceiro(qc);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        descricao: form.descricao,
        tipo: form.tipo,
        valor: Number(form.valor),
        dia_vencimento: Number(form.dia_vencimento),
        variavel: !!form.variavel,
        plano_conta_id: form.plano_conta_id || null,
        fornecedor_id: form.fornecedor_id || null,
        observacoes: form.observacoes || null,
      };
      const q = form.id
        ? supabase.from("contas_fixas").update(payload).eq("id", form.id)
        : supabase.from("contas_fixas").insert(payload);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Conta fixa salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["contas-fixas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("contas_fixas").update({ ativo }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contas-fixas"] }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_fixas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contas-fixas"] }),
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_contas_fixas", {
        _ano: hoje.getFullYear(), _mes: hoje.getMonth() + 1,
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(n > 0 ? `${n} lançamento(s) gerado(s) para este mês` : "Todas as contas do mês já estavam geradas");
      invalidarMes();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarValorReal = useMutation({
    mutationFn: async ({ lancamentoId, valor }: { lancamentoId: string; valor: number }) => {
      const { error } = await supabase.from("lancamentos_financeiros").update({ valor }).eq("id", lancamentoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Valor atualizado"); invalidarMes(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarPago = useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await supabase.from("lancamentos_financeiros")
        .update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", lancamentoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Baixa registrada"); invalidarMes(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMensal = contas.filter((c: any) => c.ativo && c.tipo === "despesa")
    .reduce((a: number, c: any) => a + Number(c.valor), 0);

  return (
    <Card className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Contas fixas</h3>
          <p className="text-xs text-muted-foreground">
            Compromissos mensais: {BRL(totalMensal)} projetado em despesas fixas ativas
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            <Zap className="mr-1 h-3.5 w-3.5" /> Gerar contas deste mês
          </Button>
          <Button size="sm" onClick={() => { setForm({ tipo: "despesa", dia_vencimento: 5, variavel: false }); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova conta fixa
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Projetado</TableHead>
            <TableHead>Vence dia</TableHead><TableHead>Este mês</TableHead><TableHead>Ativa</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contas.map((c: any) => {
            const lanc = lancPorConta.get(c.id);
            return (
              <TableRow key={c.id} className={!c.ativo ? "opacity-50" : undefined}>
                <TableCell className="font-medium">
                  {c.descricao}
                  {c.plano_conta?.nome && <p className="text-xs font-normal text-muted-foreground">{c.plano_conta.nome}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant={c.tipo === "despesa" ? "destructive" : "secondary"}>{c.tipo}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {BRL(c.valor)}
                  {c.variavel && <Badge variant="outline" className="ml-1.5 text-[10px] font-normal">estimado</Badge>}
                </TableCell>
                <TableCell className="tabular-nums">
                  <CalendarClock className="mr-1 inline h-3 w-3 text-muted-foreground" />{c.dia_vencimento}
                </TableCell>
                <TableCell>
                  {!lanc ? (
                    <span className="text-xs text-muted-foreground">não gerado</span>
                  ) : lanc.status === "pago" ? (
                    <Badge className="bg-emerald-600 text-white tabular-nums">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> {BRL(lanc.valor)}
                    </Badge>
                  ) : editandoValor === lanc.lancamento_id ? (
                    <Input
                      autoFocus
                      type="number"
                      step="0.01"
                      className="h-7 w-28 tabular-nums"
                      defaultValue={lanc.valor}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        setEditandoValor(null);
                        if (v > 0 && v !== Number(lanc.valor)) atualizarValorReal.mutate({ lancamentoId: lanc.lancamento_id, valor: v });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        className="tabular-nums underline decoration-dotted underline-offset-2"
                        title="Ajustar valor real deste mês"
                        onClick={() => setEditandoValor(lanc.lancamento_id)}
                      >
                        {BRL(lanc.valor)}
                      </button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditandoValor(lanc.lancamento_id)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                        onClick={() => { if (confirm(`Marcar "${c.descricao}" (${BRL(lanc.valor)}) como pago?`)) marcarPago.mutate(lanc.lancamento_id); }}
                      >
                        pagar
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell><Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: c.id, ativo: v })} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setForm({ ...c }); setOpen(true); }}>Editar</Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir "${c.descricao}"?`)) excluir.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {contas.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma conta fixa. Cadastre aluguel, energia, INSS/Simples, combustível… e gere as contas do mês com um clique.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        Contas <strong>variáveis</strong> (INSS/Simples, energia, combustível, estacionamento…) usam o valor
        cadastrado só como projeção — clique no valor de "Este mês" para lançar o valor real quando for pagar.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} conta fixa</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Descrição *</Label><Input value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (projeção) *</Label><Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Vence dia</Label><Input type="number" min={1} max={28} value={form.dia_vencimento ?? 5} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 p-2.5">
              <Switch checked={!!form.variavel} onCheckedChange={(v) => setForm({ ...form, variavel: v })} id="variavel" />
              <div>
                <Label htmlFor="variavel" className="cursor-pointer">Valor variável</Label>
                <p className="text-xs text-muted-foreground">
                  Ex.: INSS/Simples, energia, combustível, estacionamento. O valor acima vira só uma
                  estimativa — você ajusta o valor real de cada mês ao registrar o pagamento.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria (plano de contas)</Label>
                <Select value={form.plano_conta_id ?? "__none"} onValueChange={(v) => setForm({ ...form, plano_conta_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {planoContas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.fornecedor_id ?? "__none"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {fornecedores.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.descricao || !form.valor || salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
