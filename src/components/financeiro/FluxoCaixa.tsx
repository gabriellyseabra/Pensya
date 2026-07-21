import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, addDays, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Movimento = {
  data: string;
  descricao: string;
  tipo: "receita" | "despesa";
  valor: number;
  status: string;
  origem: "pagamento" | "lancamento";
  contaId: string | null;
};

export function FluxoCaixa() {
  const [periodo, setPeriodo] = useState<"30" | "60" | "90">("30");
  const [contaId, setContaId] = useState<string>("todas");
  const today = startOfDay(new Date());
  const dias = Number(periodo);
  const fim = addDays(today, dias);

  const { data: contas } = useQuery({
    queryKey: ["fluxo-contas"],
    queryFn: async () =>
      (await supabase.from("contas_financeiras").select("id, nome, saldo_inicial").eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: movs } = useQuery({
    queryKey: ["fluxo-movs", contaId],
    queryFn: async () => {
      const [pagsRes, lancsRes] = await Promise.all([
        supabase.from("pagamentos")
          .select("id, valor, vencimento, pago_em, status, observacoes, paciente:pacientes(nome)")
          .order("vencimento"),
        supabase.from("lancamentos_financeiros")
          .select("id, descricao, valor, vencimento, pago_em, status, tipo, conta_id")
          .neq("status", "cancelado")
          .order("vencimento"),
      ]);

      const out: Movimento[] = [];
      for (const p of pagsRes.data ?? []) {
        out.push({
          data: p.pago_em ?? p.vencimento,
          descricao: `Recebimento • ${(p as any).paciente?.nome ?? "Paciente"}`,
          tipo: "receita",
          valor: Number(p.valor),
          status: p.status === "pago" ? "confirmado" : "previsto",
          origem: "pagamento",
          contaId: null,
        });
      }
      for (const l of lancsRes.data ?? []) {
        if (contaId !== "todas" && l.conta_id !== contaId) continue;
        out.push({
          data: l.pago_em ?? l.vencimento,
          descricao: l.descricao,
          tipo: l.tipo as any,
          valor: Number(l.valor),
          status: l.status,
          origem: "lancamento",
          contaId: l.conta_id,
        });
      }
      out.sort((a, b) => a.data.localeCompare(b.data));
      return out;
    },
  });

  const saldoInicial = useMemo(() => {
    const filtradas = contaId === "todas"
      ? (contas ?? [])
      : (contas ?? []).filter((c) => c.id === contaId);
    return filtradas.reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
  }, [contas, contaId]);

  // Saldo até hoje (realizado): saldo_inicial + soma de movimentos confirmados com data <= hoje
  const saldoHoje = useMemo(() => {
    let s = saldoInicial;
    const hojeStr = today.toISOString().slice(0, 10);
    for (const m of movs ?? []) {
      if (m.status !== "confirmado") continue;
      if (m.data > hojeStr) continue;
      s += m.tipo === "receita" ? m.valor : -m.valor;
    }
    return s;
  }, [movs, saldoInicial, today]);

  // Série diária para gráfico (próximos N dias)
  const serie = useMemo(() => {
    const arr: { dia: string; data: string; saldo: number; entradas: number; saidas: number }[] = [];
    let saldo = saldoHoje;
    const fimStr = fim.toISOString().slice(0, 10);
    const movsFuturos = (movs ?? []).filter(
      (m) => m.data > today.toISOString().slice(0, 10) && m.data <= fimStr,
    );
    for (let i = 0; i <= dias; i++) {
      const d = addDays(today, i);
      const ds = d.toISOString().slice(0, 10);
      const dayMovs = movsFuturos.filter((m) => m.data === ds);
      const entradas = dayMovs.filter((m) => m.tipo === "receita").reduce((s, m) => s + m.valor, 0);
      const saidas = dayMovs.filter((m) => m.tipo === "despesa").reduce((s, m) => s + m.valor, 0);
      saldo += entradas - saidas;
      arr.push({ dia: format(d, "dd/MM"), data: ds, saldo, entradas, saidas });
    }
    return arr;
  }, [movs, saldoHoje, today, dias, fim]);

  const totalEntradas = serie.slice(1).reduce((s, x) => s + x.entradas, 0);
  const totalSaidas = serie.slice(1).reduce((s, x) => s + x.saidas, 0);
  const saldoFinal = serie[serie.length - 1]?.saldo ?? saldoHoje;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contaId} onValueChange={setContaId}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as contas</SelectItem>
            {(contas ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiMini label="Saldo hoje" value={currency(saldoHoje)} tone={saldoHoje >= 0 ? "ok" : "bad"} delay={40} />
        <KpiMini label={`Entradas ${dias}d`} value={currency(totalEntradas)} tone="ok" delay={90} />
        <KpiMini label={`Saídas ${dias}d`} value={currency(totalSaidas)} tone="bad" delay={140} />
        <KpiMini label="Saldo projetado" value={currency(saldoFinal)} tone={saldoFinal >= 0 ? "ok" : "bad"} delay={190} />
      </div>

      <Card className="glass animate-fade-up" style={{ animationDelay: "220ms" }}>
        <CardHeader><CardTitle className="text-base">Projeção de saldo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={Math.floor(dias / 10)} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => currency(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="saldo" stroke="#064570" strokeWidth={2.5} name="Saldo" dot={false} />
              <Line type="monotone" dataKey="entradas" stroke="#10b981" name="Entradas" dot={false} />
              <Line type="monotone" dataKey="saidas" stroke="#ef4444" name="Saídas" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass animate-fade-up" style={{ animationDelay: "300ms" }}>
        <CardHeader><CardTitle className="text-base">Movimentos previstos no período</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movs ?? [])
                .filter((m) => {
                  const hojeStr = today.toISOString().slice(0, 10);
                  const fimStr = fim.toISOString().slice(0, 10);
                  return m.data > hojeStr && m.data <= fimStr;
                })
                .slice(0, 200)
                .map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(m.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>{m.descricao}</TableCell>
                    <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                    <TableCell className={`text-right font-medium ${m.tipo === "despesa" ? "text-destructive" : "text-emerald-600"}`}>
                      {m.tipo === "despesa" ? "-" : "+"}{currency(m.valor)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiMini({ label, value, tone, delay }: { label: string; value: string; tone: "ok" | "bad" | "muted"; delay?: number }) {
  const color =
    tone === "ok" ? "text-emerald-600" :
    tone === "bad" ? "text-destructive" : "";
  return (
    <Card className="glass card-lift animate-fade-up" style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <CardContent className="pt-5 pb-5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
