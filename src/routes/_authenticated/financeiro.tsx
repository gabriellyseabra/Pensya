import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, TrendingUp, TrendingDown, Wallet, AlertTriangle, Link2, RefreshCw, Copy, Check,
  LayoutDashboard, Users, Upload, BarChart3, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PageHero } from "@/components/shared/PageHero";
import { Wallet as WalletIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  gerarLinkCobranca,
  sincronizarPagamentosInfinitepay,
} from "@/lib/infinitepay.functions";
import { FluxoCaixa } from "@/components/financeiro/FluxoCaixa";
import { DRE } from "@/components/financeiro/DRE";
import { Folha } from "@/components/financeiro/Folha";
import { Investimentos } from "@/components/financeiro/Investimentos";
import { ImportacaoRapida } from "@/components/financeiro/ImportacaoRapida";
import { ExtratoBancario } from "@/components/financeiro/extrato/ExtratoBancario";
import { Mensalidades } from "@/components/financeiro/Mensalidades";
import { PorCategoria } from "@/components/financeiro/PorCategoria";
import { ContasFixas } from "@/components/financeiro/ContasFixas";
import { Inadimplencia } from "@/components/financeiro/Inadimplencia";
import { Projecao } from "@/components/financeiro/Projecao";
import { LancamentoForm, type Lanc } from "@/components/financeiro/LancamentoForm";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SubAba = { key: string; label: string; render: () => React.ReactNode };
type GrupoFinanceiro = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; abas: SubAba[] };

const GRUPOS_FINANCEIRO: GrupoFinanceiro[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard, abas: [{ key: "visao", label: "Visão geral", render: () => <VisaoGeral /> }] },
  {
    key: "mensalidades", label: "Mensalidades", icon: Users,
    abas: [
      { key: "mensalidades", label: "Mensalidades", render: () => <Mensalidades /> },
      { key: "inadimplencia", label: "Inadimplência", render: () => <Inadimplencia /> },
    ],
  },
  {
    key: "contas", label: "Contas", icon: Wallet,
    abas: [
      { key: "receber", label: "A receber", render: () => <AReceber /> },
      { key: "pagar", label: "A pagar", render: () => <APagar /> },
      { key: "fixas", label: "Contas fixas", render: () => <ContasFixas /> },
      { key: "lancamentos", label: "Lançamentos", render: () => <Lancamentos /> },
    ],
  },
  {
    key: "importar", label: "Importar", icon: Upload,
    abas: [
      { key: "extrato", label: "Extrato bancário", render: () => <ExtratoBancario /> },
      { key: "rapida", label: "Importação rápida", render: () => <ImportacaoRapida /> },
    ],
  },
  {
    key: "relatorios", label: "Relatórios", icon: BarChart3,
    abas: [
      { key: "projecao", label: "Projeção & Metas", render: () => <Projecao /> },
      { key: "categorias", label: "Por categoria", render: () => <PorCategoria /> },
      { key: "fluxo", label: "Fluxo de caixa", render: () => <FluxoCaixa /> },
      { key: "dre", label: "DRE", render: () => <DRE /> },
    ],
  },
  {
    key: "outros", label: "Outros", icon: MoreHorizontal,
    abas: [
      { key: "folha", label: "Folha", render: () => <Folha /> },
      { key: "investimentos", label: "Investimentos", render: () => <Investimentos /> },
      { key: "conciliacao", label: "InfinitePay", render: () => <Conciliacao /> },
    ],
  },
];

function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={WalletIcon}
        eyebrow="Gestão financeira"
        title="Financeiro"
        description="Fluxo de caixa, mensalidades, contas a pagar e a receber, e conciliação com a InfinitePay."
        variant="dark"
      />

      <Tabs defaultValue={GRUPOS_FINANCEIRO[0].key}>
        <TabsList className="glass h-auto flex-wrap">
          {GRUPOS_FINANCEIRO.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="gap-1.5">
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GRUPOS_FINANCEIRO.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {g.abas.length === 1 ? (
              g.abas[0].render()
            ) : (
              <Tabs defaultValue={g.abas[0].key}>
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <TabsList className="glass flex h-auto w-full flex-row flex-wrap justify-start gap-1 md:flex-col md:items-stretch">
                    {g.abas.map((a) => (
                      <TabsTrigger key={a.key} value={a.key} className="w-full justify-start">
                        {a.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="min-w-0">
                    {g.abas.map((a) => (
                      <TabsContent key={a.key} value={a.key} className="mt-0">
                        {a.render()}
                      </TabsContent>
                    ))}
                  </div>
                </div>
              </Tabs>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ============================== VISÃO GERAL ============================== */
const PERIODOS = {
  mes: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  ano: "Este ano",
} as const;
type PeriodoKey = keyof typeof PERIODOS;

function VisaoGeral() {
  const today = new Date();
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");

  const { inicio, fim } = (() => {
    if (periodo === "mes") return { inicio: startOfMonth(today), fim: endOfMonth(today) };
    if (periodo === "3m") return { inicio: startOfMonth(subMonths(today, 2)), fim: endOfMonth(today) };
    if (periodo === "6m") return { inicio: startOfMonth(subMonths(today, 5)), fim: endOfMonth(today) };
    return { inicio: startOfYear(today), fim: endOfYear(today) };
  })();
  const inicioStr = inicio.toISOString().slice(0, 10);
  const fimStr = fim.toISOString().slice(0, 10);

  const { data: fin } = useQuery({
    queryKey: ["fin-visao", inicioStr, fimStr],
    queryFn: async () => {
      const [pagsRes, lancRes] = await Promise.all([
        supabase.from("pagamentos")
          .select("valor, status, vencimento, pago_em")
          .gte("vencimento", inicioStr).lte("vencimento", fimStr),
        supabase.from("lancamentos_financeiros")
          .select("valor, tipo, status, vencimento, pago_em")
          .gte("vencimento", inicioStr).lte("vencimento", fimStr),
      ]);
      const pags = pagsRes.data ?? [];
      const lancs = lancRes.data ?? [];

      const recebido = pags.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0)
        + lancs.filter(l => l.tipo === "receita" && l.status === "confirmado").reduce((s, l) => s + Number(l.valor), 0);
      const aReceber = pags.filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.valor), 0)
        + lancs.filter(l => l.tipo === "receita" && l.status === "previsto").reduce((s, l) => s + Number(l.valor), 0);
      const despesas = lancs.filter(l => l.tipo === "despesa" && l.status === "confirmado").reduce((s, l) => s + Number(l.valor), 0);
      const aPagar = lancs.filter(l => l.tipo === "despesa" && l.status === "previsto").reduce((s, l) => s + Number(l.valor), 0);
      const lucro = recebido - despesas;
      const atrasados = pags
        .filter(p => p.status !== "pago" && isAfter(today, parseISO(p.vencimento)))
        .reduce((s, p) => s + Number(p.valor), 0);
      const inadimplencia = (recebido + aReceber) > 0 ? (atrasados / (recebido + aReceber)) * 100 : 0;

      return { recebido, aReceber, despesas, aPagar, lucro, atrasados, inadimplencia };
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ["fin-despesas-categoria", inicioStr, fimStr],
    queryFn: async () => {
      const { data } = await supabase.from("lancamentos_financeiros")
        .select("valor, plano_conta:plano_contas(nome)")
        .eq("tipo", "despesa").eq("status", "confirmado")
        .gte("vencimento", inicioStr).lte("vencimento", fimStr);
      const porCategoria = new Map<string, number>();
      for (const l of data ?? []) {
        const nome = (l as any).plano_conta?.nome ?? "Sem categoria";
        porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + Number(l.valor));
      }
      return Array.from(porCategoria.entries())
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8);
    },
  });

  const { data: pendentesExtrato } = useQuery({
    queryKey: ["extrato-pendentes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("extrato_transacoes").select("id", { count: "exact", head: true }).eq("status", "pendente");
      return count ?? 0;
    },
  });

  const { data: serie } = useQuery({
    queryKey: ["fin-serie-6m"],
    queryFn: async () => {
      const inicioSerie = startOfMonth(subMonths(today, 5));
      const [pagsRes, lancRes] = await Promise.all([
        supabase.from("pagamentos").select("valor, status, vencimento")
          .gte("vencimento", inicioSerie.toISOString().slice(0, 10)),
        supabase.from("lancamentos_financeiros").select("valor, tipo, status, vencimento")
          .gte("vencimento", inicioSerie.toISOString().slice(0, 10)),
      ]);
      const pags = pagsRes.data ?? [];
      const lancs = lancRes.data ?? [];
      const out: { mes: string; receita: number; despesa: number; lucro: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(today, i);
        const ini = startOfMonth(m).toISOString().slice(0, 10);
        const fimM = endOfMonth(m).toISOString().slice(0, 10);
        const recR = pags.filter(p => p.vencimento >= ini && p.vencimento <= fimM && p.status === "pago").reduce((s, p) => s + Number(p.valor), 0)
          + lancs.filter(l => l.vencimento >= ini && l.vencimento <= fimM && l.tipo === "receita" && l.status === "confirmado").reduce((s, l) => s + Number(l.valor), 0);
        const desp = lancs.filter(l => l.vencimento >= ini && l.vencimento <= fimM && l.tipo === "despesa" && l.status === "confirmado").reduce((s, l) => s + Number(l.valor), 0);
        out.push({ mes: format(m, "MMM", { locale: ptBR }), receita: recR, despesa: desp, lucro: recR - desp });
      }
      return out;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Resumo do período</h2>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODOS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!!pendentesExtrato && (
        <Card className="glass border-brand-yellow/60">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-brand-yellow shrink-0" />
            <p className="text-sm">
              <strong>{pendentesExtrato}</strong> transação(ões) do extrato bancário aguardando revisão na aba "Extrato bancário".
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Recebido no período" value={currency(fin?.recebido ?? 0)} tone="success" />
        <Kpi icon={Wallet} label="A receber" value={currency(fin?.aReceber ?? 0)} tone="brand" />
        <Kpi icon={TrendingDown} label="Despesas pagas" value={currency(fin?.despesas ?? 0)} tone="muted" />
        <Kpi icon={AlertTriangle} label="Atrasado" value={currency(fin?.atrasados ?? 0)} tone="danger" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="A pagar" value={currency(fin?.aPagar ?? 0)} tone="warning" />
        <Kpi label="Lucro do período" value={currency(fin?.lucro ?? 0)} tone={fin && fin.lucro >= 0 ? "success" : "danger"} />
        <Kpi label="Margem" value={fin && fin.recebido > 0 ? `${((fin.lucro / fin.recebido) * 100).toFixed(0)}%` : "—"} tone="brand" />
        <Kpi label="Inadimplência" value={fin ? `${fin.inadimplencia.toFixed(0)}%` : "—"} tone={fin && fin.inadimplencia > 10 ? "danger" : "muted"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="glass">
          <CardHeader><CardTitle className="text-base">Receita × Despesa × Lucro — últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => currency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="receita" fill="#10b981" name="Receita" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" fill="#ef4444" name="Despesa" radius={[6, 6, 0, 0]} />
                <Bar dataKey="lucro" fill="#064570" name="Lucro" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="text-base">Despesas por categoria — {PERIODOS[periodo].toLowerCase()}</CardTitle></CardHeader>
          <CardContent>
            {categorias && categorias.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categorias} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip formatter={(v: any) => currency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="valor" fill="#ef4444" name="Despesa" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">Sem despesas categorizadas no período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "brand" }: { icon?: any; label: string; value: string; tone?: "brand" | "success" | "danger" | "warning" | "muted" }) {
  const toneClasses: Record<string, string> = {
    brand: "gradient-brand text-white",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-destructive/15 text-destructive",
    warning: "bg-brand-yellow/40 text-foreground",
    muted: "bg-secondary text-foreground",
  };
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-soft shrink-0 ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================== LANÇAMENTOS ============================== */
function Lancamentos() {
  const qc = useQueryClient();
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lanc | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["lancamentos", tipoFiltro, statusFiltro],
    queryFn: async () => {
      let q = supabase.from("lancamentos_financeiros").select("*").order("vencimento", { ascending: false }).limit(500);
      if (tipoFiltro !== "todos") q = q.eq("tipo", tipoFiltro);
      if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Lanc[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFinanceiro(qc);
      toast.success("Removido");
    },
  });

  const confirmar = useMutation({
    mutationFn: async (l: Lanc) => {
      const { error } = await supabase.from("lancamentos_financeiros")
        .update({ status: "confirmado", pago_em: new Date().toISOString().slice(0, 10) })
        .eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFinanceiro(qc);
      toast.success("Confirmado");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="receita">Receita</SelectItem>
            <SelectItem value="despesa">Despesa</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="previsto">Previsto</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-white">
          <Plus className="w-4 h-4 mr-1" />Novo lançamento
        </Button>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map(l => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{format(parseISO(l.vencimento), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{l.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={l.tipo === "receita" ? "default" : l.tipo === "despesa" ? "destructive" : "secondary"}>
                      {l.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                  <TableCell className={`text-right font-medium ${l.tipo === "despesa" ? "text-destructive" : "text-emerald-600"}`}>
                    {l.tipo === "despesa" ? "-" : ""}{currency(l.valor)}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.status === "previsto" && (
                      <Button size="sm" variant="ghost" onClick={() => confirmar.mutate(l)}>
                        <Check className="w-4 h-4 mr-1" />Confirmar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(l.id); }}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LancamentoDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => invalidarFinanceiro(qc)} />
    </div>
  );
}

function LancamentoDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Lanc | null; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} lançamento</DialogTitle></DialogHeader>
        <LancamentoForm
          editing={editing}
          onCancel={() => onOpenChange(false)}
          onSaved={() => { onSaved(); onOpenChange(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ============================== A RECEBER (pacientes) ============================== */
function AReceber() {
  const qc = useQueryClient();
  const today = new Date();
  const gerarLink = useServerFn(gerarLinkCobranca);

  const { data: rows } = useQuery({
    queryKey: ["a-receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, valor, vencimento, status, pago_em, infinitepay_checkout_url, infinitepay_status, paciente:pacientes(nome)")
        .neq("status", "pago")
        .order("vencimento", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const marcarPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos").update({
        status: "pago", pago_em: new Date().toISOString().slice(0, 10),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFinanceiro(qc);
      toast.success("Pago");
    },
  });

  async function gerar(id: string) {
    try {
      const r = await gerarLink({ data: { pagamentoId: id } });
      toast.success("Link gerado");
      navigator.clipboard?.writeText(r.checkoutUrl).catch(() => {});
      qc.invalidateQueries({ queryKey: ["a-receber"] });
    } catch (e: any) { toast.error(e?.message ?? "Erro ao gerar link"); }
  }

  return (
    <Card className="glass">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-72 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((p: any) => {
              const venc = parseISO(p.vencimento);
              const atrasado = isAfter(today, venc);
              return (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(venc, "dd/MM/yyyy")}
                    {atrasado && <Badge variant="destructive" className="ml-2">Atrasado</Badge>}
                  </TableCell>
                  <TableCell>{p.paciente?.nome ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{p.infinitepay_status ?? p.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{currency(p.valor)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {p.infinitepay_checkout_url ? (
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(p.infinitepay_checkout_url); toast.success("Link copiado"); }}>
                        <Copy className="w-3 h-3 mr-1" />Copiar link
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => gerar(p.id)}>
                        <Link2 className="w-3 h-3 mr-1" />Gerar cobrança
                      </Button>
                    )}
                    <Button size="sm" onClick={() => marcarPago.mutate(p.id)}>
                      <Check className="w-3 h-3 mr-1" />Marcar pago
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(!rows || rows.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhum recebimento em aberto.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============================== A PAGAR (despesas) ============================== */
function APagar() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["a-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("id, descricao, valor, vencimento, status, fornecedor:fornecedores(nome)")
        .eq("tipo", "despesa").neq("status", "cancelado").neq("status", "confirmado")
        .order("vencimento", { ascending: true }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_financeiros").update({
        status: "confirmado", pago_em: new Date().toISOString().slice(0, 10),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidarFinanceiro(qc); toast.success("Paga"); },
  });

  return (
    <Card className="glass">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">{format(parseISO(l.vencimento), "dd/MM/yyyy")}</TableCell>
                <TableCell>{l.descricao}</TableCell>
                <TableCell className="text-muted-foreground">{l.fornecedor?.nome ?? "—"}</TableCell>
                <TableCell className="text-right font-medium text-destructive">-{currency(l.valor)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => pagar.mutate(l.id)}>
                    <Check className="w-3 h-3 mr-1" />Pagar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!rows || rows.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhuma despesa em aberto.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============================== CONCILIAÇÃO INFINITEPAY ============================== */
function Conciliacao() {
  const qc = useQueryClient();
  const sincronizar = useServerFn(sincronizarPagamentosInfinitepay);
  const [sincronizando, setSincronizando] = useState(false);

  const { data: eventos } = useQuery({
    queryKey: ["ipay-eventos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("infinitepay_eventos")
        .select("id, event_id, tipo, status_processamento, erro, recebido_em, pagamento_id")
        .order("recebido_em", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: cfg } = useQuery({
    queryKey: ["ipay-cfg-status"],
    queryFn: async () => (await supabase.from("infinitepay_config").select("handle, ativo, ultima_sincronizacao").eq("ativo", true).maybeSingle()).data,
  });

  async function rodar() {
    setSincronizando(true);
    try {
      const r = await sincronizar();
      toast.success(`${r.atualizados} atualizado(s) de ${r.total} transações`);
      qc.invalidateQueries({ queryKey: ["ipay-eventos"] });
      invalidarFinanceiro(qc);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar");
    } finally { setSincronizando(false); }
  }

  return (
    <div className="space-y-3">
      <Card className="glass">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium">
              {cfg ? <>Loja conectada: <span className="font-mono">{cfg.handle}</span></> : "InfinitePay não configurada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cfg?.ultima_sincronizacao ? `Última sincronização: ${format(parseISO(cfg.ultima_sincronizacao), "dd/MM/yyyy HH:mm")}` : "Sem sincronizações ainda"}
            </p>
          </div>
          <Button onClick={rodar} disabled={sincronizando || !cfg}>
            <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? "animate-spin" : ""}`} />
            Puxar pagamentos agora
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Últimos webhooks recebidos</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(eventos ?? []).map(e => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-sm">{format(parseISO(e.recebido_em), "dd/MM HH:mm")}</TableCell>
                  <TableCell className="font-mono text-xs">{e.tipo}</TableCell>
                  <TableCell className="font-mono text-xs">{e.pagamento_id ? e.pagamento_id.slice(0, 8) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.status_processamento === "erro" ? "destructive" : "outline"}>
                      {e.status_processamento}
                    </Badge>
                    {e.erro && <span className="text-xs text-destructive ml-2">{e.erro}</span>}
                  </TableCell>
                </TableRow>
              ))}
              {(!eventos || eventos.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum webhook recebido ainda. Configure a URL <span className="font-mono">/api/public/webhooks/infinitepay</span> no painel da InfinitePay.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
