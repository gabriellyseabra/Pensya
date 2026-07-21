import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, DoorOpen, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Portal do sublocador: agenda com reserva de horários livres,
 * troca via drag-and-drop e fechamento automático do mês.
 * Acesso por link com token (gerado na tela de Sublocação).
 */
export const Route = createFileRoute("/salas/$token")({
  ssr: false,
  component: SublocadorPortal,
});

type Contrato = { id: string; sala_id: string; modelo: string; valor_base: number | null; percentual: number | null; valor_extra: number | null };
type Ocupacao = { id?: string; sala_id: string; inicio: string; fim: string; minha?: boolean; valor?: number | null; faturado?: boolean };
type Portal = {
  sublocador: { id: string; nome: string };
  contratos: Contrato[];
  salas: { id: string; nome: string; cor: string | null }[];
  janelas: { sala_id: string; inicio: string; fim: string; tipo: string }[];
  ocupacoes: Ocupacao[];
};

const HORA_INI = 7;
const HORA_FIM = 21;
const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function SublocadorPortal() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [semana, setSemana] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [salaId, setSalaId] = useState<string | null>(null);
  const [duracao, setDuracao] = useState(60);
  const [novaReserva, setNovaReserva] = useState<Date | null>(null);
  const dias = Array.from({ length: 6 }, (_, i) => addDays(semana, i));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: portal, isLoading, error } = useQuery({
    queryKey: ["sublocador-portal", token, format(semana, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sublocador_portal", {
        _token: token,
        _de: format(semana, "yyyy-MM-dd"),
        _ate: format(addDays(semana, 6), "yyyy-MM-dd"),
      });
      if (error) throw new Error(error.message);
      return data as unknown as Portal;
    },
    retry: false,
  });

  const hoje = new Date();
  const { data: fechamento } = useQuery({
    enabled: !!portal,
    queryKey: ["sublocador-fechamento", token, hoje.getFullYear(), hoje.getMonth() + 1],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sublocador_fechamento", {
        _token: token, _ano: hoje.getFullYear(), _mes: hoje.getMonth() + 1,
      });
      if (error) throw new Error(error.message);
      return data as unknown as { competencia: string; total: number; sessoes: number };
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["sublocador-portal", token] });
    qc.invalidateQueries({ queryKey: ["sublocador-fechamento", token] });
  };

  const reservar = useMutation({
    mutationFn: async ({ inicio, fim }: { inicio: Date; fim: Date }) => {
      const contrato = portal?.contratos.find((c) => c.sala_id === salaSel?.id) ?? portal?.contratos[0];
      if (!contrato) throw new Error("Você não tem contrato ativo para esta sala — fale com a clínica");
      const { error } = await supabase.rpc("sublocador_reservar", {
        _token: token, _contrato_id: contrato.id,
        _inicio: inicio.toISOString(), _fim: fim.toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Horário reservado!"); setNovaReserva(null); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async ({ usoId, inicio, fim }: { usoId: string; inicio: Date; fim: Date }) => {
      const { error } = await supabase.rpc("sublocador_mover", {
        _token: token, _uso_id: usoId,
        _inicio: inicio.toISOString(), _fim: fim.toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Horário alterado!"); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (usoId: string) => {
      const { error } = await supabase.rpc("sublocador_cancelar", { _token: token, _uso_id: usoId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Reserva cancelada"); invalidar(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Link inválido ou desativado. Peça um novo link à clínica.
      </div>
    );
  }
  if (isLoading || !portal) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  }

  const salaSel = portal.salas.find((s) => s.id === (salaId ?? portal.contratos[0]?.sala_id)) ?? portal.salas[0];

  function onDragEnd(e: DragEndEvent) {
    const uso = portal!.ocupacoes.find((o) => o.id === e.active.id);
    const destino = e.over?.id as string | undefined;
    if (!uso || !destino || !destino.startsWith("slot|")) return;
    const [, iso] = destino.split("|");
    const inicio = new Date(iso);
    const durMin = (new Date(uso.fim).getTime() - new Date(uso.inicio).getTime()) / 60000;
    const fim = new Date(inicio.getTime() + durMin * 60000);
    mover.mutate({ usoId: uso.id!, inicio, fim });
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="glass sticky top-0 z-20 border-b border-border/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <img src="/pensya-icon.svg" alt="Pensya" className="h-9 w-9 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Agenda de salas</p>
            <p className="truncate font-display text-base font-semibold">{portal.sublocador.nome}</p>
          </div>
          {fechamento && (
            <div className="rounded-xl bg-accent/70 px-3 py-1.5 text-right">
              <p className="text-[11px] text-muted-foreground">
                <Wallet className="mr-1 inline h-3 w-3" />
                {format(hoje, "MMMM", { locale: ptBR })} · {fechamento.sessoes} {fechamento.sessoes === 1 ? "sessão" : "sessões"}
              </p>
              <p className="text-sm font-semibold tabular-nums">{BRL(Number(fechamento.total))}</p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {portal.salas.length > 1 && (
              <Select value={salaSel?.id} onValueChange={setSalaId}>
                <SelectTrigger className="w-44"><DoorOpen className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  {portal.salas.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {portal.salas.length === 1 && <p className="text-sm font-medium">{salaSel?.nome}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSemana(addDays(semana, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-28 text-center text-sm font-medium">{format(dias[0], "dd/MM")} – {format(dias[5], "dd/MM")}</span>
            <Button variant="ghost" size="icon" onClick={() => setSemana(addDays(semana, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Toque num horário <span className="font-medium text-emerald-600 dark:text-emerald-400">livre</span> para
          reservar · arraste <span className="font-medium text-brand">sua reserva</span> para trocar de horário.
        </p>

        {salaSel && (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3rem repeat(${dias.length}, 1fr)` }}>
                <div className="glass sticky left-0" />
                {dias.map((d) => (
                  <div key={d.toISOString()} className="glass border-l border-border/40 p-1.5 text-center text-xs font-medium capitalize">
                    {format(d, "EEE dd/MM", { locale: ptBR })}
                  </div>
                ))}
                {Array.from({ length: HORA_FIM - HORA_INI }, (_, h) => HORA_INI + h).map((hora) => (
                  <FragmentRow
                    key={hora}
                    hora={hora}
                    dias={dias}
                    sala={salaSel}
                    portal={portal}
                    onReservar={(inicio) => setNovaReserva(inicio)}
                    onCancelar={(id) => cancelar.mutate(id)}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        )}
      </main>

      <Dialog open={!!novaReserva} onOpenChange={(o) => !o && setNovaReserva(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reservar {salaSel?.nome}</DialogTitle>
          </DialogHeader>
          {novaReserva && (
            <div className="space-y-3">
              <p className="text-sm capitalize">
                {format(novaReserva, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Duração</p>
                <Select value={String(duracao)} onValueChange={(v) => setDuracao(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[30, 50, 60, 90, 120].map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaReserva(null)}>Voltar</Button>
            <Button
              className="gradient-brand text-brand-foreground"
              disabled={reservar.isPending}
              onClick={() => novaReserva && reservar.mutate({
                inicio: novaReserva,
                fim: new Date(novaReserva.getTime() + duracao * 60000),
              })}
            >
              Confirmar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Uma linha de hora × dias, com células droppable e chips draggable. */
function FragmentRow({ hora, dias, sala, portal, onReservar, onCancelar }: {
  hora: number;
  dias: Date[];
  sala: { id: string };
  portal: Portal;
  onReservar: (inicio: Date) => void;
  onCancelar: (usoId: string) => void;
}) {
  return (
    <>
      <div className="glass sticky left-0 border-t border-border/40 p-1 text-right text-[10px] tabular-nums text-muted-foreground">
        {String(hora).padStart(2, "0")}h
      </div>
      {dias.map((dia) => {
        const inicio = new Date(dia); inicio.setHours(hora, 0, 0, 0);
        return (
          <SlotCell
            key={dia.toISOString() + hora}
            inicio={inicio}
            sala={sala}
            portal={portal}
            onReservar={onReservar}
            onCancelar={onCancelar}
          />
        );
      })}
    </>
  );
}

function SlotCell({ inicio, sala, portal, onReservar, onCancelar }: {
  inicio: Date;
  sala: { id: string };
  portal: Portal;
  onReservar: (inicio: Date) => void;
  onCancelar: (usoId: string) => void;
}) {
  const fim = new Date(inicio.getTime() + 60 * 60000);
  const { setNodeRef, isOver } = useDroppable({ id: `slot|${inicio.toISOString()}` });

  const dentroJanela = portal.janelas.some((j) =>
    j.sala_id === sala.id && j.tipo === "disponivel" &&
    new Date(j.inicio) <= inicio && new Date(j.fim) >= fim,
  );
  const bloqueada = portal.janelas.some((j) =>
    j.sala_id === sala.id && j.tipo === "bloqueada" &&
    new Date(j.inicio) < fim && new Date(j.fim) > inicio,
  );
  const ocupacoes = portal.ocupacoes.filter((o) =>
    o.sala_id === sala.id && new Date(o.inicio) < fim && new Date(o.fim) > inicio,
  );
  const iniciaAqui = ocupacoes.filter((o) => {
    const oi = new Date(o.inicio);
    return oi >= inicio && oi < fim;
  });
  const passado = inicio < new Date();
  const livre = dentroJanela && !bloqueada && ocupacoes.length === 0 && !passado;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-11 border-l border-t border-border/40 p-0.5",
        !dentroJanela && "bg-muted/40",
        bloqueada && "bg-muted/70",
        livre && "cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/25",
        isOver && livre && "ring-2 ring-brand ring-inset",
      )}
      onClick={() => livre && onReservar(inicio)}
      title={livre ? "Reservar este horário" : undefined}
    >
      {iniciaAqui.map((o) =>
        o.minha ? (
          <MinhaReserva key={o.id} ocupacao={o} onCancelar={onCancelar} />
        ) : (
          <div key={`${o.inicio}-${o.sala_id}`} className="rounded-md bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {format(parseISO(o.inicio), "HH:mm")}–{format(parseISO(o.fim), "HH:mm")} ocupado
          </div>
        ),
      )}
    </div>
  );
}

function MinhaReserva({ ocupacao, onCancelar }: { ocupacao: Ocupacao; onCancelar: (id: string) => void }) {
  const podeMexer = !ocupacao.faturado && new Date(ocupacao.inicio) > new Date();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ocupacao.id!,
    disabled: !podeMexer,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30, position: "relative" } : undefined}
      className={cn(
        "group rounded-md bg-brand px-1 py-0.5 text-[10px] font-medium text-brand-foreground shadow-sm",
        podeMexer && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-80",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span>
        {format(parseISO(ocupacao.inicio), "HH:mm")}–{format(parseISO(ocupacao.fim), "HH:mm")}
        {ocupacao.valor != null && Number(ocupacao.valor) > 0 ? ` · ${BRL(Number(ocupacao.valor))}` : ""}
      </span>
      {podeMexer && (
        <button
          className="ml-1 hidden align-middle group-hover:inline-block"
          title="Cancelar reserva"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Cancelar esta reserva?")) onCancelar(ocupacao.id!);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
