import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PERIODOS = [
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
  { value: "0", label: "Desde o início" },
];

/**
 * Funil de vendas: leads que passaram por cada etapa do pipeline no
 * período, taxa de conversão etapa a etapa e conversão total.
 * Um lead "passou" pela etapa se está nela hoje ou já avançou além dela.
 */
export function Funil() {
  const [periodo, setPeriodo] = useState("180");

  const { data: etapas = [] } = useQuery({
    queryKey: ["pipeline-etapas-funil"],
    queryFn: async () =>
      (await supabase.from("pipeline_etapas").select("id, nome, ordem, cor, tipo").eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-funil", periodo],
    queryFn: async () => {
      let q = supabase.from("leads").select("id, etapa_id, entrou_em, convertido_em, motivo_perda");
      if (periodo !== "0") {
        const desde = new Date(Date.now() - Number(periodo) * 86400000).toISOString();
        q = q.gte("entrou_em", desde);
      }
      return (await q).data ?? [];
    },
  });

  const ordemDe = new Map(etapas.map((e: any) => [e.id, e.ordem]));
  const etapasFunil = (etapas as any[]).filter((e) => e.tipo !== "perdido");

  const contagens = etapasFunil.map((e: any) => {
    const passaram = (leads as any[]).filter((l) => {
      const ordemLead = ordemDe.get(l.etapa_id);
      return ordemLead != null && ordemLead >= e.ordem;
    }).length;
    return { ...e, passaram };
  });

  const total = contagens[0]?.passaram ?? 0;
  const convertidos = (leads as any[]).filter((l) => l.convertido_em).length;
  const perdidos = (leads as any[]).filter((l) => l.motivo_perda).length;

  return (
    <Card className="glass card-lift animate-fade-up p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Filter className="h-4 w-4 text-brand" /> Funil de vendas</h3>
          <p className="text-xs text-muted-foreground">
            {total} lead(s) no período · {convertidos} viraram paciente
            {total > 0 ? ` (${Math.round((convertidos / total) * 100)}%)` : ""} · {perdidos} perdidos
          </p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mx-auto max-w-2xl space-y-1.5">
        {contagens.map((e: any, i: number) => {
          const larguraPct = total > 0 ? Math.max(18, (e.passaram / total) * 100) : 18;
          const anterior = i > 0 ? contagens[i - 1].passaram : null;
          const taxa = anterior ? Math.round((e.passaram / anterior) * 100) : null;
          return (
            <div key={e.id} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              {taxa != null && (
                <p className={cn("py-0.5 text-center text-[11px] tabular-nums",
                  taxa >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  ↓ {taxa}% avançam
                </p>
              )}
              <div
                className="mx-auto flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-white shadow-sm transition-all"
                style={{ width: `${larguraPct}%`, backgroundColor: e.cor || "var(--brand)" }}
              >
                <span className="truncate font-medium">{e.nome}</span>
                <span className="ml-2 shrink-0 font-semibold tabular-nums">{e.passaram}</span>
              </div>
            </div>
          );
        })}
        {etapasFunil.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Configure as etapas do pipeline primeiro.</p>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Cada barra mostra quantos leads chegaram até aquela etapa (ou além). Gargalo = onde o % de avanço despenca.
      </p>
    </Card>
  );
}
