import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { Target, TrendingUp, TrendingDown, Minus, Lightbulb, Waypoints } from "lucide-react";

/**
 * Monitoramento por meta (Fase 3 · ETAPA 11).
 * Continuidade do plano: estado atual, histórico GAS, evidências clínicas,
 * componentes fortalecidos × limitantes e sugestões automáticas — a partir do
 * que foi registrado nas sessões (evidências, componentes, GAS, progresso).
 */

const PROGRESSO_POS = new Set(["sim", "parcial"]);
const PROGRESSO_NEG = new Set(["regressao", "sem_mudanca"]);

type MetaMonitor = {
  metaId: string;
  titulo: string;
  dominio: string | null;
  status: string | null;
  pontosGas: { label: string; data: string; gas: number }[];
  evidencias: { data: string; texto: string }[];
  fortalecidos: { nome: string; n: number }[];
  limitantes: { nome: string; n: number }[];
  ultimaData: string | null;
  ultimoGas: number | null;
  tendencia: "progresso" | "estavel" | "regressao" | "sem_dados";
  sugestoes: string[];
};

export function MonitoramentoMetas({ pacienteId }: { pacienteId: string }) {
  const { data: sessoes } = useQuery({
    queryKey: ["monitor-metas-sessoes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("id, data_sessao, sessao_metas(meta_id, nivel_gas_observado, evidencias_clinicas, componentes_trabalhados, houve_progresso)")
        .eq("paciente_id", pacienteId)
        .order("data_sessao", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["monitor-metas-lista", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas_terapeuticas")
        .select("id, titulo, dominio_cognitivo, status")
        .eq("paciente_id", pacienteId);
      return (data ?? []) as any[];
    },
  });

  const monitores = useMemo<MetaMonitor[]>(() => {
    if (!sessoes || !metas) return [];
    const metaMap = new Map(metas.map((m: any) => [m.id, m]));
    const porMeta = new Map<string, any[]>();
    for (const s of sessoes) {
      for (const sm of (s.sessao_metas ?? [])) {
        const arr = porMeta.get(sm.meta_id) ?? [];
        arr.push({ ...sm, data: s.data_sessao });
        porMeta.set(sm.meta_id, arr);
      }
    }

    const out: MetaMonitor[] = [];
    for (const [metaId, regs] of porMeta.entries()) {
      const meta = metaMap.get(metaId);
      if (!meta) continue;
      regs.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

      const pontosGas = regs
        .filter((r) => r.nivel_gas_observado != null)
        .map((r) => ({ label: format(parseISO(r.data), "dd/MM"), data: r.data, gas: Number(r.nivel_gas_observado) }));

      const evidencias = regs
        .filter((r) => (r.evidencias_clinicas ?? "").trim())
        .map((r) => ({ data: r.data, texto: r.evidencias_clinicas as string }))
        .reverse();

      // Componentes fortalecidos × limitantes (ponderados pelo progresso da sessão)
      const forte = new Map<string, number>();
      const limita = new Map<string, number>();
      for (const r of regs) {
        const comps: string[] = Array.isArray(r.componentes_trabalhados) ? r.componentes_trabalhados : [];
        if (!comps.length) continue;
        if (PROGRESSO_POS.has(r.houve_progresso)) comps.forEach((c) => forte.set(c, (forte.get(c) ?? 0) + 1));
        else if (PROGRESSO_NEG.has(r.houve_progresso)) comps.forEach((c) => limita.set(c, (limita.get(c) ?? 0) + 1));
      }
      const fortalecidos = Array.from(forte.entries()).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n).slice(0, 6);
      const limitantes = Array.from(limita.entries()).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n).slice(0, 6);

      const gass = pontosGas.map((p) => p.gas);
      let tendencia: MetaMonitor["tendencia"] = "sem_dados";
      if (gass.length >= 2) {
        const half = Math.floor(gass.length / 2);
        const a = avg(gass.slice(0, half)); const b = avg(gass.slice(half));
        tendencia = b - a >= 0.5 ? "progresso" : a - b >= 0.5 ? "regressao" : "estavel";
      }
      const ultimoGas = gass.length ? gass[gass.length - 1] : null;
      const ultimaData = regs[regs.length - 1]?.data ?? null;

      const sugestoes: string[] = [];
      const gasAltos = gass.filter((g) => g >= 1).length;
      if (ultimoGas != null && ultimoGas >= 1 && gasAltos >= 2) sugestoes.push("Meta atingida/superada (GAS ≥ +1 em ≥2 sessões) — considerar graduar ou encerrar.");
      if (tendencia === "regressao") sugestoes.push("Tendência de queda no GAS — reavaliar estratégias e componentes limitantes.");
      if (ultimaData) {
        const dias = Math.floor((Date.now() - new Date(ultimaData).getTime()) / 86400000);
        if (dias > 21) sugestoes.push(`Sem registro há ${dias} dias — retomar ou revisar a meta.`);
      }
      if (limitantes.length && !fortalecidos.length) sugestoes.push(`Componentes ainda limitantes: ${limitantes.map((c) => c.nome).join(", ")} — priorizar mediação nesses pontos.`);
      if (!sugestoes.length && tendencia === "progresso") sugestoes.push("Evolução positiva — manter o plano e avançar na progressão.");

      out.push({
        metaId, titulo: meta.titulo, dominio: meta.dominio_cognitivo ?? null, status: meta.status ?? null,
        pontosGas, evidencias, fortalecidos, limitantes, ultimaData, ultimoGas, tendencia, sugestoes,
      });
    }
    // metas com dados primeiro
    return out.sort((a, b) => (b.pontosGas.length + b.evidencias.length) - (a.pontosGas.length + a.evidencias.length));
  }, [sessoes, metas]);

  if (monitores.length === 0) {
    return (
      <Card className="glass">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-brand" /> Monitoramento por meta</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Ainda sem registros de meta em sessões. Registre sessões de intervenção com GAS e evidências para acompanhar aqui.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-brand" /> Monitoramento por meta</CardTitle>
        <p className="text-xs text-muted-foreground">Continuidade do plano: estado atual, histórico GAS, evidências e componentes fortalecidos × limitantes.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {monitores.map((m) => <MetaMonitorCard key={m.metaId} m={m} />)}
      </CardContent>
    </Card>
  );
}

function MetaMonitorCard({ m }: { m: MetaMonitor }) {
  const TendIcon = m.tendencia === "progresso" ? TrendingUp : m.tendencia === "regressao" ? TrendingDown : Minus;
  const tendCls = m.tendencia === "progresso" ? "text-emerald-600" : m.tendencia === "regressao" ? "text-rose-600" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{m.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {m.dominio && <Badge variant="outline" className="text-[10px]">{m.dominio}</Badge>}
            {m.status && m.status !== "ativa" && (
              <Badge variant="outline" className="text-[10px] capitalize border-amber-400 text-amber-700 dark:text-amber-300">{m.status}</Badge>
            )}
            {m.ultimoGas != null && <Badge variant="secondary">GAS atual {m.ultimoGas > 0 ? "+" : ""}{m.ultimoGas}</Badge>}
            <span className={`flex items-center gap-1 ${tendCls}`}><TendIcon className="h-3.5 w-3.5" /> {m.tendencia}</span>
            {m.ultimaData && <span className="text-muted-foreground">últ. {format(parseISO(m.ultimaData), "dd/MM/yy")}</span>}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* Histórico GAS */}
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Histórico GAS</p>
          {m.pontosGas.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/70">Sem GAS registrado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={m.pontosGas}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} fontSize={10} width={24} />
                <Tooltip />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="gas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Componentes fortalecidos × limitantes */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Waypoints className="h-3 w-3" /> Componentes clínicos</p>
          <div className="space-y-1.5">
            <div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Fortalecidos:</span>{" "}
              {m.fortalecidos.length ? m.fortalecidos.map((c) => (
                <Badge key={c.nome} className="mr-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 text-[10px]">{c.nome} ·{c.n}</Badge>
              )) : <span className="text-[10px] text-muted-foreground/70">—</span>}
            </div>
            <div>
              <span className="text-[10px] text-rose-700 dark:text-rose-300">Ainda limitantes:</span>{" "}
              {m.limitantes.length ? m.limitantes.map((c) => (
                <Badge key={c.nome} className="mr-1 bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 text-[10px]">{c.nome} ·{c.n}</Badge>
              )) : <span className="text-[10px] text-muted-foreground/70">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Evidências clínicas (timeline) */}
      {m.evidencias.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Evidências clínicas recentes</p>
          <div className="space-y-1">
            {m.evidencias.slice(0, 4).map((e, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="shrink-0 text-muted-foreground">{format(parseISO(e.data), "dd/MM")}</span>
                <span className="line-clamp-2">{e.texto}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sugestões automáticas */}
      {m.sugestoes.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 p-2 dark:bg-amber-950/20">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200"><Lightbulb className="h-3 w-3" /> Sugestões para as próximas intervenções</p>
          {m.sugestoes.map((s, i) => <p key={i} className="text-[11px] text-amber-900 dark:text-amber-100">• {s}</p>)}
        </div>
      )}
    </div>
  );
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
