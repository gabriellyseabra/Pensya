import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, CalendarCheck2, CheckCircle2, Clock3, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/meu-financeiro")({
  component: MeuFinanceiroPage,
});

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FORMA_LABEL: Record<string, string> = {
  fixo_mensal: "Valor fixo mensal",
  por_sessao: "Por sessão",
  por_paciente: "Por paciente",
  percentual: "Percentual sobre receita",
  auto: "Automático",
  nao_configurado: "Ainda não configurada",
};

function MeuFinanceiroPage() {
  const [refMonth, setRefMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const competencia = `${refMonth}-01`;

  const { data, isLoading } = useQuery({
    queryKey: ["meu-financeiro", competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meu_financeiro_mensal", { _competencia: competencia });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });

  // Lista das sessões do mês que compõem o valor (informativo).
  const { data: sessoes } = useQuery({
    queryKey: ["meu-financeiro-sessoes", competencia],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: prof } = await supabase
        .from("profissionais_consultorio").select("id").eq("user_id", user.id).maybeSingle();
      if (!prof) return [];
      const ini = `${refMonth}-01T00:00:00`;
      const fimDate = new Date(Number(refMonth.slice(0, 4)), Number(refMonth.slice(5, 7)), 0);
      const fim = `${format(fimDate, "yyyy-MM-dd")}T23:59:59`;
      const { data } = await supabase
        .from("atendimentos")
        .select("id, inicio, status_frequencia_id, paciente:pacientes(nome), status_frequencia:status_frequencia(nome, conta_presenca)")
        .eq("profissional_id", prof.id)
        .gte("inicio", ini)
        .lte("inicio", fim)
        .order("inicio", { ascending: true });
      return data ?? [];
    },
  });

  const paga = data?.folha_status === "paga";
  const forma = data?.forma ?? "nao_configurado";

  return (
    <div className="space-y-6">
      <PageHero
        icon={Wallet}
        eyebrow="Meus recebimentos"
        title="Meu financeiro"
        description="Quanto você recebe no mês pelos seus atendimentos, conforme a forma de remuneração combinada com a clínica."
        variant="lilac"
        actions={
          <input
            type="month"
            value={refMonth}
            onChange={(e) => setRefMonth(e.target.value)}
            className="h-10 rounded-lg border border-input bg-white/80 px-3 text-sm text-foreground"
          />
        }
      />

      {isLoading ? (
        <Card className="glass p-8 text-center text-muted-foreground">Carregando…</Card>
      ) : !data ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          Ainda não há dados de remuneração vinculados ao seu perfil. Fale com a administração da clínica.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="glass card-lift gradient-brand text-white sm:col-span-1">
              <CardContent className="p-5 space-y-1">
                <p className="text-xs opacity-80">A receber no mês</p>
                <p className="text-3xl font-semibold">{currency(Number(data.total || 0))}</p>
                <Badge className={paga ? "bg-white/20 text-white" : "bg-white/20 text-white"}>
                  {paga ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" />Pago{data.folha_paga_em ? ` em ${format(parseISO(data.folha_paga_em), "dd/MM")}` : ""}</>
                  ) : (
                    <><Clock3 className="mr-1 h-3 w-3" />Aguardando pagamento</>
                  )}
                </Badge>
              </CardContent>
            </Card>

            <Card className="glass card-lift">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarCheck2 className="h-4 w-4" /><span className="text-sm">Sessões contadas</span>
                </div>
                <p className="text-3xl font-semibold">{data.qtd_sessoes ?? 0}</p>
                <p className="text-xs text-muted-foreground">no mês selecionado</p>
              </CardContent>
            </Card>

            <Card className="glass card-lift">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" /><span className="text-sm">Forma de repasse</span>
                </div>
                <p className="text-lg font-semibold">{FORMA_LABEL[forma] ?? forma}</p>
              </CardContent>
            </Card>
          </div>

          {/* Composição do valor */}
          <Card className="glass">
            <CardContent className="p-5 space-y-2">
              <p className="text-sm font-medium">Composição do valor</p>
              <div className="divide-y divide-border/60">
                {Number(data.salario_base || 0) > 0 && (
                  <Linha label="Valor fixo / base" v={Number(data.salario_base)} />
                )}
                {Number(data.comissoes || 0) > 0 && (
                  <Linha label={`Pelos atendimentos${forma === "por_sessao" ? ` (${data.qtd_sessoes} sessões)` : ""}`} v={Number(data.comissoes)} />
                )}
                {Number(data.beneficios || 0) > 0 && <Linha label="Benefícios" v={Number(data.beneficios)} />}
                {Number(data.descontos || 0) > 0 && <Linha label="Descontos" v={-Number(data.descontos)} />}
                <div className="flex items-center justify-between pt-2 font-semibold">
                  <span>Total a receber</span>
                  <span>{currency(Number(data.total || 0))}</span>
                </div>
              </div>
              {forma === "nao_configurado" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Sua forma de remuneração ainda não foi definida pela clínica — o valor aparece zerado até isso ser configurado.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sessões do mês */}
          <Card className="glass">
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-medium">Atendimentos do mês</p>
              {(sessoes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento registrado neste mês.</p>
              ) : (
                <div className="space-y-1.5">
                  {(sessoes ?? []).map((s: any) => {
                    const conta = s.status_frequencia?.conta_presenca !== false;
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{s.paciente?.nome ?? "—"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {format(parseISO(s.inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <Badge variant="outline" className={conta ? "" : "text-muted-foreground"}>
                          {s.status_frequencia?.nome ?? (conta ? "Conta" : "Não conta")}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Linha({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={v < 0 ? "text-destructive" : ""}>{currency(v)}</span>
    </div>
  );
}
