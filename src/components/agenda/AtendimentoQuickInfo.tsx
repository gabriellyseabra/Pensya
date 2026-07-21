import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Wallet, Target, ExternalLink } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Resumo enriquecido para o drawer da agenda: frequência do paciente,
 * mensalidade do mês e plano terapêutico ativo + metas em destaque.
 */
export function AtendimentoQuickInfo({ pacienteId }: { pacienteId?: string | null }) {
  const enabled = !!pacienteId;

  const { data: freq } = useQuery({
    queryKey: ["drawer-freq", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("tipo, reposto_em, data_referencia")
        .eq("paciente_id", pacienteId!)
        .gte("data_referencia", new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
      const all = data ?? [];
      const presente = all.filter((r) => /presen|realiz/i.test(r.tipo)).length;
      const falta = all.filter((r) => /falt|ausen/i.test(r.tipo)).length;
      const reposicaoPendente = all.filter((r) => /falt|ausen/i.test(r.tipo) && !r.reposto_em).length;
      const total = all.length;
      const taxa = total > 0 ? Math.round((presente / total) * 100) : null;
      return { presente, falta, reposicaoPendente, total, taxa };
    },
    enabled,
  });

  const { data: financeiro } = useQuery({
    queryKey: ["drawer-fin", pacienteId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString().slice(0, 10);
      const end = endOfMonth(new Date()).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("lancamentos_financeiros")
        .select("id, valor, status, vencimento, pago_em, descricao")
        .eq("paciente_id", pacienteId!)
        .eq("tipo", "receita")
        .gte("competencia", start)
        .lte("competencia", end);
      const all = data ?? [];
      const total = all.reduce((s, x) => s + Number(x.valor || 0), 0);
      const pago = all
        .filter((x) => x.pago_em || x.status === "confirmado")
        .reduce((s, x) => s + Number(x.valor || 0), 0);
      const aberto = total - pago;
      const vencidos = all.filter(
        (x) => !x.pago_em && x.vencimento && new Date(x.vencimento) < new Date(),
      ).length;
      return { total, pago, aberto, vencidos, count: all.length };
    },
    enabled,
  });

  const { data: plano } = useQuery({
    queryKey: ["drawer-plano", pacienteId],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos_terapeuticos")
        .select("id, titulo, status, data_revisao_prevista")
        .eq("paciente_id", pacienteId!)
        .order("created_at", { ascending: false })
        .limit(1);
      const p = planos?.[0];
      if (!p) return null;
      const { data: metas } = await supabase
        .from("plano_metas")
        .select("id, titulo_smart, dominio, nivel_gas_atingido")
        .eq("plano_id", p.id)
        .order("ordem")
        .limit(3);
      return { ...p, metas: metas ?? [] };
    },
    enabled,
  });

  if (!enabled) return null;

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

  return (
    <div className="grid gap-3">
      {/* Frequência */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Frequência (ano)
          </Label>
          {freq?.taxa !== null && freq?.taxa !== undefined && (
            <Badge
              variant="outline"
              className={
                freq.taxa >= 80
                  ? "border-emerald-600 text-emerald-700"
                  : freq.taxa >= 60
                    ? "border-amber-600 text-amber-700"
                    : "border-red-600 text-red-700"
              }
            >
              {freq.taxa}% presença
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Cell label="Sessões" value={freq?.total ?? 0} />
          <Cell label="Presentes" value={freq?.presente ?? 0} accent="emerald" />
          <Cell label="Faltas" value={freq?.falta ?? 0} accent="red" />
          <Cell label="A repor" value={freq?.reposicaoPendente ?? 0} accent="amber" />
        </div>
      </div>

      {/* Financeiro */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Mensalidade —{" "}
            {format(new Date(), "MMM yyyy", { locale: ptBR })}
          </Label>
          {financeiro && financeiro.vencidos > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {financeiro.vencidos} vencido{financeiro.vencidos === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        {!financeiro || financeiro.count === 0 ? (
          <p className="text-xs text-muted-foreground">Sem lançamentos no mês.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Cell label="Previsto" value={brl(financeiro.total)} small />
            <Cell label="Recebido" value={brl(financeiro.pago)} small accent="emerald" />
            <Cell
              label="Em aberto"
              value={brl(financeiro.aberto)}
              small
              accent={financeiro.aberto > 0 ? "amber" : undefined}
            />
          </div>
        )}
      </div>

      {/* Plano ativo */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Plano terapêutico
          </Label>
          {plano && pacienteId && (
            <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
              <Link to="/pacientes/$id" params={{ id: pacienteId }} search={{ tab: "plano" } as any}>
                Abrir <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
        {!plano ? (
          <p className="text-xs text-muted-foreground">Nenhum plano cadastrado.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium truncate flex-1">{plano.titulo}</p>
              <Badge variant="outline" className="text-[9px] capitalize">
                {plano.status}
              </Badge>
            </div>
            {plano.metas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem metas cadastradas.</p>
            ) : (
              <ul className="space-y-1">
                {plano.metas.map((m: any) => (
                  <li key={m.id} className="text-xs flex items-start gap-2">
                    <span className="text-brand mt-0.5">•</span>
                    <span className="flex-1 line-clamp-2">{m.titulo_smart}</span>
                    {m.nivel_gas_atingido != null && (
                      <Badge variant="outline" className="text-[9px]">
                        GAS {m.nivel_gas_atingido > 0 ? `+${m.nivel_gas_atingido}` : m.nivel_gas_atingido}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: number | string;
  accent?: "emerald" | "red" | "amber";
  small?: boolean;
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "amber"
          ? "text-amber-700"
          : "text-foreground";
  return (
    <div>
      <p className={`font-semibold ${small ? "text-xs" : "text-lg"} ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
