import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Brain, TrendingDown, TrendingUp, Minus, Activity, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { CIF_DIM_LABEL, type ImpactoCif } from "@/components/prontuario/ImpactosCIFEditor";
import {
  usePerfilCognitivo, expandirTeste, classifPercentil, corHeatPercentil,
  type TesteRow, type Metrica,
} from "@/hooks/use-perfil-cognitivo";

function tendenciaIcon(p: number | null) {
  const c = classifPercentil(p);
  if (c.tone === "ok") return <TrendingUp className="w-4 h-4 text-emerald-600" />;
  if (c.tone === "warn" || c.tone === "danger") return <TrendingDown className="w-4 h-4 text-rose-600" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function PerfilCognitivoTab({ pacienteId }: { pacienteId: string }) {
  const { testes: data, isLoading, porDominio, radarData } = usePerfilCognitivo(pacienteId);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-brand" />
            Mapeamento do Funcionamento Cognitivo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Percentil médio por domínio considerando <strong>todas as variáveis</strong> dos testes aplicados.
            Quanto mais externo no gráfico, melhor o desempenho.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && radarData.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum teste com pontuação registrado. Adicione testes (e variáveis) na aba <strong>Avaliação</strong> para gerar o mapa cognitivo.
            </p>
          )}
          {radarData.length > 0 && (
            <>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="80%" margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
                    <defs>
                      <radialGradient id="radarFill" cx="50%" cy="50%" r="65%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      </radialGradient>
                    </defs>
                    {/* Bandas de referência */}
                    <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" gridType="polygon" />
                    <PolarAngleAxis
                      dataKey="dominio"
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      stroke="transparent"
                      tickCount={5}
                    />
                    <Radar
                      name="Percentil"
                      dataKey="percentil"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      fill="url(#radarFill)"
                      fillOpacity={1}
                      dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, boxShadow: "0 6px 24px hsl(var(--foreground) / 0.08)" }}
                      formatter={(v: any) => [`P${v}`, "Percentil médio"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-3 justify-center text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                <LegendDot cor="bg-rose-500" label="Rebaixado (< P9)" />
                <LegendDot cor="bg-amber-500" label="Médio inferior (P9–24)" />
                <LegendDot cor="bg-sky-500" label="Médio (P25–74)" />
                <LegendDot cor="bg-emerald-500" label="Superior (≥ P75)" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cards por domínio */}
      {porDominio.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {porDominio.map((d) => {
            const pcts = d.metricas.map((m) => m.percentil).filter((p): p is number => p != null);
            const media = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
            const c = classifPercentil(media);
            const top = [...d.metricas]
              .filter((m) => m.percentil != null)
              .sort((a, b) => (b.percentil ?? -1) - (a.percentil ?? -1))
              .slice(0, 4);
            return (
              <Card key={d.nome} className={`glass ${c.bg.replace("/10", "/5").replace("/15", "/5").replace("/25", "/5").replace("/30", "/5")}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      {tendenciaIcon(media)}
                      <span className="truncate">{d.nome}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" title="Testes">{d.testes.size}t</Badge>
                      <Badge variant="outline" title="Variáveis">{d.metricas.length}v</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-semibold">{media != null ? `P${media}` : "—"}</span>
                    <Badge className={c.bg + " " + c.cor + " border-transparent"}>{c.label}</Badge>
                  </div>
                  <Progress value={media ?? 0} className="h-1.5" />
                  <ul className="text-[11px] space-y-1 pt-1">
                    {top.map((m, i) => (
                      <li key={`${m.testeId}-${m.variavelKey ?? "_t"}-${i}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">
                          <span className="font-medium text-foreground/80">{m.testeNome}</span>
                          {m.variavelKey && <span> · {m.variavelLabel}</span>}
                        </span>
                        <span className="shrink-0 font-medium">{m.percentil != null ? `P${m.percentil}` : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Heatmap por teste/variável */}
      {(data ?? []).length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" />
              Heatmap de Resultados
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique no teste para expandir as variáveis. Cor da célula reflete a classificação do percentil.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium w-6"></th>
                  <th className="py-2 pr-3 font-medium">Domínio</th>
                  <th className="py-2 pr-3 font-medium">Teste / Variável</th>
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium text-center">Bruto</th>
                  <th className="py-2 pr-3 font-medium text-center">Padrão</th>
                  <th className="py-2 pr-3 font-medium text-center">Percentil</th>
                  <th className="py-2 pr-3 font-medium">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((t) => (
                  <LinhaTeste key={t.id} teste={t} metricas={expandirTeste(t)} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <TestesQualitativos testes={data ?? []} />

      <SinteseCIF testes={data ?? []} />
    </div>
  );
}

function LinhaTeste({ teste, metricas }: { teste: TesteRow; metricas: Metrica[] }) {
  const [aberto, setAberto] = useState(false);
  const variaveis = metricas.filter((m) => m.variavelKey != null);
  const agregado = metricas.find((m) => m.variavelKey == null);
  const temVars = variaveis.length > 0;

  // Linha "principal" do teste: usa agregado quando há; senão média das variáveis
  const pctPrincipal = agregado?.percentil ?? (() => {
    const pcts = variaveis.map((v) => v.percentil).filter((p): p is number => p != null);
    return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  })();
  const cls = classifPercentil(pctPrincipal);
  const labelClassif = (agregado ? teste.classificacao : null) ?? cls.label;

  return (
    <>
      <tr className="border-t border-border/40 hover:bg-muted/20">
        <td className="py-2 pr-1 align-top">
          {temVars ? (
            <Button
              size="icon" variant="ghost"
              className="h-6 w-6"
              onClick={() => setAberto((v) => !v)}
              aria-label={aberto ? "Recolher" : "Expandir"}
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${aberto ? "rotate-90" : ""}`} />
            </Button>
          ) : null}
        </td>
        <td className="py-2 pr-3 text-muted-foreground align-top">{teste.teste?.dominio?.nome ?? "—"}</td>
        <td className="py-2 pr-3 font-medium align-top">
          {teste.teste?.nome ?? "—"}
          {temVars && <span className="ml-2 text-[10px] text-muted-foreground">({variaveis.length} variáveis)</span>}
        </td>
        <td className="py-2 pr-3 text-muted-foreground align-top">{teste.data_aplicacao ? format(parseISO(teste.data_aplicacao), "dd/MM/yy") : "—"}</td>
        <td className="py-2 pr-3 text-center align-top">{agregado?.bruto ?? "—"}</td>
        <td className="py-2 pr-3 text-center align-top">{agregado?.padrao ?? "—"}</td>
        <td className="py-2 pr-3 text-center align-top">
          <span
            className={`inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 font-semibold ${corHeatPercentil(pctPrincipal)}`}
            title={agregado?.percentilEstimado ? "Percentil estimado a partir do escore padrão" : undefined}
          >
            {pctPrincipal != null ? `${agregado?.percentilEstimado ? "≈" : ""}P${pctPrincipal}` : "—"}
          </span>
        </td>
        <td className="py-2 pr-3 align-top">
          <Badge className={`${cls.bg} ${cls.cor} border-transparent`}>{labelClassif}</Badge>
        </td>
      </tr>
      {aberto && variaveis.map((m, i) => {
        const c = classifPercentil(m.percentil);
        return (
          <tr key={`${m.testeId}-${m.variavelKey}-${i}`} className="border-t border-border/20 bg-muted/10">
            <td></td>
            <td></td>
            <td className="py-1.5 pr-3 pl-6 text-muted-foreground">
              <span className="text-foreground/80">↳ {m.variavelLabel}</span>
            </td>
            <td></td>
            <td className="py-1.5 pr-3 text-center">{m.bruto ?? "—"}</td>
            <td className="py-1.5 pr-3 text-center">{m.padrao ?? "—"}</td>
            <td className="py-1.5 pr-3 text-center">
              <span
                className={`inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 font-semibold ${corHeatPercentil(m.percentil)}`}
                title={m.percentilEstimado ? "Percentil estimado a partir do escore padrão" : undefined}
              >
                {m.percentil != null ? `${m.percentilEstimado ? "≈" : ""}P${m.percentil}` : "—"}
              </span>
            </td>
            <td className="py-1.5 pr-3">
              <Badge variant="outline" className={`${c.cor} border-transparent ${c.bg}`}>{c.label}</Badge>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function TestesQualitativos({ testes }: { testes: TesteRow[] }) {
  // Testes sem padrão/percentil/escore agregado e sem variáveis com pontuação,
  // mas com observações qualitativas ou interpretação clínica.
  const itens = (testes ?? []).filter((t) => {
    const metricas = expandirTeste(t);
    const semPontuacao = metricas.length === 0;
    const temTexto = !!(t.observacoes_qualitativas || t.interpretacao_clinica);
    return semPontuacao && temTexto;
  });
  if (itens.length === 0) return null;
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-4 h-4 text-brand" />
          Testes qualitativos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Instrumentos sem pontuação normativa — leitura clínica e observações registradas.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.map((t) => (
          <div key={t.id} className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">{t.teste?.nome ?? "Teste"}</p>
              <div className="flex items-center gap-1.5">
                {t.teste?.dominio?.nome && (
                  <Badge variant="outline" className="text-[10px]">{t.teste.dominio.nome}</Badge>
                )}
                <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-300">Qualitativo</Badge>
                {t.data_aplicacao && (
                  <span className="text-[10px] text-muted-foreground">{format(parseISO(t.data_aplicacao), "dd/MM/yy")}</span>
                )}
              </div>
            </div>
            {t.interpretacao_clinica && (
              <p className="text-xs"><span className="text-muted-foreground">Interpretação:</span> {t.interpretacao_clinica}</p>
            )}
            {t.observacoes_qualitativas && (
              <p className="text-xs"><span className="text-muted-foreground">Observações:</span> {t.observacoes_qualitativas}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LegendDot({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${cor}`} />
      {label}
    </span>
  );
}

function SinteseCIF({ testes }: { testes: TesteRow[] }) {
  const dims = (Object.keys(CIF_DIM_LABEL) as (keyof typeof CIF_DIM_LABEL)[]);
  const buckets = dims.map((dim) => {
    const items: { teste: string; tipo: ImpactoCif["tipo"]; nota?: string }[] = [];
    for (const t of testes) {
      const impactos = (t.impactos_cif ?? []) as ImpactoCif[];
      for (const imp of impactos) {
        if (imp.dim === dim) items.push({ teste: t.teste?.nome ?? "Teste", tipo: imp.tipo, nota: imp.nota });
      }
    }
    return { dim, items };
  }).filter(b => b.items.length > 0);

  if (buckets.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-brand" />Síntese CIF</CardTitle>
        <p className="text-xs text-muted-foreground">Resultados conectados a cada dimensão funcional.</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {buckets.map(({ dim, items }) => (
          <div key={dim} className="rounded-lg border border-border/50 bg-background/40 p-3">
            <p className="text-sm font-medium mb-2">{CIF_DIM_LABEL[dim]}</p>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <Badge variant="outline" className={
                    "shrink-0 " + (
                      it.tipo === "forca" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                      : it.tipo === "fragilidade" ? "border-rose-500/40 text-rose-700 dark:text-rose-300"
                      : "border-sky-500/40 text-sky-700 dark:text-sky-300"
                    )
                  }>
                    {it.tipo === "forca" ? "Força" : it.tipo === "fragilidade" ? "Fragilidade" : "Observação"}
                  </Badge>
                  <span className="min-w-0">
                    <span className="font-medium">{it.teste}</span>
                    {it.nota && <span className="text-muted-foreground"> — {it.nota}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
