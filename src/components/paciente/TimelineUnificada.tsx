import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimelineList, type TimelineItem } from "@/components/shared/TimelineList";
import { FileText, ClipboardCheck, Activity, Users, DollarSign, Upload, Sparkles, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Timeline única do paciente — reúne anamnese, avaliações, sessões,
 * reuniões, documentos e pagamentos em uma visualização cronológica.
 */
export function TimelineUnificada({ pacienteId }: { pacienteId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["paciente-timeline", pacienteId],
    queryFn: async () => {
      const [sessoes, avals, reunioes, docs, pags, anam] = await Promise.all([
        supabase.from("prontuario_sessoes").select("id, data, tema_principal").eq("paciente_id", pacienteId).order("data", { ascending: false }).limit(50),
        supabase.from("avaliacoes").select("id, data_inicio, titulo, status").eq("paciente_id", pacienteId).order("data_inicio", { ascending: false }).limit(20),
        supabase.from("reunioes").select("id, data, titulo").eq("paciente_id", pacienteId).order("data", { ascending: false }).limit(20),
        supabase.from("paciente_documentos").select("id, created_at, titulo, categoria").eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(20),
        supabase.from("pagamentos").select("id, data_pagamento, valor, status").eq("paciente_id", pacienteId).order("data_pagamento", { ascending: false }).limit(20),
        supabase.from("paciente_pre_anamnese").select("id, created_at").eq("paciente_id", pacienteId).maybeSingle(),
      ]);

      const items: TimelineItem[] = [];

      (sessoes.data ?? []).forEach((s: any) => items.push({
        id: "ses-" + s.id,
        date: s.data ? format(parseISO(s.data), "dd MMM yyyy", { locale: ptBR }) : "",
        title: s.tema_principal ?? "Sessão clínica",
        description: "Registro de sessão",
        icon: Activity, tone: "brand",
        right: <span className="text-[10px] text-muted-foreground">Sessão</span>,
      }));
      (avals.data ?? []).forEach((a: any) => items.push({
        id: "av-" + a.id,
        date: a.data_inicio ? format(parseISO(a.data_inicio), "dd MMM yyyy", { locale: ptBR }) : "",
        title: a.titulo ?? "Avaliação",
        description: a.status,
        icon: ClipboardCheck, tone: "success",
      }));
      (reunioes.data ?? []).forEach((r: any) => items.push({
        id: "ru-" + r.id,
        date: r.data ? format(parseISO(r.data), "dd MMM yyyy", { locale: ptBR }) : "",
        title: r.titulo ?? "Reunião",
        icon: Users, tone: "muted",
      }));
      (docs.data ?? []).forEach((d: any) => items.push({
        id: "dc-" + d.id,
        date: d.created_at ? format(parseISO(d.created_at), "dd MMM yyyy", { locale: ptBR }) : "",
        title: d.titulo ?? "Documento",
        description: d.categoria,
        icon: Upload, tone: "muted",
      }));
      (pags.data ?? []).forEach((p: any) => items.push({
        id: "pg-" + p.id,
        date: p.data_pagamento ? format(parseISO(p.data_pagamento), "dd MMM yyyy", { locale: ptBR }) : "",
        title: `Pagamento R$ ${Number(p.valor ?? 0).toFixed(2)}`,
        description: p.status,
        icon: DollarSign, tone: p.status === "pago" ? "success" : "warning",
      }));
      if (anam.data?.created_at) {
        items.push({
          id: "an-" + anam.data.id,
          date: format(parseISO(anam.data.created_at), "dd MMM yyyy", { locale: ptBR }),
          title: "Pré-anamnese recebida",
          icon: Sparkles, tone: "brand",
        });
      }

      // ordena por data desc (campos vazios vão para o fim)
      return items.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
    },
  });

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-brand" />Linha do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <TimelineList items={data ?? []} empty="Sem registros ainda." />
        )}
      </CardContent>
    </Card>
  );
}
