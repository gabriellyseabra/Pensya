import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, AlertTriangle, Activity, Target, FileText, School, RotateCcw, Home, XCircle, Clock } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PerfilVivoSummary } from "./PerfilVivoSummary";
import { TimelineUnificada } from "./TimelineUnificada";


function KPI({ icon, label, value, hint, tone = "default" }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone?: "default" | "warn" | "ok" }) {
  const chipCls =
    tone === "warn"
      ? "bg-amber-500/15 text-amber-600"
      : tone === "ok"
        ? "bg-emerald-500/15 text-emerald-600"
        : "bg-lilac-soft/50 text-lilac-foreground";
  return (
    <Card className="card-lift p-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${chipCls}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-xl font-semibold">{value}</p>
          </div>
        </div>
        {hint && <p className="mt-2.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lilac-soft/50 text-lilac-foreground">
        {icon}
      </span>
      {children}
    </CardTitle>
  );
}

export function ResumoTab({ pacienteId }: { pacienteId: string }) {
  const { data } = useQuery({
    queryKey: ["paciente-resumo", pacienteId],
    queryFn: async () => {
      const desde = new Date(); desde.setDate(desde.getDate() - 90);
      const [freq, prox, ult, plano, sessoes, freqPend, reunEscola, orientacao] = await Promise.all([
        supabase.from("frequencia").select("id, tipo, reposto_em, data_referencia").eq("paciente_id", pacienteId).gte("data_referencia", desde.toISOString().slice(0, 10)),
        supabase.from("atendimentos").select("id, inicio, profissional:profissionais_consultorio(nome), modalidade:modalidades(nome)").eq("paciente_id", pacienteId).gte("inicio", new Date().toISOString()).order("inicio").limit(1).maybeSingle(),
        supabase.from("atendimentos").select("inicio").eq("paciente_id", pacienteId).lte("inicio", new Date().toISOString()).order("inicio", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("planos_terapeuticos").select("id, titulo, status, data_inicio, data_revisao_prevista, objetivo_participacao").eq("paciente_id", pacienteId).eq("status", "ativo").order("data_inicio", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("prontuario_sessoes").select("id, data_sessao").eq("paciente_id", pacienteId).order("data_sessao", { ascending: false }).limit(5),
        supabase.from("frequencia").select("id, tipo, data_referencia, reposto_em").eq("paciente_id", pacienteId).is("reposto_em", null),
        supabase.from("reunioes").select("id, tipo, data_reuniao").eq("paciente_id", pacienteId).ilike("tipo", "%escola%").order("data_reuniao", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("prontuario_sessoes").select("id, data_sessao, orientacao_texto, orientacao_status").eq("paciente_id", pacienteId).eq("orientacao_casa", true).order("data_sessao", { ascending: false }).limit(1).maybeSingle(),
      ]);

      let metasAtivas: any[] = [];
      if (plano.data?.id) {
        const m = await supabase.from("plano_metas").select("id, titulo_smart, dominio").eq("plano_id", plano.data.id);
        metasAtivas = m.data ?? [];
      }
      // Reposição pendente só para falta JUSTIFICADA (não reposta).
      const reposPendentes = (freqPend.data ?? []).filter(
        (f: any) => f.tipo === "falta_justificada",
      );
      return {
        freq: freq.data ?? [],
        prox: prox.data,
        ult: ult.data,
        plano: plano.data,
        sessoes: sessoes.data ?? [],
        metas: metasAtivas,
        reposPendentes,
        ultReunEscola: reunEscola.data,
        orientacao: orientacao.data,
      };
    },
  });

  const qc = useQueryClient();
  const atualizarOrientacao = useMutation({
    mutationFn: async (status: "feita" | "nao_feita" | "pendente") => {
      if (!data?.orientacao?.id) return;
      const { error } = await supabase.from("prontuario_sessoes").update({
        orientacao_status: status,
        orientacao_atualizado_em: new Date().toISOString(),
      }).eq("id", data.orientacao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orientação de casa atualizada");
      qc.invalidateQueries({ queryKey: ["paciente-resumo", pacienteId] });
      qc.invalidateQueries({ queryKey: ["prontuario-sessoes", pacienteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.freq.length ?? 0;
  const presentes = data?.freq.filter((f: any) => {
    const t = (f.tipo ?? "").toLowerCase();
    return t.includes("presen") || t === "ok";
  }).length ?? 0;
  const faltas = data?.freq.filter((f: any) => {
    const t = (f.tipo ?? "").toLowerCase();
    return t.includes("falta") || t.includes("ausen");
  }).length ?? 0;
  const pct = total > 0 ? Math.round((presentes / total) * 100) : null;

  const proxData = data?.prox?.inicio ? parseISO(data.prox.inicio) : null;
  const ultData = data?.ult?.inicio ? parseISO(data.ult.inicio) : null;
  const diasDesdeUlt = ultData ? differenceInDays(new Date(), ultData) : null;

  // Alertas
  const nReposPend = data?.reposPendentes.length ?? 0;
  const diasDesdeReunEscola = data?.ultReunEscola?.data_reuniao
    ? differenceInDays(new Date(), parseISO(data.ultReunEscola.data_reuniao))
    : null;
  const alertaEscola = diasDesdeReunEscola != null && diasDesdeReunEscola >= 90;
  const escolaNunca = data?.ultReunEscola == null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={<Calendar className="w-5 h-5" />}
          label="Próximo atendimento"
          value={proxData ? format(proxData, "dd/MM HH:mm", { locale: ptBR }) : "—"}
          hint={data?.prox ? `${data.prox.profissional?.nome ?? ""} · ${data.prox.modalidade?.nome ?? ""}` : "Sem agendamento"}
        />
        <KPI
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Frequência (90d)"
          value={pct != null ? `${pct}%` : "—"}
          hint={total > 0 ? `${presentes}/${total} sessões · ${faltas} faltas` : "Sem registros"}
          tone={pct != null ? (pct >= 80 ? "ok" : pct >= 60 ? "default" : "warn") : "default"}
        />
        <KPI
          icon={<Activity className="w-5 h-5" />}
          label="Último atendimento"
          value={ultData ? format(ultData, "dd/MM/yyyy", { locale: ptBR }) : "—"}
          hint={diasDesdeUlt != null ? `há ${diasDesdeUlt} dias` : "Sem histórico"}
          tone={diasDesdeUlt != null && diasDesdeUlt > 21 ? "warn" : "default"}
        />
        <KPI
          icon={<Target className="w-5 h-5" />}
          label="Plano ativo"
          value={data?.plano ? data.metas.length + " metas" : "Sem plano"}
          hint={data?.plano?.titulo ?? "Crie um plano terapêutico"}
        />
      </div>

      {/* Alertas inteligentes */}
      {(nReposPend > 0 || alertaEscola || escolaNunca || (pct != null && pct < 60) || (diasDesdeUlt != null && diasDesdeUlt > 30)) && (
        <div className="grid gap-3 md:grid-cols-2">
          {nReposPend > 0 && (
            <AlertaCard
              tone="warn"
              icon={<RotateCcw className="w-4 h-4" />}
              titulo={`${nReposPend} reposição${nReposPend > 1 ? "ões" : ""} pendente${nReposPend > 1 ? "s" : ""}`}
              texto="Há faltas registradas sem reposição. Agende a reposição na agenda."
            />
          )}
          {(alertaEscola || escolaNunca) && (
            <AlertaCard
              tone="warn"
              icon={<School className="w-4 h-4" />}
              titulo={escolaNunca ? "Sem contato com a escola" : "Hora de retomar contato com a escola"}
              texto={
                escolaNunca
                  ? "Nenhuma reunião com a escola foi registrada. Recomenda-se contato a cada 3–4 meses."
                  : `Última reunião há ${diasDesdeReunEscola} dias. Recomenda-se reunião a cada 3–4 meses.`
              }
            />
          )}
          {pct != null && pct < 60 && (
            <AlertaCard tone="warn" icon={<AlertTriangle className="w-4 h-4" />} titulo="Frequência abaixo de 60%" texto="Considere conversar com a família sobre adesão." />
          )}
          {diasDesdeUlt != null && diasDesdeUlt > 30 && (
            <AlertaCard tone="warn" icon={<AlertTriangle className="w-4 h-4" />} titulo="Sem atendimento há mais de 30 dias" texto="Revisar status do paciente ou agendar retomada." />
          )}
        </div>
      )}

      {data?.orientacao && (
        <OrientacaoCasaCard
          orientacao={data.orientacao}
          onAtualizar={(status) => atualizarOrientacao.mutate(status)}
          atualizando={atualizarOrientacao.isPending}
        />
      )}

      <PerfilVivoSummary pacienteId={pacienteId} />

      <TimelineUnificada pacienteId={pacienteId} />

      {data?.plano && (
        <Card>
          <CardHeader>
            <SectionHeader icon={<Target className="h-4 w-4" />}>Plano terapêutico ativo</SectionHeader>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-medium">{data.plano.titulo}</p>
              <Badge variant="secondary">
                {data.plano.data_inicio ? format(parseISO(data.plano.data_inicio), "dd/MM/yyyy") : "—"}
                {data.plano.data_revisao_prevista ? " → revisão " + format(parseISO(data.plano.data_revisao_prevista), "dd/MM/yyyy") : ""}
              </Badge>
            </div>
            {data.plano.objetivo_participacao && (
              <p className="text-sm text-muted-foreground italic">"{data.plano.objetivo_participacao}"</p>
            )}
            <div className="space-y-1">
              {data.metas.slice(0, 5).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-sm rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                  <span className="truncate">{m.titulo_smart}</span>
                  {m.dominio && <Badge variant="outline" className="shrink-0">{m.dominio}</Badge>}
                </div>
              ))}
              {data.metas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <SectionHeader icon={<FileText className="h-4 w-4" />}>Últimas sessões registradas</SectionHeader>
        </CardHeader>
        <CardContent>
          {data?.sessoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>}
          <div className="space-y-2">
            {data?.sessoes.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
                <span>{s.data_sessao ? format(parseISO(s.data_sessao), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                <Badge variant="outline">Sessão</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrientacaoCasaCard({
  orientacao, onAtualizar, atualizando,
}: {
  orientacao: { data_sessao: string; orientacao_texto: string | null; orientacao_status: string | null };
  onAtualizar: (status: "feita" | "nao_feita" | "pendente") => void;
  atualizando: boolean;
}) {
  const status = orientacao.orientacao_status ?? "pendente";
  const tone = status === "feita" ? "ok" : status === "nao_feita" ? "danger" : "warn";
  const cls = tone === "ok"
    ? "border-emerald-500/40"
    : tone === "danger"
      ? "border-rose-500/40"
      : "border-amber-500/40";
  const Icon = status === "feita" ? CheckCircle2 : status === "nao_feita" ? XCircle : Clock;
  const iconCls = status === "feita" ? "text-emerald-600" : status === "nao_feita" ? "text-rose-600" : "text-amber-600";

  return (
    <Card className={cls}>
      <CardContent className="pt-4 flex items-start gap-3">
        <Home className="w-4 h-4 text-brand mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">Orientação de casa</p>
            <Badge variant="outline" className={`gap-1 ${iconCls}`}>
              <Icon className="w-3 h-3" />
              {status === "feita" ? "Feita" : status === "nao_feita" ? "Não feita" : "Pendente"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              registrada em {format(parseISO(orientacao.data_sessao), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          {orientacao.orientacao_texto && (
            <p className="text-sm text-muted-foreground mt-1">{orientacao.orientacao_texto}</p>
          )}
          <div className="flex gap-2 mt-2">
            {status === "pendente" ? (
              <>
                <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-600 hover:bg-emerald-50" disabled={atualizando} onClick={() => onAtualizar("feita")}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Foi feita
                </Button>
                <Button size="sm" variant="outline" className="text-rose-700 border-rose-600 hover:bg-rose-50" disabled={atualizando} onClick={() => onAtualizar("nao_feita")}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Não foi feita
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="text-xs" disabled={atualizando} onClick={() => onAtualizar("pendente")}>
                Reabrir
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertaCard({ icon, titulo, texto, tone }: { icon: React.ReactNode; titulo: string; texto: string; tone: "warn" | "info" }) {
  const cls = tone === "warn" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-sky-500/40 text-sky-700 dark:text-sky-400";
  return (
    <Card className={cls.split(" ")[0]}>
      <CardContent className="pt-4 flex items-start gap-3">
        <div className={cls.split(" ").slice(1).join(" ")}>{icon}</div>
        <div className="min-w-0">
          <p className="font-medium text-sm">{titulo}</p>
          <p className="text-xs text-muted-foreground">{texto}</p>
        </div>
      </CardContent>
    </Card>
  );
}
