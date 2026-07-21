import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ListChecks, Wrench, CalendarClock, AlertTriangle, Gauge, ExternalLink, CheckCircle2, Circle, Loader2, Workflow,
} from "lucide-react";
import type { ConteudoProcesso } from "@/components/processos/types";
import { progressoProcesso, RESP_PASSO } from "@/components/processos/types";
import { FluxogramaEditor } from "@/components/processos/FluxogramaEditor";

export const Route = createFileRoute("/processo-publico/$token")({
  ssr: false,
  component: ProcessoPublicoPage,
});

type Pub = {
  id: string; titulo: string; emoji: string | null; objetivo: string | null;
  categoria: string | null; frequencia: string | null; status: string;
  conteudo: ConteudoProcesso; departamento_nome: string | null; departamento_cor: string | null;
  atualizado_em: string;
};

function ProcessoPublicoPage() {
  const { token } = Route.useParams();
  const [proc, setProc] = useState<Pub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("processo_publico_get", { _token: token });
      if (error) console.error(error);
      setProc((((data ?? []) as any[])[0] ?? null) as Pub | null);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando…</div>;
  }
  if (!proc) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass-strong p-8 max-w-md text-center">
          <h1 className="text-2xl font-display mb-2">Processo indisponível</h1>
          <p className="text-muted-foreground">Este link não é válido ou o processo não está mais público.</p>
        </Card>
      </div>
    );
  }

  const c = proc.conteudo ?? {};
  const prog = progressoProcesso(c);

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="glass-strong">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {proc.emoji && <span className="text-3xl leading-none">{proc.emoji}</span>}
              <div className="flex-1">
                <h1 className="text-2xl font-display">{proc.titulo}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {proc.departamento_nome && <Badge style={{ backgroundColor: `${proc.departamento_cor}22`, color: proc.departamento_cor ?? undefined }}>{proc.departamento_nome}</Badge>}
                  {proc.categoria && <Badge variant="outline">{proc.categoria}</Badge>}
                  {proc.frequencia && <Badge variant="secondary">{proc.frequencia}</Badge>}
                </div>
              </div>
            </div>
            {proc.objetivo && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{proc.objetivo}</p>}
            {prog.total > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progresso</span><span>{prog.pct}%</span></div>
                <Progress value={prog.pct} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {(c.fluxograma?.nodes ?? []).length > 0 && (
          <Secao titulo="Fluxograma" icon={<Workflow className="w-4 h-4 text-brand" />}>
            <FluxogramaEditor fluxograma={c.fluxograma} readOnly />
          </Secao>
        )}

        {(c.atividades ?? []).length > 0 && (
          <Secao titulo="Passo a passo" icon={<ListChecks className="w-4 h-4 text-brand" />}>
            {temResp(c) && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mb-3">
                {RESP_PASSO.map((r) => (
                  <span key={r.value} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.cor }} />{r.label}</span>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {c.atividades!.map((a) => {
                const ra = RESP_PASSO.find((r) => r.value === a.resp);
                return (
                <div key={a.id}>
                  {a.titulo && (
                    <p className={`font-medium text-sm mb-1 flex items-center gap-1.5 ${a.gargalo ? "text-amber-700 dark:text-amber-400" : ""}`}>
                      {ra && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ra.cor }} />}
                      {a.gargalo && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}{a.titulo}
                    </p>
                  )}
                  {a.gargalo && a.obs && <p className="text-xs text-amber-700/80 mb-1 pl-1">⚠ {a.obs}</p>}
                  <ul className="space-y-1">
                    {(a.itens ?? []).map((it) => {
                      const ri = RESP_PASSO.find((r) => r.value === it.resp);
                      return (
                      <li key={it.id} className={`text-sm ${it.gargalo ? "bg-amber-100/50 dark:bg-amber-500/10 rounded px-1" : ""}`}>
                        <span className="flex items-center gap-2">
                          {it.feito ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          {ri && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ri.cor }} title={ri.label} />}
                          <span className={`${it.feito ? "line-through text-muted-foreground" : ""} ${it.gargalo ? "text-amber-800 dark:text-amber-300 font-medium" : ""}`}>{it.texto}</span>
                          {it.gargalo && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
                        </span>
                        {it.gargalo && it.obs && <span className="block text-xs text-amber-700/80 pl-5">⚠ {it.obs}</span>}
                      </li>
                    );})}
                  </ul>
                </div>
              );})}
            </div>
          </Secao>
        )}

        {(c.recursos ?? []).length > 0 && (
          <Secao titulo="Recursos" icon={<Wrench className="w-4 h-4 text-brand" />}>
            <div className="space-y-1.5">
              {c.recursos!.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /><span>{r.nome || r.url}</span>
                  <Badge variant="outline" className="text-[10px]">{r.tipo}</Badge>
                </a>
              ))}
            </div>
          </Secao>
        )}

        {(c.rotinas ?? []).length > 0 && (
          <Secao titulo="Rotinas e prazos" icon={<CalendarClock className="w-4 h-4 text-brand" />}>
            <ul className="list-disc pl-5 space-y-1 text-sm">{c.rotinas!.map((r) => <li key={r.id}>{r.texto}</li>)}</ul>
          </Secao>
        )}

        {(c.riscos ?? []).length > 0 && (
          <Secao titulo="Riscos e contingências" icon={<AlertTriangle className="w-4 h-4 text-brand" />}>
            <div className="space-y-2">
              {c.riscos!.map((r) => (
                <div key={r.id} className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">{r.ponto_critico}</p>
                  <p>{r.acao}</p>
                </div>
              ))}
            </div>
          </Secao>
        )}

        {(c.acoes ?? []).length > 0 && (
          <Secao titulo="Ações em caso de desvio" icon={<AlertTriangle className="w-4 h-4 text-brand" />}>
            <ul className="list-disc pl-5 space-y-1 text-sm">{c.acoes!.map((r) => <li key={r.id}>{r.texto}</li>)}</ul>
          </Secao>
        )}

        {(c.metricas ?? []).length > 0 && (
          <Secao titulo="Métricas e indicadores" icon={<Gauge className="w-4 h-4 text-brand" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {c.metricas!.map((m) => (
                <div key={m.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{m.indicador}</p>
                  {(m.valor_atual || m.unidade) && <p className="text-2xl font-semibold mt-1">{m.valor_atual} <span className="text-sm text-muted-foreground">{m.unidade}</span></p>}
                  {m.objetivo && <p className="text-xs text-muted-foreground mt-1">{m.objetivo}</p>}
                </div>
              ))}
            </div>
          </Secao>
        )}

        <p className="text-center text-[11px] text-muted-foreground pt-2">Documento de processo — somente leitura.</p>
      </div>
    </div>
  );
}

function temResp(c: ConteudoProcesso) {
  return (c.atividades ?? []).some((a) => a.resp || (a.itens ?? []).some((i) => i.resp));
}

function Secao({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{titulo}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
