import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Brain, Rotate3d, Layers, Info, AlertTriangle } from "lucide-react";
import { usePerfilCognitivo, type Metrica } from "@/hooks/use-perfil-cognitivo";
import {
  AVISO_MAPA,
  COR_INTERVENCAO,
  COR_SEM_DADOS,
  REGIOES,
  classificacaoDesempenho,
  corDesempenho,
  distribuirEmRegioes,
  fraseDesempenho,
  redesDaRegiao,
  rotuloLado,
  type RegiaoDef,
} from "@/lib/neuro-mapa";
import type { BrainRegion } from "./Brain3D";

const Brain3D = lazy(() => import("./Brain3D"));

/* ============================================================
 * Mapa funcional do paciente (3D interativo).
 *
 * A leitura tem DOIS canais que nunca se sobrescrevem:
 *   cor  = como está (avaliação)      halo = o que estamos fazendo (intervenção)
 *
 * É esse cruzamento que sustenta a frase mais importante da devolutiva:
 * "esta é a via mais frágil E é exatamente onde estamos trabalhando".
 * O cruzamento também expõe o oposto — via frágil SEM intervenção.
 * ============================================================ */

/** Região com os dois canais resolvidos + o detalhe clínico que a sustenta. */
type RegiaoEstado = {
  def: RegiaoDef;
  desempenho: number | null;
  cor: string;
  classificacao: string | null;
  intervencao: number;
  achados: string[];
  estimulos: string[];
};

/** Item de `prontuario_sessoes.habilidades_trabalhadas` (coluna jsonb). */
type HabilidadeSessao = { habilidade?: string | null };

function uniq(arr: string[], max = 8): string[] {
  return Array.from(new Set(arr.filter(Boolean))).slice(0, max);
}

/**
 * Métricas que devem pesar no percentil da região: quando um teste tem
 * variáveis, o escore agregado é descartado para não contar o mesmo teste
 * duas vezes (uma pelas partes, outra pelo total).
 */
function metricasRelevantes(metricas: Metrica[]): Metrica[] {
  const temVariavel = new Set(metricas.filter((m) => m.variavelKey != null).map((m) => m.testeId));
  return metricas.filter((m) => m.variavelKey != null || !temVariavel.has(m.testeId));
}

export function BrainStateCard({ pacienteId }: { pacienteId: string }) {
  const { metricas, isLoading } = usePerfilCognitivo(pacienteId);
  const [mounted, setMounted] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [modoCorte, setModoCorte] = useState(false);
  const [girar, setGirar] = useState(false);
  useEffect(() => setMounted(true), []);

  // Habilidades trabalhadas nas sessões + domínios das metas ativas
  const { data: estimulos } = useQuery({
    queryKey: ["brain-estimulos", pacienteId],
    queryFn: async () => {
      const [{ data: sessoes }, { data: plano }] = await Promise.all([
        supabase
          .from("prontuario_sessoes")
          .select("habilidades_trabalhadas")
          .eq("paciente_id", pacienteId)
          .order("data_sessao", { ascending: false })
          .limit(40),
        supabase
          .from("planos_terapeuticos")
          .select("id")
          .eq("paciente_id", pacienteId)
          .eq("status", "ativo")
          .order("data_inicio", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const habs: string[] = [];
      for (const s of sessoes ?? []) {
        const bruto = (s as { habilidades_trabalhadas?: unknown }).habilidades_trabalhadas;
        const lista: HabilidadeSessao[] = Array.isArray(bruto) ? bruto : [];
        for (const h of lista) {
          const nome = (h?.habilidade ?? "").trim();
          if (nome) habs.push(nome);
        }
      }
      let metasDominios: string[] = [];
      if (plano?.id) {
        const { data: metas } = await supabase
          .from("plano_metas")
          .select("dominio, titulo_smart")
          .eq("plano_id", plano.id);
        metasDominios = (metas ?? [])
          .map((m) => m.dominio || m.titulo_smart)
          .filter((v): v is string => !!v);
      }
      return { habs, metasDominios };
    },
  });

  const regioes = useMemo<RegiaoEstado[]>(() => {
    type Acc = {
      somaPct: number;
      somaPeso: number;
      achados: string[];
      estimulos: string[];
      cargaIntervencao: number;
    };
    const acc: Record<string, Acc> = {};
    for (const r of REGIOES) {
      acc[r.key] = { somaPct: 0, somaPeso: 0, achados: [], estimulos: [], cargaIntervencao: 0 };
    }

    // --- Canal 1: desempenho (média ponderada pelos pesos do mapa funcional)
    for (const m of metricasRelevantes(metricas)) {
      if (m.percentil == null) continue;
      const alvos = distribuirEmRegioes(m.variavelLabel, m.dominio, m.testeNome);
      const label =
        m.variavelLabel && !/total/i.test(m.variavelLabel) ? m.variavelLabel : m.dominio;
      for (const { key, peso } of alvos) {
        const a = acc[key];
        if (!a) continue;
        a.somaPct += m.percentil * peso;
        a.somaPeso += peso;
        if (m.percentil < 25) a.achados.push(label);
      }
    }

    // --- Canal 2: intervenção (sessões + metas do plano ativo)
    const registrarEstimulo = (texto: string) => {
      for (const { key, peso } of distribuirEmRegioes(texto)) {
        const a = acc[key];
        if (!a) continue;
        a.cargaIntervencao += peso;
        a.estimulos.push(texto);
      }
    };
    for (const nome of estimulos?.habs ?? []) registrarEstimulo(nome);
    for (const dom of estimulos?.metasDominios ?? []) registrarEstimulo(dom);

    const cargaMax = Math.max(0, ...Object.values(acc).map((a) => a.cargaIntervencao));

    return REGIOES.map((def) => {
      const a = acc[def.key];
      const desempenho = a.somaPeso > 0 ? Math.round(a.somaPct / a.somaPeso) : null;
      return {
        def,
        desempenho,
        cor: corDesempenho(desempenho),
        classificacao: classificacaoDesempenho(desempenho),
        intervencao: cargaMax > 0 ? a.cargaIntervencao / cargaMax : 0,
        achados: uniq(a.achados),
        estimulos: uniq(a.estimulos),
      };
    });
  }, [metricas, estimulos]);

  const comDados = useMemo(
    () => regioes.filter((r) => r.desempenho != null || r.intervencao > 0),
    [regioes],
  );

  // O cruzamento dos dois canais — a leitura que o mapa antigo tornava impossível
  const cruzamento = useMemo(() => {
    const abaixo = regioes.filter((r) => r.desempenho != null && r.desempenho < 25);
    return {
      cobertas: abaixo.filter((r) => r.intervencao > 0),
      descobertas: abaixo.filter((r) => r.intervencao === 0),
      forcas: regioes.filter((r) => r.desempenho != null && r.desempenho >= 75),
    };
  }, [regioes]);

  const regioes3D = useMemo<BrainRegion[]>(
    () =>
      comDados.map((r) => ({
        key: r.def.key,
        desempenho: r.desempenho,
        cor: r.cor,
        intervencao: r.intervencao,
      })),
    [comDados],
  );

  // Ordena por prioridade clínica: frágil e sem cobertura primeiro
  const ordenadas = useMemo(() => {
    const prioridade = (r: RegiaoEstado) => {
      const fraco = r.desempenho != null && r.desempenho < 25;
      if (fraco && r.intervencao === 0) return 0;
      if (fraco) return 1;
      if (r.intervencao > 0) return 2;
      return 3;
    };
    return [...comDados].sort(
      (a, b) => prioridade(a) - prioridade(b) || (a.desempenho ?? 100) - (b.desempenho ?? 100),
    );
  }, [comDados]);

  const focus = ordenadas.find((r) => r.def.key === hoverKey) ?? ordenadas[0] ?? null;
  const temProfunda = comDados.some((r) => r.def.profunda);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-stretch lg:gap-6">
        {/* Cérebro 3D */}
        <div className="lg:w-[360px] lg:shrink-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-lilac text-lilac-foreground">
              <Brain className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Mapa funcional</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Avaliação e intervenção sobre a mesma anatomia
              </p>
            </div>
          </div>

          <div className="relative h-[320px] overflow-hidden rounded-2xl bg-gradient-to-br from-lilac-soft/40 via-card to-brand/5">
            {mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Carregando cérebro 3D…
                  </div>
                }
              >
                <Brain3D
                  regioes={regioes3D}
                  hover={hoverKey}
                  modoCorte={modoCorte}
                  girar={girar}
                  onHover={setHoverKey}
                />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Brain className="h-16 w-16 text-lilac/40" />
              </div>
            )}

            {/* Controles de condução */}
            <div className="absolute right-2 top-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setModoCorte((v) => !v)}
                title={
                  temProfunda
                    ? "Córtex translúcido — revela hipocampo, amígdala e cingulado"
                    : "Nenhuma estrutura profunda mapeada neste paciente"
                }
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium backdrop-blur transition-colors ${
                  modoCorte
                    ? "bg-brand text-brand-foreground"
                    : "bg-card/80 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3 w-3" /> corte
              </button>
              <button
                type="button"
                onClick={() => setGirar((v) => !v)}
                title="Rotação automática"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium backdrop-blur transition-colors ${
                  girar
                    ? "bg-brand text-brand-foreground"
                    : "bg-card/80 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Rotate3d className="h-3 w-3" /> girar
              </button>
            </div>
          </div>

          {/* Legenda — um canal por linha, para não confundir os dois */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                cor
              </span>
              <span className="flex-1 text-[11px] text-muted-foreground">
                desempenho na avaliação
              </span>
              <span className="flex gap-0.5">
                {[5, 15, 50, 85, 99].map((p) => (
                  <span
                    key={p}
                    className="h-2.5 w-4 rounded-sm"
                    style={{ backgroundColor: corDesempenho(p) }}
                  />
                ))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                halo
              </span>
              <span className="flex-1 text-[11px] text-muted-foreground">em intervenção agora</span>
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: COR_INTERVENCAO }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                cinza
              </span>
              <span className="flex-1 text-[11px] text-muted-foreground">sem teste aplicado</span>
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: COR_SEM_DADOS }} />
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
            <Info className="mt-px h-3 w-3 shrink-0" />
            <span>{AVISO_MAPA}</span>
          </p>
        </div>

        {/* Leitura clínica */}
        <div className="min-w-0 flex-1">
          {!isLoading && comDados.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center">
              <Brain className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Sem mapeamento funcional ainda</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Registre testes na aba <strong>Avaliação</strong> e habilidades nas{" "}
                <strong>Sessões</strong> para ver o cruzamento entre o que está frágil e o que está
                sendo trabalhado.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              {focus && <RegionDetail regiao={focus} isHover={!!hoverKey} />}

              {/* Cruzamento dos dois canais */}
              <div className="grid grid-cols-3 gap-2">
                <MiniStat
                  cor="#f97316"
                  value={cruzamento.descobertas.length}
                  label="frágil sem cobertura"
                />
                <MiniStat
                  cor={COR_INTERVENCAO}
                  value={cruzamento.cobertas.length}
                  label="frágil em trabalho"
                />
                <MiniStat cor="#22c55e" value={cruzamento.forcas.length} label="forças" />
              </div>

              {cruzamento.descobertas.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                    <strong>{cruzamento.descobertas.map((r) => r.def.nome).join(", ")}</strong>{" "}
                    {cruzamento.descobertas.length === 1 ? "está" : "estão"} abaixo do esperado e
                    sem meta ou habilidade registrada na intervenção.
                  </p>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {ordenadas.map((r) => {
                  const ativo = focus?.def.key === r.def.key;
                  const fraco = r.desempenho != null && r.desempenho < 25;
                  return (
                    <button
                      key={r.def.key}
                      type="button"
                      onMouseEnter={() => setHoverKey(r.def.key)}
                      onMouseLeave={() => setHoverKey(null)}
                      onFocus={() => setHoverKey(r.def.key)}
                      onClick={() => setHoverKey(r.def.key)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                        ativo
                          ? "border-brand/40 bg-brand/5 shadow-sm"
                          : "border-border/60 bg-card/60 hover:border-border"
                      }`}
                    >
                      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: r.cor }}
                        />
                        {r.intervencao > 0 && (
                          <span
                            className="absolute inset-0 rounded-full border-2"
                            style={{ borderColor: COR_INTERVENCAO }}
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{r.def.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.desempenho != null ? `percentil ${r.desempenho}` : "sem teste"}
                          {r.intervencao > 0 && " · em trabalho"}
                          {fraco && r.intervencao === 0 && " · sem cobertura"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RegionDetail({ regiao, isHover }: { regiao: RegiaoEstado; isHover: boolean }) {
  const { def } = regiao;
  const redes = redesDaRegiao(def.key);
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: regiao.cor }} />
          {regiao.intervencao > 0 && (
            <span
              className="absolute h-8 w-8 rounded-full border-2"
              style={{ borderColor: COR_INTERVENCAO }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{def.nomeCompleto}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {rotuloLado(def.lado)}
            {def.profunda && " · estrutura profunda"}
            {regiao.classificacao && ` · ${regiao.classificacao}`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{def.resp}</p>

      <p className="mt-2 text-xs leading-relaxed">{fraseDesempenho(def, regiao.desempenho)}</p>

      {regiao.intervencao > 0 ? (
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: COR_INTERVENCAO }}>
          Esta via está sendo trabalhada na intervenção.
        </p>
      ) : (
        regiao.desempenho != null &&
        regiao.desempenho < 25 && (
          <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Ainda sem meta ou habilidade registrada para esta via.
          </p>
        )
      )}

      {redes.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Participa de:</span>{" "}
          {redes.map((r) => r.nome).join(" · ")}
        </p>
      )}

      {(regiao.achados.length > 0 || regiao.estimulos.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Abaixo do esperado
            </p>
            {regiao.achados.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {regiao.achados.slice(0, 6).map((d, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80"
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">—</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Em intervenção
            </p>
            {regiao.estimulos.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {regiao.estimulos.slice(0, 6).map((d, i) => (
                  <span
                    key={i}
                    className="rounded-md px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: `${COR_INTERVENCAO}1f`,
                      color: COR_INTERVENCAO,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">—</p>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground/70">
        {isHover
          ? "Área destacada no cérebro"
          : "Passe o mouse sobre uma marcação do cérebro ou uma área abaixo"}
      </p>
    </div>
  );
}

function MiniStat({ cor, value, label }: { cor: string; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-2.5 text-center">
      <p className="text-xl font-semibold" style={{ color: cor }}>
        {value}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
