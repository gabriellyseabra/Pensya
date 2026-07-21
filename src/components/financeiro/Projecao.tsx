import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Target, TrendingUp, UserPlus } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v)}%`);

/**
 * Projeção estratégica do negócio (formato da planilha de análise de
 * faturamento): comparação ano a ano, meta de crescimento, projetado ×
 * realizado mês a mês e entrada de novos pacientes.
 */
export function Projecao() {
  const qc = useQueryClient();
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual];

  const { data: faturamento = [] } = useQuery({
    queryKey: ["faturamento-mensal", anos.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("financeiro_faturamento_mensal", { _anos: anos });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["negocio-metas", anoAtual],
    queryFn: async () => {
      const { data, error } = await supabase.from("negocio_metas").select("*").eq("ano", anoAtual);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: novosPacientes = [] } = useQuery({
    queryKey: ["novos-pacientes-serie"],
    queryFn: async () => {
      const desde = `${anoAtual - 1}-01-01`;
      const { data, error } = await supabase.rpc("pacientes_novos_por_mes", { _desde: desde });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const metaCrescimento = Number(metas.find((m: any) => m.indicador === "crescimento_pct")?.alvo ?? 30);
  const metaNovos = metas.find((m: any) => m.indicador === "novos_pacientes_mes")?.alvo ?? null;
  const [editMeta, setEditMeta] = useState<string>("");
  const [editMetaNovos, setEditMetaNovos] = useState<string>("");

  const salvarMeta = useMutation({
    mutationFn: async ({ indicador, alvo }: { indicador: string; alvo: number }) => {
      const { error } = await supabase.from("negocio_metas")
        .upsert({ ano: anoAtual, indicador, alvo }, { onConflict: "ano,indicador" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Meta salva");
      qc.invalidateQueries({ queryKey: ["negocio-metas", anoAtual] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // realizado[ano][mes]
  const real: Record<number, number[]> = {};
  for (const a of anos) real[a] = Array(12).fill(0);
  for (const f of faturamento as any[]) {
    if (real[f.ano]) real[f.ano][f.mes - 1] = Number(f.realizado) || Number(f.previsto) || 0;
  }
  const soma = (arr: number[]) => arr.reduce((x, y) => x + y, 0);
  const anoBase = anoAtual - 1;
  const mesAtualIdx = new Date().getMonth();

  const linhas = MESES.map((nome, i) => {
    const base = real[anoBase][i];
    const projetado = base * (1 + metaCrescimento / 100);
    const realizado = real[anoAtual][i];
    const crescReal = base > 0 && (i < mesAtualIdx || realizado > 0)
      ? ((realizado - base) / base) * 100 : null;
    return { nome, anteAnterior: real[anoAtual - 2][i], base, projetado, realizado, crescReal, futuro: i > mesAtualIdx };
  });

  const totalBase = soma(real[anoBase]);
  const totalAtual = soma(real[anoAtual]);
  const mesesComRealizado = linhas.filter((l) => l.realizado > 0).length || 1;
  const baseMesmoPeriodo = soma(real[anoBase].slice(0, mesesComRealizado));
  const crescAcumulado = baseMesmoPeriodo > 0 ? ((soma(real[anoAtual].slice(0, mesesComRealizado)) - baseMesmoPeriodo) / baseMesmoPeriodo) * 100 : null;

  const chartData = linhas.map((l) => ({
    nome: l.nome,
    [String(anoBase)]: l.base,
    Projetado: Math.round(l.projetado),
    [String(anoAtual)]: l.realizado || null,
  }));

  const novosAnoAtual = (novosPacientes as any[]).filter((n) => n.mes.startsWith(String(anoAtual)));
  const totalNovosAno = novosAnoAtual.reduce((a, n) => a + Number(n.novos), 0);

  return (
    <div className="space-y-4">
      {/* KPIs + metas */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Faturamento {anoAtual}</p>
          <p className="text-2xl font-semibold tabular-nums">{BRL(totalAtual)}</p>
          <p className="text-xs text-muted-foreground">vs {BRL(totalBase)} em {anoBase}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Crescimento acumulado</p>
          <p className={cn("text-2xl font-semibold tabular-nums",
            crescAcumulado != null && crescAcumulado >= metaCrescimento ? "text-emerald-600" : "text-amber-600")}>
            {pct(crescAcumulado)}
          </p>
          <p className="text-xs text-muted-foreground">mesmo período de {anoBase} · meta {metaCrescimento}%</p>
        </Card>
        <Card className="glass p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Target className="h-3 w-3" /> Meta de crescimento/ano</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              className="h-8 w-20 tabular-nums"
              type="number"
              placeholder={String(metaCrescimento)}
              value={editMeta}
              onChange={(e) => setEditMeta(e.target.value)}
            />
            <span className="text-sm">%</span>
            <Button size="sm" variant="outline" className="h-8"
              disabled={!editMeta || salvarMeta.isPending}
              onClick={() => { salvarMeta.mutate({ indicador: "crescimento_pct", alvo: Number(editMeta) }); setEditMeta(""); }}>
              Salvar
            </Button>
          </div>
        </Card>
        <Card className="glass p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><UserPlus className="h-3 w-3" /> Novos pacientes {anoAtual}</p>
          <p className="text-2xl font-semibold tabular-nums">{totalNovosAno}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Input className="h-7 w-16 text-xs tabular-nums" type="number"
              placeholder={metaNovos != null ? String(metaNovos) : "meta/mês"}
              value={editMetaNovos} onChange={(e) => setEditMetaNovos(e.target.value)} />
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              disabled={!editMetaNovos || salvarMeta.isPending}
              onClick={() => { salvarMeta.mutate({ indicador: "novos_pacientes_mes", alvo: Number(editMetaNovos) }); setEditMetaNovos(""); }}>
              Salvar meta/mês
            </Button>
          </div>
        </Card>
      </div>

      {/* Gráfico projetado × realizado */}
      <Card className="glass p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4 text-brand" /> Projeção × realizado — {anoAtual}
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData}>
            <XAxis dataKey="nome" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Legend />
            <Bar dataKey={String(anoBase)} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={String(anoAtual)} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Projetado" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Tabela estilo planilha */}
      <Card className="glass p-4">
        <h3 className="mb-2 font-semibold">Análise de faturamento</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">{anoAtual - 2}</TableHead>
                <TableHead className="text-right">{anoBase}</TableHead>
                <TableHead className="text-right">Projetado (+{metaCrescimento}%)</TableHead>
                <TableHead className="text-right">{anoAtual} real</TableHead>
                <TableHead className="text-right">% cresc. real</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.nome} className={l.futuro ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.anteAnterior ? BRL(l.anteAnterior) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.base ? BRL(l.base) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{l.base ? BRL(l.projetado) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{l.realizado ? BRL(l.realizado) : "—"}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums",
                    l.crescReal == null ? "text-muted-foreground"
                      : l.crescReal >= metaCrescimento ? "text-emerald-600" : "text-amber-600")}>
                    {pct(l.crescReal)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{BRL(soma(real[anoAtual - 2]))}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL(totalBase)}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL(totalBase * (1 + metaCrescimento / 100))}</TableCell>
                <TableCell className="text-right tabular-nums">{BRL(totalAtual)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(crescAcumulado)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Faturamento = receitas por competência (lançamentos pagos; meses sem baixa usam o previsto).
          O % de crescimento acumulado compara com o mesmo período do ano anterior.
        </p>
      </Card>

      {/* Novos pacientes */}
      <Card className="glass p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <UserPlus className="h-4 w-4 text-brand" /> Novos pacientes e altas por mês
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={(novosPacientes as any[]).map((n) => ({
            nome: `${MESES[parseInt(n.mes.slice(5), 10) - 1]}/${n.mes.slice(2, 4)}`,
            Novos: Number(n.novos),
            Altas: Number(n.altas),
            Meta: metaNovos != null ? Number(metaNovos) : undefined,
          }))}>
            <XAxis dataKey="nome" fontSize={10} interval={1} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Novos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Altas" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            {metaNovos != null && <Line type="monotone" dataKey="Meta" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
