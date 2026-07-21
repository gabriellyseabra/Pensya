import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ClipboardList, MessageCircleHeart, Target, ArrowRight, FileBarChart } from "lucide-react";
import { usePortal, primeiroNome } from "@/components/portal/portal-context";
import {
  portalAgenda, portalMetas, portalPlano, portalSessoes,
  portalRelatoriosDisponiveis, relatorioVisto,
} from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/")({
  component: PortalInicio,
});

function PortalInicio() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;

  const { data: agenda } = useQuery({
    queryKey: ["portal-agenda", pid],
    queryFn: () => portalAgenda(pid),
  });
  const { data: sessoes } = useQuery({
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
  const { data: mesesRelatorio } = useQuery({
    queryKey: ["portal-relatorios-meses", pid],
    queryFn: () => portalRelatoriosDisponiveis(pid),
    staleTime: 10 * 60_000,
  });
  const ultimoRelatorio = mesesRelatorio?.[0] ?? null;
  const relatorioNovo = !!ultimoRelatorio && relatorioVisto(pid) !== ultimoRelatorio;

  const proximas = (agenda ?? []).slice(0, 3);
  const orientacoesPendentes = (sessoes ?? []).filter(
    (s) => s.orientacao_casa && s.orientacao_status === "pendente",
  ).slice(0, 3);
  const metasAtivas = (metas ?? []).filter((m) => m.status !== "concluida").slice(0, 4);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          Acompanhamento de {primeiroNome(paciente.nome)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a evolução, as orientações da equipe e os próximos atendimentos.
        </p>
      </div>

      {relatorioNovo && ultimoRelatorio && (
        <Link
          to="/portal/relatorios"
          className="glass flex items-center justify-between gap-3 rounded-2xl border border-brand-yellow/60 p-4 transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center gap-3">
            <FileBarChart className="h-7 w-7 text-brand" />
            <div>
              <p className="text-sm font-medium">Novo relatório mensal disponível</p>
              <p className="text-xs text-muted-foreground">
                Veja o resumo de {primeiroNome(paciente.nome)} — sessões, habilidades e progresso das metas.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-brand" /> Próximos atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {proximas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum atendimento agendado.</p>
          )}
          {proximas.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium capitalize">
                  {format(parseISO(a.inicio), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(a.inicio), "HH:mm")} – {format(parseISO(a.fim), "HH:mm")}
                  {a.profissional ? ` · ${a.profissional}` : ""}
                  {a.modalidade ? ` · ${a.modalidade}` : ""}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {orientacoesPendentes.length > 0 && (
        <Card className="glass border-brand-yellow/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-brand" /> Orientações para casa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {orientacoesPendentes.map((s) => (
              <div key={s.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Sessão de {format(parseISO(s.data_sessao), "dd/MM/yyyy")}
                </p>
                <p className="line-clamp-2 text-sm">{s.orientacao_texto}</p>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="mt-1">
              <Link to="/portal/evolucao">
                Ver e responder <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {(plano || metasAtivas.length > 0) && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-brand" /> Plano terapêutico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plano?.orientacoes_familia && (
              <div className="rounded-xl bg-accent/60 px-3 py-2">
                <p className="text-xs font-medium text-accent-foreground">Orientações para a família</p>
                <p className="whitespace-pre-wrap text-sm">{plano.orientacoes_familia}</p>
              </div>
            )}
            {metasAtivas.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-2">
                <p className="text-sm">{m.titulo}</p>
                <Badge variant="secondary" className="shrink-0 capitalize">{m.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <MessageCircleHeart className="h-8 w-8 text-brand-pink" />
            <div>
              <p className="text-sm font-medium">Como foi em casa esta semana?</p>
              <p className="text-xs text-muted-foreground">
                Registre observações e conquistas para a equipe acompanhar.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="gradient-brand text-brand-foreground">
            <Link to="/portal/diario">Registrar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
