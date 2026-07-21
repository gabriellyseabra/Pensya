import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from "recharts";
import { format, parseISO } from "date-fns";

type Point = { data: string; desempenho?: number | null; gas?: number | null };

export function MetaSparkline({ points, height = 40 }: { points: Point[]; height?: number }) {
  if (!points || points.length === 0) {
    return <div className="text-[10px] text-muted-foreground italic">sem registros</div>;
  }
  const data = points
    .filter((p) => p.desempenho != null)
    .map((p) => ({ data: p.data, v: p.desempenho }));
  if (data.length === 0) return <div className="text-[10px] text-muted-foreground italic">sem desempenho</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <YAxis hide domain={[1, 5]} />
        <Line type="monotone" dataKey="v" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MetaProgressChart({ points, height = 180 }: { points: Point[]; height?: number }) {
  const data = points
    .map((p) => ({
      label: p.data ? format(parseISO(p.data), "dd/MM") : "",
      desempenho: p.desempenho ?? null,
      gas: p.gas ?? null,
    }));
  if (!data.length) return <p className="text-xs text-muted-foreground py-4 text-center">Sem registros.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis dataKey="label" fontSize={11} />
        <YAxis yAxisId="d" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
        <YAxis yAxisId="g" orientation="right" domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} fontSize={11} />
        <Tooltip />
        <Line yAxisId="d" type="monotone" dataKey="desempenho" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 3 }} name="Desempenho 1-5" connectNulls />
        <Line yAxisId="g" type="monotone" dataKey="gas" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} name="GAS" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
