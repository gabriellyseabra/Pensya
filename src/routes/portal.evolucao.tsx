import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Sparkles, Target } from "lucide-react";
import { usePortal } from "@/components/portal/portal-context";
import {
  habilidadesLabels, portalMetas, portalOrientacaoFeedback, portalPlano, portalSessoes,
} from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/evolucao")({
  component: PortalEvolucao,
});

const META_STATUS: Record<string, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pausada: "Pausada",
  rascunho: "Planejada",
};

function PortalEvolucao() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;
  const qc = useQueryClient();

  const { data: sessoes, isLoading } = useQuery({
    queryKey: ["portal-sessoes", pid],
    queryFn: () => portalSessoes(pid),
  });
  const { data: plano } = useQuery({
    queryKey: ["portal-plano", pid],
    queryFn: () => portalPlano(pid),
  });
  const { data: metas } = useQuery({
    queryKey: ["portal-metas", pid],
    queryFn: () => portalMetas(pid),
  });

  const feedback = useMutation({
    mutationFn: ({ sessaoId, status }: { sessaoId: string; status: "feita" | "nao_feita" }) =>
      portalOrientacaoFeedback(sessaoId, status),
    onSuccess: () => {
      toast.success("Obrigado! A equipe foi informada.");
      qc.invalidateQueries({ queryKey: ["portal-sessoes", pid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Evolução</h1>
        <p className="text-sm text-muted-foreground">
          Linha do tempo das sessões, habilidades trabalhadas e orientações para casa.
        </p>
      </div>

      {(plano || (metas ?? []).length > 0) && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-brand" /> Metas do plano atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plano && (
              <p className="text-xs text-muted-foreground">
                {plano.titulo}
                {plano.data_inicio ? ` · desde ${format(parseISO(plano.data_inicio), "MM/yyyy")}` : ""}
                {plano.frequencia_sessoes ? ` · ${plano.frequencia_sessoes}` : ""}
              </p>
            )}
            {(metas ?? []).map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                <div>
                  <p className="text-sm">{m.titulo}</p>
                  {m.dominio && <p className="text-xs text-muted-foreground">{m.dominio}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {META_STATUS[m.status] ?? m.status}
                </Badge>
              </div>
            ))}
            {(metas ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada no plano atual.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando sessões…</p>}
        {!isLoading && (sessoes ?? []).length === 0 && (
          <Card className="glass">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Ainda não há sessões registradas.
            </CardContent>
          </Card>
        )}
        {(sessoes ?? []).map((s) => {
          const habilidades = habilidadesLabels(s.habilidades_trabalhadas);
          return (
            <Card key={s.id} className="glass">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize">
                    {format(parseISO(s.data_sessao), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <Badge variant="outline" className="capitalize">{s.tipo}</Badge>
                </div>

                {habilidades.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Habilidades trabalhadas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {habilidades.map((h) => (
                        <Badge key={h} variant="secondary" className="font-normal">{h}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {s.orientacao_casa && s.orientacao_texto && (
                  <div className="rounded-xl bg-accent/60 p-3">
                    <p className="text-xs font-medium text-accent-foreground">Orientação para casa</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{s.orientacao_texto}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {s.orientacao_status === "feita" && (
                        <Badge className="bg-brand text-brand-foreground">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Feita
                        </Badge>
                      )}
                      {s.orientacao_status === "nao_feita" && (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" /> Não conseguimos
                        </Badge>
                      )}
                      {s.orientacao_status === "pendente" ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={feedback.isPending}
                            onClick={() => feedback.mutate({ sessaoId: s.id, status: "feita" })}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Fizemos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={feedback.isPending}
                            onClick={() => feedback.mutate({ sessaoId: s.id, status: "nao_feita" })}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Não conseguimos
                          </Button>
                        </>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => feedback.mutate({ sessaoId: s.id, status: s.orientacao_status === "feita" ? "nao_feita" : "feita" })}
                        >
                          alterar resposta
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
