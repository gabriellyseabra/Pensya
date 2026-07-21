import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, isPast, parseISO } from "date-fns";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { currency, type Etapa, type Lead } from "./types";

export function PipelineKanban({
  etapas, leads, onSelect,
}: { etapas: Etapa[]; leads: Lead[]; onSelect: (lead: Lead) => void }) {
  const qc = useQueryClient();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const mover = useMutation({
    mutationFn: async ({ lead, novaEtapaId }: { lead: Lead; novaEtapaId: string }) => {
      const now = new Date().toISOString();
      await supabase.from("leads").update({ etapa_id: novaEtapaId, etapa_atualizada_em: now }).eq("id", lead.id);
      await supabase.from("lead_interacoes").insert({
        lead_id: lead.id, tipo: "mudanca_etapa", etapa_anterior_id: lead.etapa_id, etapa_nova_id: novaEtapaId,
      });
    },
    onSuccess: () => invalidarMarketing(qc),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleDragStart(ev: DragStartEvent) {
    setActiveLead(leads.find((l) => l.id === ev.active.id) ?? null);
  }

  function handleDragEnd(ev: DragEndEvent) {
    setActiveLead(null);
    const lead = leads.find((l) => l.id === ev.active.id);
    const novaEtapaId = ev.over?.id as string | undefined;
    if (!lead || !novaEtapaId || novaEtapaId === lead.etapa_id) return;
    mover.mutate({ lead, novaEtapaId });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const leadsEtapa = leads.filter((l) => l.etapa_id === etapa.id);
          const soma = leadsEtapa.reduce((s, l) => s + Number(l.valor_estimado || 0), 0);
          return (
            <Coluna key={etapa.id} etapa={etapa} count={leadsEtapa.length} soma={soma}>
              {leadsEtapa.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onClick={() => onSelect(lead)} />
              ))}
            </Coluna>
          );
        })}
      </div>
      <DragOverlay>{activeLead && <LeadCard lead={activeLead} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Coluna({
  etapa, count, soma, children,
}: { etapa: Etapa; count: number; soma: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  return (
    <div
      ref={setNodeRef}
      className={`glass w-72 shrink-0 rounded-xl p-2.5 transition-colors ${isOver ? "ring-2 ring-brand" : ""}`}
    >
      <div className="flex items-center gap-2 px-1.5 py-1 mb-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
        <p className="text-sm font-semibold flex-1 truncate">{etapa.nome}</p>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </div>
      {soma > 0 && <p className="px-1.5 text-[11px] text-muted-foreground mb-2">{currency(soma)}</p>}
      <div className="space-y-2 min-h-[60px]">
        {children}
        {count === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead</p>}
      </div>
    </div>
  );
}

function LeadCard({ lead, onClick, dragging }: { lead: Lead; onClick?: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const dias = differenceInDays(new Date(), parseISO(lead.etapa_atualizada_em));
  const estagnado = dias >= 7;
  const atrasado = lead.proximo_contato_em ? isPast(parseISO(lead.proximo_contato_em)) : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-lg border border-border/50 bg-background/80 p-2.5 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "opacity-40" : ""
      } ${dragging ? "shadow-lg rotate-2" : ""}`}
    >
      <p className="text-sm font-medium truncate">{lead.nome}</p>
      {lead.nome_paciente && <p className="text-xs text-muted-foreground truncate">Paciente: {lead.nome_paciente}</p>}
      {lead.origem_detalhe && <p className="text-xs text-muted-foreground truncate">Origem: {lead.origem_detalhe}</p>}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {lead.canal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{lead.canal.nome}</Badge>}
        {lead.indicador_nome && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Ind.: {lead.indicador_nome}</Badge>}
        {lead.responsavel && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{lead.responsavel.nome}</Badge>}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />{dias}d na etapa
        </span>
        {lead.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</span>}
      </div>
      {(estagnado || atrasado) && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600">
          <AlertTriangle className="w-3 h-3" />
          {atrasado ? "Follow-up atrasado" : "Sem movimentação há 7+ dias"}
        </div>
      )}
    </div>
  );
}
