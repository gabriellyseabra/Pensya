import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Loader2, RefreshCw } from "lucide-react";
import { SECOES_RADAR } from "@/lib/anamnese-schema";

interface Props {
  scores: Record<string, number>;
  loading?: boolean;
  onRegenerar?: () => void;
}

export function RadarAnamnese({ scores, loading, onRegenerar }: Props) {
  const data = SECOES_RADAR.map((s) => ({
    dominio: s.label,
    valor: typeof scores[s.key] === "number" ? scores[s.key] : 0,
  }));

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Radar da Anamnese</CardTitle>
        {onRegenerar && (
          <Button size="sm" variant="ghost" onClick={onRegenerar} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div id="radar-anamnese-chart" className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dominio" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar name="Score" dataKey="valor" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Score 0–10 por domínio (10 = funcionamento adequado · 0 = grande prioridade clínica).
        </p>
      </CardContent>
    </Card>
  );
}
