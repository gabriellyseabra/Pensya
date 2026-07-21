import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Target, CalendarCheck, Brain } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VariaveisModeradorasChart } from "@/components/paciente/VariaveisModeradorasChart";
import { MonitoramentoMetas } from "@/components/prontuario/MonitoramentoMetas";
import { DevolutivaAutomatica } from "@/components/prontuario/DevolutivaAutomatica";
import { normalizarHabilidade } from "@/lib/habilidades";

type Props = { pacienteId: string };

export function EvolucaoTab({ pacienteId }: Props) {
  // Testes aplicados (com avaliação e domínio)
  const { data: testes } = useQuery({
    queryKey: ["evolucao-testes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("testes_aplicados")
        .select(`
          id, percentil, escore_padrao, classificacao, data_aplicacao, escore_bruto,
          teste:testes_catalogo(id, nome, dominio:dominios_cognitivos(id, nome)),
          avaliacao:avaliacoes!inner(id, titulo, paciente_id, data_inicio)
        `)
        .eq("avaliacao.paciente_id", pacienteId);
      return (data ?? []).filter((t: any) => t.percentil != null);
    },
  });

  // Sessões + metas (com desempenho + GAS)
  const { data: sessoes } = useQuery({
    queryKey: ["evolucao-sessoes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select(`
          id, data_sessao, engajamento, nivel_suporte, habilidades_trabalhadas,
          sessao_metas(meta_id, plano_meta_id, desempenho, engajamento, nivel_suporte, nivel_gas_observado)
        `)
        .eq("paciente_id", pacienteId)
        .order("data_sessao", { ascending: true });
      return data ?? [];
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["evolucao-metas", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas_terapeuticas")
        .select("id, titulo, dominio_cognitivo, status")
        .eq("paciente_id", pacienteId);
      return data ?? [];
    },
  });

  // Frequência
  const { data: frequencia } = useQuery({
    queryKey: ["evolucao-frequencia", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("data_referencia, tipo")
        .eq("paciente_id", pacienteId)
        .order("data_referencia", { ascending: true });
      return data ?? [];
    },
  });

  const PRESENTES = new Set(["presente", "reposicao"]);


  // === Percentis por domínio ao longo do tempo ===
  const percentisData = useMemo(() => {
    if (!testes) return { series: [], dominios: [] };
    const byDate = new Map<string, any>();
    const dominiosSet = new Set<string>();
    testes.forEach((t: any) => {
      const dom = t.teste?.dominio?.nome ?? "Sem domínio";
      const date = t.data_aplicacao ?? t.avaliacao?.data_inicio;
      if (!date) return;
      dominiosSet.add(dom);
      const key = date;
      if (!byDate.has(key)) byDate.set(key, { data: key, _counts: {} });
      const row = byDate.get(key);
      // média de percentis no domínio na mesma data
      row[dom] = (row[dom] ?? 0) + Number(t.percentil);
      row._counts[dom] = (row._counts[dom] ?? 0) + 1;
    });
    const series = Array.from(byDate.values())
      .map((r) => {
        const out: any = { data: r.data, label: format(parseISO(r.data), "dd/MM/yy") };
        Object.keys(r._counts).forEach((d) => {
          out[d] = +(r[d] / r._counts[d]).toFixed(1);
        });
        return out;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
    return { series, dominios: Array.from(dominiosSet) };
  }, [testes]);

  // === Radar: percentil mais recente por domínio ===
  const radarData = useMemo(() => {
    if (!testes) return [];
    const latest = new Map<string, { dom: string; percentil: number; data: string; count: number; sum: number }>();
    testes.forEach((t: any) => {
      const dom = t.teste?.dominio?.nome ?? "Sem domínio";
      const date = t.data_aplicacao ?? t.avaliacao?.data_inicio;
      if (!date) return;
      const cur = latest.get(dom);
      if (!cur || date > cur.data) {
        latest.set(dom, { dom, percentil: Number(t.percentil), data: date, count: 1, sum: Number(t.percentil) });
      } else if (date === cur.data) {
        cur.sum += Number(t.percentil);
        cur.count += 1;
        cur.percentil = +(cur.sum / cur.count).toFixed(1);
      }
    });
    return Array.from(latest.values()).map((r) => ({
      dominio: r.dom,
      percentil: r.percentil,
      referencia: 50,
    }));
  }, [testes]);

  // === Desempenho + GAS por meta ao longo das sessões ===
  const progressoPorMeta = useMemo(() => {
    if (!sessoes || !metas) return [];
    const metaMap = new Map(metas.map((m: any) => [m.id, m]));
    const grouped = new Map<string, any[]>();
    sessoes.forEach((s: any) => {
      (s.sessao_metas ?? []).forEach((sm: any) => {
        if (sm.desempenho == null && sm.nivel_gas_observado == null) return;
        const meta = metaMap.get(sm.meta_id);
        if (!meta) return;
        const arr = grouped.get(sm.meta_id) ?? [];
        arr.push({
          data: s.data_sessao,
          label: format(parseISO(s.data_sessao), "dd/MM"),
          desempenho: sm.desempenho ?? null,
          gas: sm.nivel_gas_observado ?? null,
        });
        grouped.set(sm.meta_id, arr);
      });
    });
    return Array.from(grouped.entries())
      .map(([id, pts]) => ({
        meta: metaMap.get(id) as any,
        pontos: pts.sort((a, b) => a.data.localeCompare(b.data)),
      }))
      .filter((g) => g.pontos.length > 0);
  }, [sessoes, metas]);

  // === Habilidades trabalhadas: ranking + evolução mensal ===
  const habilidadesData = useMemo(() => {
    if (!sessoes) return { ranking: [], serieMensal: [], topLabels: [] as string[], totalSessoesComHabilidade: 0 };

    const totalPorHabilidade = new Map<string, { label: string; total: number }>();
    const porMesHabilidade = new Map<string, Map<string, number>>(); // mes -> habilidade -> contagem de sessões
    let totalSessoesComHabilidade = 0;

    sessoes.forEach((s: any) => {
      const lista: { habilidade: string; sub_habilidade?: string }[] = Array.isArray(s.habilidades_trabalhadas) ? s.habilidades_trabalhadas : [];
      if (lista.length === 0) return;
      totalSessoesComHabilidade++;
      const mes = String(s.data_sessao).slice(0, 7);
      const vistosNaSessao = new Set<string>();
      lista.forEach((h) => {
        const bruto = (h.habilidade ?? "").trim();
        if (!bruto) return;
        // Agrupa variações ("leitura e compreensão" / "leitura e interpretação"…)
        // numa mesma área canônica para o monitoramento.
        const nome = normalizarHabilidade(bruto);
        const key = nome.toLowerCase();
        if (!totalPorHabilidade.has(key)) totalPorHabilidade.set(key, { label: nome, total: 0 });
        if (!vistosNaSessao.has(key)) {
          totalPorHabilidade.get(key)!.total++;
          vistosNaSessao.add(key);
          const mesMap = porMesHabilidade.get(mes) ?? new Map<string, number>();
          mesMap.set(key, (mesMap.get(key) ?? 0) + 1);
          porMesHabilidade.set(mes, mesMap);
        }
      });
    });

    const ranking = Array.from(totalPorHabilidade.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);

    const TOP_N = 6;
    const topLabels = ranking.slice(0, TOP_N).map((r) => r.label);
    const topKeys = new Set(ranking.slice(0, TOP_N).map((r) => r.key));
    const labelByKey = new Map(ranking.map((r) => [r.key, r.label]));

    const serieMensal = Array.from(porMesHabilidade.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, mapa]) => {
        const row: any = { mes, label: format(parseISO(mes + "-01"), "MMM/yy", { locale: ptBR }) };
        let outras = 0;
        mapa.forEach((count, key) => {
          if (topKeys.has(key)) row[labelByKey.get(key)!] = count;
          else outras += count;
        });
        if (outras > 0) row["Outras"] = outras;
        return row;
      });

    return { ranking, serieMensal, topLabels, totalSessoesComHabilidade };
  }, [sessoes]);

  // Alertas determinísticos
  const alertas = useMemo(() => {
    const out: string[] = [];
    for (const g of progressoPorMeta) {
      const desemps = g.pontos.map((p) => p.desempenho).filter((n) => n != null) as number[];
      const recentes = desemps.slice(-4);
      if (recentes.length >= 4 && recentes.reduce((a, b) => a + b, 0) / recentes.length < 2) {
        out.push(`Meta "${g.meta.titulo}" — desempenho médio recente abaixo de 2/5. Revisar abordagem.`);
      }
      const gass = g.pontos.map((p) => p.gas).filter((n) => n != null) as number[];
      if (gass.filter((n) => n >= 1).length >= 3) {
        out.push(`Meta "${g.meta.titulo}" — GAS ≥ +1 em ≥3 registros. Considerar encerramento.`);
      }
      // sem registro recente
      const ultima = g.pontos[g.pontos.length - 1]?.data;
      if (ultima) {
        const dias = Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000);
        if (dias > 21) out.push(`Meta "${g.meta.titulo}" — sem registro há ${dias} dias.`);
      }
    }
    return out;
  }, [progressoPorMeta]);

  // === Frequência mensal ===
  const freqMensal = useMemo(() => {
    if (!frequencia) return [];
    const m = new Map<string, { mes: string; presencas: number; faltas: number }>();
    frequencia.forEach((f: any) => {
      const mes = (f.data_referencia as string).slice(0, 7);
      const row = m.get(mes) ?? { mes, presencas: 0, faltas: 0 };
      if (PRESENTES.has(f.tipo)) row.presencas++;
      else row.faltas++;
      m.set(mes, row);
    });
    return Array.from(m.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        ...r,
        label: format(parseISO(r.mes + "-01"), "MMM/yy", { locale: ptBR }),
        taxa: r.presencas + r.faltas > 0
          ? +((r.presencas / (r.presencas + r.faltas)) * 100).toFixed(1)
          : 0,
      }));
  }, [frequencia]);

  const palette = ["hsl(var(--brand))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-5">
        <Kpi icon={<Activity className="h-4 w-4" />} label="Testes lançados" value={testes?.length ?? 0} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Sessões registradas" value={sessoes?.length ?? 0} />
        <Kpi icon={<Target className="h-4 w-4" />} label="Metas com registro" value={progressoPorMeta.length} />
        <Kpi icon={<Brain className="h-4 w-4" />} label="Habilidades trabalhadas" value={habilidadesData.ranking.length} />
        <Kpi
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Presença geral"
          value={
            frequencia && frequencia.length > 0
              ? `${Math.round((frequencia.filter((f: any) => PRESENTES.has(f.tipo)).length / frequencia.length) * 100)}%`
              : "—"
          }
        />
      </div>

      {/* Monitoramento por meta (Fase 3) */}
      <MonitoramentoMetas pacienteId={pacienteId} />

      {/* Devolutiva clínica automática (Fase 3) */}
      <DevolutivaAutomatica pacienteId={pacienteId} />

      {/* Radar: perfil cognitivo atual */}
      {radarData.length >= 3 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Perfil cognitivo atual</CardTitle>
            <p className="text-xs text-muted-foreground">
              Percentil mais recente por domínio. Linha tracejada = referência (P50). Quanto mais próxima da borda, melhor o desempenho normativo.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dominio" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Referência (P50)" dataKey="referencia" stroke="hsl(var(--muted-foreground))" fill="transparent" strokeDasharray="4 4" />
                <Radar name="Paciente" dataKey="percentil" stroke="hsl(var(--brand))" fill="hsl(var(--brand))" fillOpacity={0.3} strokeWidth={2} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <VariaveisModeradorasChart pacienteId={pacienteId} />



      {/* Percentis Guilmette por domínio */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Percentis por domínio cognitivo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Média dos percentis dos testes aplicados em cada data. Faixas de referência Guilmette (2020):
            &lt;9 baixo, 25–75 médio, &gt;75 alto.
          </p>
        </CardHeader>
        <CardContent>
          {percentisData.series.length === 0 ? (
            <Empty msg="Nenhum teste com percentil lançado ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={percentisData.series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} label={{ value: "Percentil", angle: -90, position: "insideLeft", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={9} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Baixo (9)", fontSize: 10, fill: "#ef4444" }} />
                <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" />
                {percentisData.dominios.map((d, i) => (
                  <Line
                    key={d}
                    type="monotone"
                    dataKey={d}
                    stroke={palette[i % palette.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="glass border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600" /> Alertas automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {alertas.map((a, i) => (
              <p key={i} className="text-xs text-amber-900 dark:text-amber-200">• {a}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progresso por meta (desempenho + GAS) */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Progresso por meta</CardTitle>
          <p className="text-xs text-muted-foreground">
            Linha cheia: desempenho 1–5 (registrado a cada sessão). Linha tracejada: GAS −2 a +2 (opcional).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {progressoPorMeta.length === 0 ? (
            <Empty msg="Nenhum registro de meta em sessões ainda." />
          ) : (
            progressoPorMeta.map((g, i) => {
              const ultimoDesemp = [...g.pontos].reverse().find((p) => p.desempenho != null)?.desempenho;
              const ultimoGas = [...g.pontos].reverse().find((p) => p.gas != null)?.gas;
              return (
                <div key={g.meta.id} className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-sm">{g.meta.titulo}</p>
                      {g.meta.dominio_cognitivo && (
                        <Badge variant="outline" className="mt-1 text-[10px]">{g.meta.dominio_cognitivo}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {ultimoDesemp != null && <Badge variant="secondary">Desemp. {ultimoDesemp}/5</Badge>}
                      {ultimoGas != null && <Badge variant="outline">GAS {ultimoGas > 0 ? "+" : ""}{ultimoGas}</Badge>}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={g.pontos}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="d" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
                      <YAxis yAxisId="g" orientation="right" domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} fontSize={11} />
                      <Tooltip />
                      <ReferenceLine yAxisId="g" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Line yAxisId="d" type="monotone" dataKey="desempenho" stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} name="Desempenho" connectNulls />
                      <Line yAxisId="g" type="monotone" dataKey="gas" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} name="GAS" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Habilidades mais trabalhadas (ranking) */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Habilidades mais trabalhadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nº de sessões por <strong>área de habilidade</strong> (variações semelhantes são agrupadas —
            ex.: "leitura e compreensão" e "leitura e interpretação" contam juntas)
            {habilidadesData.totalSessoesComHabilidade > 0 ? ` · ${habilidadesData.totalSessoesComHabilidade} sessões com habilidade registrada` : ""}.
          </p>
        </CardHeader>
        <CardContent>
          {habilidadesData.ranking.length === 0 ? (
            <Empty msg="Nenhuma habilidade registrada nas sessões ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, habilidadesData.ranking.length * 32)}>
              <BarChart data={habilidadesData.ranking} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="label" width={160} fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" name="Sessões" fill="hsl(var(--brand))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Evolução das habilidades ao longo do tempo */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Evolução das habilidades trabalhadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nº de sessões por mês em que cada área de habilidade mais frequente foi trabalhada (as demais somam em "Outras").
          </p>
        </CardHeader>
        <CardContent>
          {habilidadesData.serieMensal.length === 0 ? (
            <Empty msg="Nenhuma habilidade registrada nas sessões ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={habilidadesData.serieMensal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} label={{ value: "Sessões", angle: -90, position: "insideLeft", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {habilidadesData.topLabels.map((label, i) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={palette[i % palette.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
                {habilidadesData.serieMensal.some((r: any) => r.Outras != null) && (
                  <Line type="monotone" dataKey="Outras" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Frequência mensal */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Frequência mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {freqMensal.length === 0 ? (
            <Empty msg="Nenhum registro de frequência ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={freqMensal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="presencas" name="Presenças" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="faltas" name="Faltas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="glass">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{msg}</p>;
}
