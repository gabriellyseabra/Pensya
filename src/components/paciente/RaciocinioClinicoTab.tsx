import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { gerarRaciocinioClinico, criarPlanoDeRaciocinio } from "@/lib/raciocinio.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ArrowRight, Brain, Target, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Raciocinio = {
  sintese_diagnostica?: string;
  pontos_fortes?: string[];
  pontos_fragilidade?: string[];
  hipoteses_diagnosticas?: { hipotese: string; justificativa: string }[];
  fatores_contextuais?: { facilitadores?: string[]; barreiras?: string[] };
  prioridades_intervencao?: { ordem: number; area: string; racional: string }[];
  metas_sugeridas?: { titulo: string; dominio?: string; racional_clinico?: string }[];
  encaminhamentos?: string[];
  alertas?: string[];
};

export function RaciocinioClinicoTab({ pacienteId }: { pacienteId: string }) {
  const gerar = useServerFn(gerarRaciocinioClinico);
  const criar = useServerFn(criarPlanoDeRaciocinio);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [criando, setCriando] = useState(false);
  const [r, setR] = useState<Raciocinio | null>(null);

  async function run() {
    setLoading(true);
    try {
      const result = await gerar({ data: { paciente_id: pacienteId } });
      setR(result as Raciocinio);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar raciocínio");
    } finally { setLoading(false); }
  }

  async function criarPlano() {
    if (!r) return;
    setCriando(true);
    try {
      await criar({ data: { paciente_id: pacienteId, raciocinio: r } });
      qc.invalidateQueries({ queryKey: ["planos", pacienteId] });
      qc.invalidateQueries({ queryKey: ["paciente-resumo", pacienteId] });
      toast.success("Plano criado. Veja na aba Plano Terapêutico.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar plano");
    } finally { setCriando(false); }
  }


  return (
    <div className="space-y-4">
      <Card className="glass border-brand/30">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-brand" />Raciocínio Clínico Integrado
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">A IA conecta perfil cognitivo + anamnese + queixa para apoiar suas hipóteses e prioridades.</p>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando…</> : <><Sparkles className="w-4 h-4 mr-2" />{r ? "Regenerar" : "Gerar"}</>}
          </Button>
        </CardHeader>
        {r && (
          <CardContent className="space-y-5">
            {r.sintese_diagnostica && (
              <div className="rounded-lg bg-brand/5 border border-brand/20 p-4">
                <p className="text-sm font-medium mb-1">Síntese diagnóstica</p>
                <p className="text-sm">{r.sintese_diagnostica}</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {!!r.pontos_fortes?.length && (
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Pontos fortes</p>
                  <ul className="text-sm space-y-1">{r.pontos_fortes.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                </div>
              )}
              {!!r.pontos_fragilidade?.length && (
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-2">Fragilidades</p>
                  <ul className="text-sm space-y-1">{r.pontos_fragilidade.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                </div>
              )}
            </div>

            {!!r.hipoteses_diagnosticas?.length && (
              <div>
                <p className="text-sm font-medium mb-2">Hipóteses diagnósticas</p>
                <div className="space-y-2">
                  {r.hipoteses_diagnosticas.map((h, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-background/40 p-3">
                      <p className="text-sm font-medium">{h.hipotese}</p>
                      <p className="text-xs text-muted-foreground mt-1">{h.justificativa}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {r.fatores_contextuais && (
              <div className="grid gap-4 md:grid-cols-2">
                {!!r.fatores_contextuais.facilitadores?.length && (
                  <div>
                    <p className="text-sm font-medium mb-2">Facilitadores ambientais</p>
                    <ul className="text-sm space-y-1">{r.fatores_contextuais.facilitadores.map((p, i) => <li key={i}>+ {p}</li>)}</ul>
                  </div>
                )}
                {!!r.fatores_contextuais.barreiras?.length && (
                  <div>
                    <p className="text-sm font-medium mb-2">Barreiras ambientais</p>
                    <ul className="text-sm space-y-1">{r.fatores_contextuais.barreiras.map((p, i) => <li key={i}>– {p}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {!!r.prioridades_intervencao?.length && (
              <div>
                <p className="text-sm font-medium mb-2">Prioridades de intervenção</p>
                <div className="space-y-2">
                  {r.prioridades_intervencao.map((p, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                      <Badge variant="secondary" className="shrink-0 h-6">{p.ordem}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.area}</p>
                        <p className="text-xs text-muted-foreground">{p.racional}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!r.metas_sugeridas?.length && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2"><Target className="w-4 h-4 text-brand" />Metas funcionais sugeridas</p>
                <div className="space-y-2">
                  {r.metas_sugeridas.map((m, i) => (
                    <div key={i} className="rounded-lg border border-border/50 bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{m.titulo}</p>
                        {m.dominio && <Badge variant="outline" className="shrink-0">{m.dominio}</Badge>}
                      </div>
                      {m.racional_clinico && <p className="text-xs text-muted-foreground mt-1">{m.racional_clinico}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!r.encaminhamentos?.length && (
              <div>
                <p className="text-sm font-medium mb-2">Encaminhamentos sugeridos</p>
                <ul className="text-sm space-y-1 text-muted-foreground">{r.encaminhamentos.map((e, i) => <li key={i}>• {e}</li>)}</ul>
              </div>
            )}

            {!!r.alertas?.length && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-medium flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-600" />Alertas</p>
                <ul className="text-sm space-y-1">{r.alertas.map((a, i) => <li key={i}>• {a}</li>)}</ul>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button onClick={criarPlano} disabled={criando}>
                {criando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando…</> : <>Criar plano a partir deste raciocínio<ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
