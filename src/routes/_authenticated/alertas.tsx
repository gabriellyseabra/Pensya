import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Clock, FileWarning, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PageHero } from "@/components/shared/PageHero";
import { TwoColumn, BigStatCard, DarkHighlightCard } from "@/components/shared/panels";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertasPage,
});

function AlertasPage() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data: pagamentosAtrasados } = useQuery({
    queryKey: ["alerta-pag-atrasados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("id, valor, vencimento, paciente:pacientes(id, nome)")
        .lt("vencimento", todayStr)
        .neq("status", "pago")
        .order("vencimento");
      return data ?? [];
    },
  });

  const { data: cadastrosPendentes } = useQuery({
    queryKey: ["alerta-cad-pendentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cadastro_publico")
        .select("id, enviado_para_nome, status, criado_em")
        .in("status", ["preenchido"])
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  const { data: contratosNaoAssinados } = useQuery({
    queryKey: ["alerta-contratos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contratos")
        .select("id, signatario_nome, status, created_at, paciente:pacientes(id, nome)")
        .in("status", ["pendente", "enviado"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const nAtrasados = pagamentosAtrasados?.length ?? 0;
  const nCadastros = cadastrosPendentes?.length ?? 0;
  const nContratos = contratosNaoAssinados?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHero
        icon={Bell}
        eyebrow="Central de atenção"
        title="Alertas"
        description="Tudo o que precisa de um olhar agora — pagamentos, cadastros e contratos."
        variant="dark"
        stats={[
          { label: "Pag. atrasados", value: nAtrasados, icon: AlertTriangle },
          { label: "Cadastros", value: nCadastros, icon: FileWarning },
          { label: "Contratos", value: nContratos, icon: Clock },
        ]}
      />

      <TwoColumn side={<AlertasSidePanel total={nAtrasados + nCadastros + nContratos} valorAtrasado={pagamentosAtrasados?.reduce((s: number, p: any) => s + Number(p.valor), 0) ?? 0} />}>
      <div className="grid gap-4 sm:grid-cols-3">
        <BigStatCard label="Pag. atrasados" value={nAtrasados} icon={AlertTriangle} delay={40} />
        <BigStatCard label="Cadastros p/ revisar" value={nCadastros} icon={FileWarning} delay={100} />
        <BigStatCard label="Contratos pendentes" value={nContratos} icon={Clock} delay={160} />
      </div>

      <Card
        className="glass card-lift animate-fade-up border-l-4 border-l-destructive"
        style={{ animationDelay: "80ms" }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Pagamentos atrasados ({pagamentosAtrasados?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!pagamentosAtrasados || pagamentosAtrasados.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhum pagamento atrasado.</p>
          )}
          {pagamentosAtrasados?.map((p: any) => (
            <Link
              key={p.id}
              to="/pacientes/$id"
              params={{ id: p.paciente?.id ?? "" }}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 hover:bg-accent transition-colors"
            >
              <div>
                <p className="font-medium text-sm">{p.paciente?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Venc. {format(parseISO(p.vencimento), "dd/MM/yyyy")}</p>
              </div>
              <Badge variant="destructive">
                {Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card
        className="glass card-lift animate-fade-up border-l-4 border-l-brand-yellow"
        style={{ animationDelay: "160ms" }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-4 w-4" />
            Cadastros para revisar ({cadastrosPendentes?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!cadastrosPendentes || cadastrosPendentes.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhum cadastro pendente.</p>
          )}
          {cadastrosPendentes?.map((c: any) => (
            <Link
              key={c.id}
              to="/cadastros"
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 hover:bg-accent transition-colors"
            >
              <div>
                <p className="font-medium text-sm">{c.enviado_para_nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(c.criado_em), "dd/MM/yyyy")}</p>
              </div>
              <Badge variant="outline">Revisar</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card
        className="glass card-lift animate-fade-up border-l-4 border-l-brand"
        style={{ animationDelay: "240ms" }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-brand" />
            Contratos aguardando assinatura ({contratosNaoAssinados?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!contratosNaoAssinados || contratosNaoAssinados.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhum contrato pendente.</p>
          )}
          {contratosNaoAssinados?.map((c: any) => (
            <Link
              key={c.id}
              to="/contratos"
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3 hover:bg-accent transition-colors"
            >
              <div>
                <p className="font-medium text-sm">{c.signatario_nome ?? c.paciente?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Enviado em {format(parseISO(c.created_at), "dd/MM/yyyy")}</p>
              </div>
              <Badge variant="secondary">{c.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
      </TwoColumn>
    </div>
  );
}

function AlertasSidePanel({ total, valorAtrasado }: { total: number; valorAtrasado: number }) {
  const tudoEmDia = total === 0;
  return (
    <>
      <DarkHighlightCard eyebrow="Resumo" icon={Bell} delay={80}>
        {tudoEmDia ? (
          <div>
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <p className="mt-2 text-lg font-semibold text-white">Tudo em dia ✨</p>
            <p className="text-sm text-white/60">Nenhuma pendência aberta no momento.</p>
          </div>
        ) : (
          <div>
            <p className="text-4xl font-semibold text-white">{total}</p>
            <p className="text-sm text-white/60">
              pendência{total > 1 ? "s" : ""} aguardando ação
            </p>
            {valorAtrasado > 0 && (
              <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/80">
                {valorAtrasado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em
                pagamentos atrasados
              </p>
            )}
          </div>
        )}
      </DarkHighlightCard>

      <Link
        to="/indicadores"
        className="animate-fade-up card-lift relative block overflow-hidden rounded-[var(--radius)] gradient-lilac p-5 shadow-[var(--shadow-card)]"
        style={{ animationDelay: "140ms" }}
      >
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
        <div className="relative">
          <p className="text-lg font-display leading-tight text-lilac-foreground">
            Ver indicadores
          </p>
          <p className="mt-1 text-xs text-lilac-foreground/80">
            Acompanhe receita, inadimplência e evolução da clínica.
          </p>
        </div>
      </Link>
    </>
  );
}
