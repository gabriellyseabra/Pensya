import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarCheck, ClipboardList, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortal, primeiroNome } from "@/components/portal/portal-context";
import { marcarRelatorioVisto, type RelatorioMensal } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/relatorios")({
  component: PortalRelatorios,
});

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function labelCompetencia(c: string) {
  const [ano, mes] = c.split("-").map((n) => parseInt(n, 10));
  return `${MESES[mes - 1]} de ${ano}`;
}

const GAS_CHIP: Record<number, { label: string; cls: string }> = {
  [-2]: { label: "−2", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  [-1]: { label: "−1", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  [0]: { label: "0 · meta", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  [1]: { label: "+1", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  [2]: { label: "+2", cls: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
};

const FREQ_LABEL: Record<string, string> = {
  presente: "Presenças",
  reposicao: "Reposições",
  falta_justificada: "Faltas justificadas",
  falta_nao_justificada: "Faltas não justificadas",
  cancelado_profissional: "Cancelados pela clínica",
};

function PortalRelatorios() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;

  const { data: meses } = useQuery({
    queryKey: ["portal-relatorios-meses", pid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("portal_relatorios_disponiveis", { _paciente_id: pid });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.competencia);
    },
  });

  const [competencia, setCompetencia] = useState<string | null>(null);
  const atual = competencia ?? meses?.[0] ?? null;

  useEffect(() => {
    if (meses?.[0]) marcarRelatorioVisto(pid, meses[0]);
  }, [meses, pid]);

  const { data: rel, isLoading } = useQuery({
    enabled: !!atual,
    queryKey: ["portal-relatorio", pid, atual],
    queryFn: async () => {
      const [ano, mes] = atual!.split("-").map((n) => parseInt(n, 10));
      const { data, error } = await supabase.rpc("portal_relatorio_mensal", {
        _paciente_id: pid, _ano: ano, _mes: mes,
      });
      if (error) throw new Error(error.message);
      return data as unknown as RelatorioMensal;
    },
  });

  const mesAtualSistema = new Date().toISOString().slice(0, 7);
  const orient = rel?.orientacoes;
  const freq = rel?.frequencia ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Relatório mensal</h1>
          <p className="text-sm text-muted-foreground">
            Resumo do mês de {primeiroNome(paciente.nome)} na clínica.
          </p>
        </div>
        {(meses ?? []).length > 0 && (
          <Select value={atual ?? undefined} onValueChange={setCompetencia}>
            <SelectTrigger className="w-52 capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(meses ?? []).map((m) => (
                <SelectItem key={m} value={m} className="capitalize">
                  {labelCompetencia(m)}{m === mesAtualSistema ? " · parcial" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!isLoading && (meses ?? []).length === 0 && (
        <Card className="glass"><CardContent className="pt-6 text-sm text-muted-foreground">
          Ainda não há dados suficientes para gerar um relatório.
        </CardContent></Card>
      )}

      {rel && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="glass"><CardContent className="pt-4 text-center">
              <CalendarCheck className="mx-auto h-5 w-5 text-brand" />
              <p className="mt-1 text-2xl font-semibold tabular-nums">{rel.sessoes}</p>
              <p className="text-xs text-muted-foreground">sessões no mês</p>
            </CardContent></Card>
            <Card className="glass"><CardContent className="pt-4 text-center">
              <TrendingUp className="mx-auto h-5 w-5 text-brand" />
              <p className="mt-1 text-2xl font-semibold tabular-nums">{rel.engajamento_medio ?? "—"}</p>
              <p className="text-xs text-muted-foreground">engajamento (1–5)</p>
            </CardContent></Card>
            <Card className="glass"><CardContent className="pt-4 text-center">
              <ClipboardList className="mx-auto h-5 w-5 text-brand" />
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {orient ? `${orient.feitas}/${orient.total}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">orientações feitas</p>
            </CardContent></Card>
            <Card className="glass"><CardContent className="pt-4 text-center">
              <Users className="mx-auto h-5 w-5 text-brand" />
              <p className="mt-1 text-2xl font-semibold tabular-nums">{rel.registros_familia}</p>
              <p className="text-xs text-muted-foreground">registros da família</p>
            </CardContent></Card>
          </div>

          {Object.keys(freq).length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2"><CardTitle className="text-base">Frequência</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(freq).map(([tipo, qtd]) => (
                  <Badge key={tipo} variant="secondary" className="font-normal">
                    {FREQ_LABEL[tipo] ?? tipo}: <span className="ml-1 font-semibold tabular-nums">{qtd}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {(rel.habilidades ?? []).length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-brand" /> Habilidades trabalhadas
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {rel.habilidades.map((h) => (
                  <Badge key={h.nome} variant="outline" className="font-normal">
                    {h.nome} <span className="ml-1 tabular-nums text-muted-foreground">×{h.vezes}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {(rel.metas ?? []).length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-brand" /> Progresso das metas
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Escala GAS: 0 significa que a meta esperada foi alcançada; valores positivos indicam
                  progresso acima do esperado e negativos, abaixo.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {rel.metas.map((m, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm">{m.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.dominio ? `${m.dominio} · ` : ""}{m.registros} {m.registros === 1 ? "registro" : "registros"} no mês
                      </p>
                    </div>
                    {m.gas_ultimo != null && (
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", GAS_CHIP[m.gas_ultimo]?.cls)}>
                        GAS {GAS_CHIP[m.gas_ultimo]?.label ?? m.gas_ultimo}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
