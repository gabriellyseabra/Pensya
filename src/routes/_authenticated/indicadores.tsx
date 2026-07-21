import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  addDays, eachDayOfInterval, endOfDay, endOfMonth, format, startOfDay, startOfMonth, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, BarChart3, Activity, PieChart as PieIcon } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { TwoColumn, PanelCard, StatTile } from "@/components/shared/panels";

export const Route = createFileRoute("/_authenticated/indicadores")({
  component: IndicadoresPage,
});

const CORES = ["#064570", "#5585b1", "#f9ca0a", "#deb0bd", "#10b981", "#ef4444"];

function IndicadoresPage() {
  const today = new Date();
  const inicioMes = startOfMonth(today);
  const fimMes = endOfMonth(today);

  const { data: receitaSerie } = useQuery({
    queryKey: ["ind-receita-serie"],
    queryFn: async () => {
      const inicio = startOfMonth(subMonths(today, 5));
      const { data } = await supabase
        .from("pagamentos")
        .select("valor, status, vencimento")
        .gte("vencimento", inicio.toISOString().slice(0, 10));
      const rows = data ?? [];
      const out: { mes: string; pago: number; previsto: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(today, i);
        const ini = startOfMonth(m).toISOString().slice(0, 10);
        const fim = endOfMonth(m).toISOString().slice(0, 10);
        const mesRows = rows.filter((r) => r.vencimento >= ini && r.vencimento <= fim);
        out.push({
          mes: format(m, "MMM", { locale: ptBR }),
          pago: mesRows.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.valor), 0),
          previsto: mesRows.reduce((s, r) => s + Number(r.valor), 0),
        });
      }
      return out;
    },
  });

  const { data: atendimentosSerie } = useQuery({
    queryKey: ["ind-atend-serie"],
    queryFn: async () => {
      const from = addDays(today, -13);
      const { data } = await supabase
        .from("atendimentos")
        .select("inicio")
        .gte("inicio", startOfDay(from).toISOString())
        .lte("inicio", endOfDay(today).toISOString());
      const dias = eachDayOfInterval({ start: from, end: today });
      return dias.map((d) => ({
        dia: format(d, "dd/MM"),
        atendimentos: (data ?? []).filter((a) => {
          const ad = new Date(a.inicio);
          return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth() && ad.getDate() === d.getDate();
        }).length,
      }));
    },
  });

  const { data: porModalidade } = useQuery({
    queryKey: ["ind-modalidades", inicioMes.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("modalidade:modalidades(nome)")
        .gte("inicio", inicioMes.toISOString())
        .lte("inicio", fimMes.toISOString());
      const map = new Map<string, number>();
      (data ?? []).forEach((a: any) => {
        const k = a.modalidade?.nome ?? "Sem modalidade";
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    },
  });

  const currency = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

  const receitaMes = receitaSerie?.[receitaSerie.length - 1];
  const atendMes = (atendimentosSerie ?? []).reduce((s, d) => s + d.atendimentos, 0);

  return (
    <div className="space-y-6">
      <PageHero
        icon={BarChart3}
        eyebrow="Panorama"
        title="Indicadores"
        description="Visão estratégica da clínica — receita, atendimentos e modalidades em tempo real."
        variant="dark"
      />

      <TwoColumn
        side={
          <>
            <PanelCard title="Modalidades do mês" icon={PieIcon} delay={80}>
              {porModalidade && porModalidade.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={porModalidade} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={(e) => e.name}>
                      {porModalidade.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-12 text-center">Sem atendimentos neste mês ainda.</p>
              )}
            </PanelCard>

            <PanelCard title="Resumo do mês" icon={TrendingUp} delay={140}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  icon={TrendingUp}
                  value={receitaMes ? currency(receitaMes.pago) : "—"}
                  label="Recebido"
                />
                <StatTile
                  icon={BarChart3}
                  value={receitaMes ? currency(receitaMes.previsto) : "—"}
                  label="Previsto"
                />
                <StatTile icon={Activity} value={atendMes} label="Atend. 14d" />
                <StatTile icon={PieIcon} value={porModalidade?.length ?? 0} label="Modalidades" />
              </div>
            </PanelCard>
          </>
        }
      >
      <Card className="glass animate-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-brand" />
            Receita — últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={receitaSerie ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => currency(v)}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previsto" fill="#deb0bd" name="Previsto" radius={[6, 6, 0, 0]} />
              <Bar dataKey="pago" fill="#064570" name="Recebido" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass animate-fade-up" style={{ animationDelay: "160ms" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atendimentos — últimos 14 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={atendimentosSerie ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="atendimentos" stroke="#064570" strokeWidth={2.5} dot={{ fill: "#5585b1", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </TwoColumn>
    </div>
  );
}
