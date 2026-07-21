import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parseISO, endOfMonth } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Item = { id: string; data: string; descricao: string; valor: number };
type Grupo = { nome: string; total: number; itens: Item[] };

function agruparPorCategoria(itens: (Item & { categoria: string })[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const it of itens) {
    if (!map.has(it.categoria)) map.set(it.categoria, { nome: it.categoria, total: 0, itens: [] });
    const g = map.get(it.categoria)!;
    g.total += it.valor;
    g.itens.push(it);
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((g) => ({ ...g, itens: g.itens.sort((a, b) => b.valor - a.valor) }));
}

export function PorCategoria() {
  const [mes, setMes] = useState(() => format(new Date(), "yyyy-MM"));
  const inicioMes = `${mes}-01`;
  const fimMes = format(endOfMonth(parseISO(inicioMes)), "yyyy-MM-dd");

  const { data: pagamentos } = useQuery({
    queryKey: ["categoria-pagamentos", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, valor, vencimento, pago_em, paciente:pacientes(nome)")
        .eq("status", "pago")
        .gte("competencia", inicioMes).lte("competencia", fimMes);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: receitasAvulsas } = useQuery({
    queryKey: ["categoria-receitas", mes],
    queryFn: async () => {
      // `lancamentos_financeiros.paciente_id` não tem FK formal, então não dá pra usar
      // embed automático (paciente:pacientes(nome)) — o nome é resolvido à parte abaixo.
      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("id, valor, vencimento, pago_em, descricao, paciente_id, plano_conta:plano_contas(nome)")
        .eq("tipo", "receita").eq("status", "confirmado")
        .gte("competencia", inicioMes).lte("competencia", fimMes);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pacientesRef } = useQuery({
    queryKey: ["categoria-pacientes-ref"],
    queryFn: async () => (await supabase.from("pacientes").select("id, nome")).data ?? [],
  });

  const { data: despesas } = useQuery({
    queryKey: ["categoria-despesas", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("id, valor, vencimento, pago_em, descricao, plano_conta:plano_contas(nome), fornecedor:fornecedores(nome)")
        .eq("tipo", "despesa").eq("status", "confirmado")
        .gte("competencia", inicioMes).lte("competencia", fimMes);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { gruposReceita, totalReceita, gruposDespesa, totalDespesa } = useMemo(() => {
    const nomePorPaciente = new Map((pacientesRef ?? []).map((p) => [p.id, p.nome]));

    const itensReceita = [
      ...(pagamentos ?? []).map((p: any) => ({
        id: p.id, data: p.pago_em ?? p.vencimento, descricao: p.paciente?.nome ?? "Paciente",
        valor: Number(p.valor), categoria: "Mensalidades",
      })),
      ...(receitasAvulsas ?? []).map((l: any) => {
        const nomePaciente = l.paciente_id ? nomePorPaciente.get(l.paciente_id) : null;
        return {
          id: l.id, data: l.pago_em ?? l.vencimento,
          descricao: nomePaciente ? `${nomePaciente} — ${l.descricao}` : l.descricao,
          valor: Number(l.valor), categoria: l.plano_conta?.nome ?? "Outras receitas",
        };
      }),
    ];
    const itensDespesa = (despesas ?? []).map((l: any) => ({
      id: l.id, data: l.pago_em ?? l.vencimento,
      descricao: l.fornecedor?.nome ? `${l.descricao} — ${l.fornecedor.nome}` : l.descricao,
      valor: Number(l.valor), categoria: l.plano_conta?.nome ?? "Sem categoria",
    }));

    const gruposReceita = agruparPorCategoria(itensReceita);
    const gruposDespesa = agruparPorCategoria(itensDespesa);
    return {
      gruposReceita, totalReceita: gruposReceita.reduce((s, g) => s + g.total, 0),
      gruposDespesa, totalDespesa: gruposDespesa.reduce((s, g) => s + g.total, 0),
    };
  }, [pagamentos, receitasAvulsas, despesas, pacientesRef]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Mês</Label>
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-40" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CategoriaCard titulo="Recebimentos do mês" total={totalReceita} grupos={gruposReceita} tone="success" />
        <CategoriaCard titulo="Despesas do mês" total={totalDespesa} grupos={gruposDespesa} tone="danger" />
      </div>
    </div>
  );
}

function CategoriaCard({ titulo, total, grupos, tone }: { titulo: string; total: number; grupos: Grupo[]; tone: "success" | "danger" }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <p className={cn("text-2xl font-semibold", tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
          {currency(total)}
        </p>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {grupos.map((g) => <CategoriaRow key={g.nome} grupo={g} totalGeral={total} tone={tone} />)}
        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Nada neste mês.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriaRow({ grupo, totalGeral, tone }: { grupo: Grupo; totalGeral: number; tone: "success" | "danger" }) {
  const [open, setOpen] = useState(false);
  const pct = totalGeral > 0 ? (grupo.total / totalGeral) * 100 : 0;
  const corTexto = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
  const corBarra = tone === "success" ? "bg-emerald-500" : "bg-destructive";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full rounded-lg px-2 py-2 hover:bg-secondary/40 transition text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
            <span className="text-sm font-medium truncate">{grupo.nome}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">({grupo.itens.length})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
            <span className={cn("text-sm font-semibold", corTexto)}>{currency(grupo.total)}</span>
          </div>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
          <div className={cn("h-full rounded-full", corBarra)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5 pr-2 pb-1.5">
        {grupo.itens.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground py-1 border-t border-border/40">
            <span className="truncate">{format(parseISO(it.data), "dd/MM")} · {it.descricao}</span>
            <span className="shrink-0">{currency(it.valor)}</span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
