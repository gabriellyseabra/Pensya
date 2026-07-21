import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Brain, Sparkles, TrendingDown, ShieldCheck, CircleHelp, Rotate3d } from "lucide-react";
import { usePerfilCognitivo } from "@/hooks/use-perfil-cognitivo";
import type { BrainRegion } from "./Brain3D";

const Brain3D = lazy(() => import("./Brain3D"));

/* ============================================================
 * Mapa de estimulação cerebral (3D interativo)
 * Agrupa os domínios/habilidades em regiões funcionais e mostra,
 * ao passar o mouse sobre a área no cérebro 3D, quais habilidades
 * estão em déficit e quais estão sendo estimuladas.
 * ============================================================ */

type RegionStatus = BrainRegion["status"];

type RegionDef = {
  key: string;
  nome: string;
  dir: [number, number, number];
  resp: string;
  match: RegExp;
};

// Direção da região sobre o cérebro (frente = +z, direita = +x, cima = +y)
const REGIONS: RegionDef[] = [
  {
    key: "executivo",
    nome: "Córtex pré-frontal — Funções executivas & atenção",
    dir: [0.35, 0.5, 0.85],
    resp: "Planejamento, atenção sustentada, memória de trabalho, controle inibitório, organização e tomada de decisão.",
    match: /execut|aten|inib|planej|autonom|metacogn|organiz|comportament/i,
  },
  {
    key: "socioemocional",
    nome: "Córtex órbito-frontal & sistema límbico — Socioemocional",
    dir: [-0.4, -0.2, 0.9],
    resp: "Regulação emocional, empatia, cognição social, comportamento adaptativo e motivação.",
    match: /socioemoc|social|adapt|emocion|afet|tea\b|autis/i,
  },
  {
    key: "linguagem",
    nome: "Lobo temporal — Linguagem & leitura",
    dir: [0.95, -0.25, 0.15],
    resp: "Compreensão e produção da linguagem, consciência fonológica, leitura e nomeação.",
    match: /linguag|fonolog|leitura|alfabet|escuta|fala|texto|compreens|nomea|produ/i,
  },
  {
    key: "memoria",
    nome: "Hipocampo & lobo temporal medial — Memória",
    dir: [0.6, -0.35, -0.2],
    resp: "Aquisição, consolidação e evocação de informações; base da aprendizagem.",
    match: /mem[óo]r|aprendiz|reten/i,
  },
  {
    key: "raciocinio",
    nome: "Lobo parietal — Matemática & motricidade",
    dir: [0.25, 0.7, -0.4],
    resp: "Raciocínio lógico-matemático, processamento visuoespacial, coordenação e motricidade.",
    match: /matem|c[áa]lculo|motric|coorden|escrit|espac|viso|racioc/i,
  },
  {
    key: "escolar",
    nome: "Lobo occipital & integração — Desempenho escolar",
    dir: [-0.15, 0.2, -0.95],
    resp: "Processamento visual e integração das funções no desempenho escolar e desenvolvimento global.",
    match: /escolar|global|desenvolv|rastreio|sintoma|tdah|ah\/sd|desempenho/i,
  },
];

const STATUS_META: Record<
  RegionStatus,
  { label: string; dot: string; ring: string; text: string; Icon: typeof Brain }
> = {
  estimulacao: {
    label: "Em estímulo",
    dot: "#8b5cf6",
    ring: "rgba(139,92,246,0.28)",
    text: "text-violet-700 dark:text-violet-300",
    Icon: Sparkles,
  },
  deficit: {
    label: "Em déficit",
    dot: "#f43f5e",
    ring: "rgba(244,63,94,0.26)",
    text: "text-rose-700 dark:text-rose-300",
    Icon: TrendingDown,
  },
  estavel: {
    label: "Estável",
    dot: "#10b981",
    ring: "rgba(16,185,129,0.24)",
    text: "text-emerald-700 dark:text-emerald-300",
    Icon: ShieldCheck,
  },
  sem_dados: {
    label: "Sem dados",
    dot: "#cbd5e1",
    ring: "rgba(148,163,184,0.18)",
    text: "text-muted-foreground",
    Icon: CircleHelp,
  },
};

function regionKeyOf(texto: string): string | null {
  for (const r of REGIONS) if (r.match.test(texto)) return r.key;
  return null;
}

function uniq(arr: string[], max = 8): string[] {
  return Array.from(new Set(arr.filter(Boolean))).slice(0, max);
}

export function BrainStateCard({ pacienteId }: { pacienteId: string }) {
  const { metricas, radarData, isLoading } = usePerfilCognitivo(pacienteId);
  const [mounted, setMounted] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  // Habilidades trabalhadas nas sessões (em estímulo) + domínios de metas ativas
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
        const lista = Array.isArray((s as any).habilidades_trabalhadas)
          ? (s as any).habilidades_trabalhadas
          : [];
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
          .map((m: any) => m.dominio || m.titulo_smart)
          .filter(Boolean);
      }
      return { habs, metasDominios };
    },
  });

  const regioes = useMemo<BrainRegion[]>(() => {
    const acc: Record<
      string,
      { deficit: string[]; estimulo: string[]; percentis: number[] }
    > = {};
    for (const r of REGIONS) acc[r.key] = { deficit: [], estimulo: [], percentis: [] };

    // Déficit: habilidades/variáveis com percentil baixo
    for (const m of metricas) {
      const k = regionKeyOf(m.dominio) ?? regionKeyOf(m.variavelLabel);
      if (!k) continue;
      if (m.percentil != null) acc[k].percentis.push(m.percentil);
      if (m.percentil != null && m.percentil < 25) {
        const label =
          m.variavelLabel && !/total/i.test(m.variavelLabel) ? m.variavelLabel : m.dominio;
        acc[k].deficit.push(label);
      }
    }
    // Média por região (todos os domínios do radar)
    for (const d of radarData) {
      const k = regionKeyOf(d.dominio);
      if (k && d.percentil != null) acc[k].percentis.push(d.percentil);
    }
    // Estímulo: habilidades das sessões + domínios de metas
    for (const nome of estimulos?.habs ?? []) {
      const k = regionKeyOf(nome);
      if (k) acc[k].estimulo.push(nome);
    }
    for (const dom of estimulos?.metasDominios ?? []) {
      const k = regionKeyOf(dom);
      if (k) acc[k].estimulo.push(dom);
    }

    return REGIONS.map((r) => {
      const a = acc[r.key];
      const media =
        a.percentis.length > 0
          ? Math.round(a.percentis.reduce((x, y) => x + y, 0) / a.percentis.length)
          : null;
      const deficit = uniq(a.deficit);
      const estimulo = uniq(a.estimulo);
      let status: RegionStatus;
      if (estimulo.length > 0) status = "estimulacao";
      else if (deficit.length > 0 || (media != null && media < 25)) status = "deficit";
      else if (media != null) status = "estavel";
      else status = "sem_dados";
      return { key: r.key, nome: r.nome, dir: r.dir, resp: r.resp, status, deficit, estimulo, media };
    });
  }, [metricas, radarData, estimulos]);

  const comDados = regioes.filter((r) => r.status !== "sem_dados");
  const resumo = {
    estimulacao: regioes.filter((r) => r.status === "estimulacao").length,
    deficit: regioes.filter((r) => r.status === "deficit").length,
    estavel: regioes.filter((r) => r.status === "estavel").length,
  };

  // Região em foco (hover no cérebro ou na lista); padrão = 1ª com dados
  const focus = regioes.find((r) => r.key === hoverKey) ?? comDados[0] ?? null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-stretch lg:gap-6">
        {/* Cabeçalho + cérebro 3D */}
        <div className="lg:w-[340px] lg:shrink-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-lilac text-lilac-foreground">
              <Brain className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Mapa de estimulação</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Cérebro 3D · domínios por região</p>
            </div>
            <span className="hidden items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
              <Rotate3d className="h-3 w-3" /> arraste p/ girar
            </span>
          </div>

          <div className="relative h-[280px] overflow-hidden rounded-2xl bg-gradient-to-br from-lilac-soft/40 via-card to-brand/5">
            {mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Carregando cérebro 3D…
                  </div>
                }
              >
                <Brain3D regioes={regioes} hover={hoverKey} onHover={setHoverKey} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Brain className="h-16 w-16 text-lilac/40" />
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {(["estimulacao", "deficit", "estavel", "sem_dados"] as RegionStatus[]).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_META[s].dot }} />
                {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>

        {/* Lista de regiões */}
        <div className="min-w-0 flex-1">
          {!isLoading && comDados.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center">
              <Brain className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Sem mapeamento cognitivo ainda</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Registre testes na aba <strong>Avaliação</strong> e habilidades nas{" "}
                <strong>Sessões</strong> para ver as áreas em estímulo e em déficit.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              {/* Card glass com a área em foco */}
              {focus && <RegionDetail region={focus} isHover={!!hoverKey} />}

              <div className="grid grid-cols-3 gap-2">
                <MiniStat status="estimulacao" value={resumo.estimulacao} label="em estímulo" />
                <MiniStat status="deficit" value={resumo.deficit} label="em déficit" />
                <MiniStat status="estavel" value={resumo.estavel} label="estáveis" />
              </div>

              {/* Seletor de áreas (hover atualiza o card acima) */}
              <div className="grid gap-2 sm:grid-cols-2">
                {regioes
                  .filter((r) => r.status !== "sem_dados")
                  .sort((a, b) => {
                    const order: RegionStatus[] = ["estimulacao", "deficit", "estavel", "sem_dados"];
                    return order.indexOf(a.status) - order.indexOf(b.status);
                  })
                  .map((r) => {
                    const meta = STATUS_META[r.status];
                    const Icon = meta.Icon;
                    const ativo = focus?.key === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onMouseEnter={() => setHoverKey(r.key)}
                        onMouseLeave={() => setHoverKey(null)}
                        onFocus={() => setHoverKey(r.key)}
                        onClick={() => setHoverKey(r.key)}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                          ativo
                            ? "border-brand/40 bg-brand/5 shadow-sm"
                            : "border-border/60 bg-card/60 hover:border-border"
                        }`}
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: meta.ring }}
                        >
                          <Icon className={`h-4 w-4 ${meta.text}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{r.nome.split("—").pop()?.trim()}</p>
                          <p className={`text-[11px] font-medium ${meta.text}`}>
                            {meta.label}
                            {r.media != null && (
                              <span className="text-muted-foreground"> · perc. {r.media}</span>
                            )}
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

function RegionDetail({ region, isHover }: { region: BrainRegion; isHover: boolean }) {
  const meta = STATUS_META[region.status];
  const Icon = meta.Icon;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: meta.ring }}
        >
          <Icon className={`h-5 w-5 ${meta.text}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{region.nome}</p>
          <p className={`mt-0.5 text-[11px] font-medium ${meta.text}`}>
            {meta.label}
            {region.media != null && (
              <span className="text-muted-foreground"> · percentil médio {region.media}</span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{region.resp}</p>

      {(region.deficit.length > 0 || region.estimulo.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              Em déficit
            </p>
            {region.deficit.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {region.deficit.slice(0, 6).map((d, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-700 dark:text-rose-300"
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
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
              Em estímulo
            </p>
            {region.estimulo.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {region.estimulo.slice(0, 6).map((d, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 dark:text-violet-300"
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

function MiniStat({ status, value, label }: { status: RegionStatus; value: number; label: string }) {
  const meta = STATUS_META[status];
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-2.5 text-center">
      <p className="text-xl font-semibold" style={{ color: meta.dot }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
