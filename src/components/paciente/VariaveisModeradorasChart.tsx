import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

const VARS = [
  { key: "engajamento", label: "Engajamento", color: "hsl(var(--brand))" },
  { key: "motivacao", label: "Motivação", color: "#10b981" },
  { key: "persistencia", label: "Persistência", color: "#f59e0b" },
  { key: "autorregulacao", label: "Autorregulação", color: "#8b5cf6" },
  { key: "participacao", label: "Participação", color: "#06b6d4" },
];

export function VariaveisModeradorasChart({ pacienteId }: { pacienteId: string }) {
  const { data: sessoes = [] } = useQuery({
    queryKey: ["moderadoras", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("data_sessao, engajamento, motivacao, persistencia, autorregulacao, participacao")
        .eq("paciente_id", pacienteId)
        .order("data_sessao", { ascending: true });
      return data ?? [];
    },
  });

  const series = useMemo(() =>
    sessoes
      .filter((s: any) => VARS.some((v) => s[v.key] != null))
      .map((s: any) => ({
        label: s.data_sessao ? format(parseISO(s.data_sessao), "dd/MM") : "",
        ...Object.fromEntries(VARS.map((v) => [v.key, s[v.key]])),
      })),
    [sessoes],
  );

  if (series.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Variáveis moderadoras ao longo das sessões</CardTitle>
        <p className="text-xs text-muted-foreground">
          Engajamento, motivação, persistência, autorregulação e participação (1–5).
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
            <Tooltip />
            <Legend />
            {VARS.map((v) => (
              <Line
                key={v.key}
                type="monotone"
                dataKey={v.key}
                name={v.label}
                stroke={v.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
