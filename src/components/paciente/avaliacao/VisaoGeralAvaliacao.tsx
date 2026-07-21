import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, GraduationCap, UserCog, ArrowRight, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAnamnese } from "@/hooks/use-anamnese";
import { usePerfilCognitivo, classifPercentil } from "@/hooks/use-perfil-cognitivo";
import { useReunioesResumo } from "@/hooks/use-reunioes-resumo";
import { MapaDominiosAnamnese } from "@/components/paciente/anamnese/MapaDominiosAnamnese";

type Props = {
  pacienteId: string;
  onNavigateToStep?: (stepIndex: number) => void;
  onNavigateToTab?: (tab: string, subTab?: string) => void;
};

/**
 * Primeiro passo do wizard de Avaliação: consolida, em modo leitura, o que já
 * foi coletado em anamnese, mapa cognitivo e reuniões — para evitar que a
 * profissional precise abrir cada aba separadamente para montar o panorama.
 */
export function VisaoGeralAvaliacao({ pacienteId, onNavigateToStep, onNavigateToTab }: Props) {
  const { anamnese, isLoading: carregandoAnamnese } = useAnamnese(pacienteId);
  const { porDominio, isLoading: carregandoCognitivo } = usePerfilCognitivo(pacienteId);
  const reunioes = useReunioesResumo(pacienteId);

  const radarScores = (anamnese.radar_scores ?? {}) as Record<string, number>;
  const temRadar = Object.keys(radarScores).length > 0;

  return (
    <div className="space-y-4">
      {!carregandoAnamnese && !temRadar && (
        <Card className="glass border-dashed">
          <CardContent className="pt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Ainda não há radar de domínios gerado na Anamnese.
            </p>
            <Button size="sm" variant="secondary" onClick={() => onNavigateToStep?.(1)}>
              <Sparkles className="w-4 h-4 mr-2" />Gerar radar na Anamnese
            </Button>
          </CardContent>
        </Card>
      )}

      {temRadar && <MapaDominiosAnamnese scores={radarScores} />}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2"><Brain className="w-4 h-4 text-brand" />Funcionamento cognitivo por domínio</span>
            <Button size="sm" variant="ghost" onClick={() => onNavigateToStep?.(2)}>
              Ver mapa completo <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoCognitivo && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!carregandoCognitivo && porDominio.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum teste com pontuação registrado ainda.
            </p>
          )}
          {porDominio.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {porDominio.map((d) => {
                const pcts = d.metricas.map((m) => m.percentil).filter((p): p is number => p != null);
                const media = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
                const c = classifPercentil(media);
                return (
                  <div key={d.nome} className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-1.5">
                    <p className="text-sm font-medium truncate">{d.nome}</p>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-semibold">{media != null ? `P${media}` : "—"}</span>
                      <Badge className={c.bg + " " + c.cor + " border-transparent text-[10px]"}>{c.label}</Badge>
                    </div>
                    <Progress value={media ?? 0} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <ReuniaoResumoCard
          icon={<GraduationCap className="w-4 h-4 text-brand" />}
          titulo="Última reunião com a escola"
          ultima={reunioes.ultimaEscola}
          dias={reunioes.diasDesdeEscola}
          alerta={reunioes.alertaEscola}
          onVerReunioes={() => onNavigateToTab?.("administrativo", "reunioes")}
        />
        <ReuniaoResumoCard
          icon={<UserCog className="w-4 h-4 text-brand" />}
          titulo="Última reunião com a equipe"
          ultima={reunioes.ultimaEquipe}
          dias={reunioes.diasDesdeEquipe}
          alerta={reunioes.alertaEquipe}
          onVerReunioes={() => onNavigateToTab?.("administrativo", "reunioes")}
        />
      </div>
    </div>
  );
}

function ReuniaoResumoCard({
  icon, titulo, ultima, dias, alerta, onVerReunioes,
}: {
  icon: React.ReactNode; titulo: string;
  ultima: { data_reuniao: string; decisoes?: string | null; ata?: string | null } | null;
  dias: number | null; alerta: boolean;
  onVerReunioes: () => void;
}) {
  const resumoTexto = ultima?.decisoes || ultima?.ata || null;
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">{icon}{titulo}</span>
          <Button size="sm" variant="ghost" onClick={onVerReunioes}>
            Ver Reuniões <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!ultima && (
          <p className="text-xs text-muted-foreground">Nenhuma reunião registrada ainda.</p>
        )}
        {ultima && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{format(parseISO(ultima.data_reuniao), "dd/MM/yyyy")}</span>
              {alerta && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                  {dias != null ? `há ${dias} dias` : "atenção"}
                </Badge>
              )}
            </div>
            {resumoTexto && <p className="text-xs text-foreground/80 line-clamp-2">{resumoTexto}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
