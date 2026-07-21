import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GitBranch, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import type { Departamento, Processo } from "./types";
import { STATUS_PROCESSO, progressoProcesso } from "./types";

interface Props {
  departamentos: Departamento[];
  processos: Processo[];
  equipe: { id: string; nome: string | null }[];
  onSelect: (p: Processo) => void;
  compacto?: boolean;
}

export function ProcessosKanban({ departamentos, processos, equipe, onSelect, compacto }: Props) {
  const qc = useQueryClient();
  const [ativo, setAtivo] = useState<Processo | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const mover = useMutation({
    mutationFn: async ({ processo, departamentoId }: { processo: Processo; departamentoId: string }) => {
      const { error } = await supabase.from("processos")
        .update({ departamento_id: departamentoId })
        .eq("id", processo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleDragStart(ev: DragStartEvent) {
    setAtivo(processos.find((p) => p.id === ev.active.id) ?? null);
  }
  function handleDragEnd(ev: DragEndEvent) {
    setAtivo(null);
    const processo = processos.find((p) => p.id === ev.active.id);
    const departamentoId = ev.over?.id as string | undefined;
    if (!processo || !departamentoId || departamentoId === processo.departamento_id) return;
    mover.mutate({ processo, departamentoId });
  }

  const nomePorId = (id: string | null) => (id ? equipe.find((e) => e.id === id)?.nome ?? null : null);
  const subcontagem = (id: string) => processos.filter((p) => p.parent_id === id).length;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {departamentos.map((d) => {
          const doDep = processos.filter((p) => p.departamento_id === d.id && !p.parent_id);
          return (
            <Coluna key={d.id} dep={d} count={doDep.length}>
              {doDep.map((p) => (
                <ProcessoCard
                  key={p.id} processo={p}
                  responsavel={nomePorId(p.responsavel_id)}
                  subitens={subcontagem(p.id)}
                  onClick={() => onSelect(p)}
                  compacto={compacto}
                />
              ))}
            </Coluna>
          );
        })}
      </div>
      <DragOverlay>
        {ativo && <ProcessoCard processo={ativo} responsavel={nomePorId(ativo.responsavel_id)} subitens={subcontagem(ativo.id)} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function Coluna({ dep, count, children }: { dep: Departamento; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dep.id });
  return (
    <div ref={setNodeRef} className={`glass w-72 shrink-0 rounded-xl p-2.5 transition-colors ${isOver ? "ring-2 ring-brand" : ""}`}>
      <div className="flex items-center gap-2 px-1.5 py-1 mb-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dep.cor }} />
        <p className="text-sm font-semibold flex-1 truncate">{dep.nome}</p>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {children}
        {count === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum processo</p>}
      </div>
    </div>
  );
}

function ProcessoCard({
  processo, responsavel, subitens, onClick, dragging, compacto,
}: { processo: Processo; responsavel: string | null; subitens: number; onClick?: () => void; dragging?: boolean; compacto?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: processo.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const st = STATUS_PROCESSO.find((s) => s.value === processo.status);
  const prog = progressoProcesso(processo.conteudo);

  if (compacto) {
    return (
      <div
        ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick}
        className={`rounded-md border border-border/50 bg-background/80 px-2 py-1.5 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-2 ${
          isDragging ? "opacity-40" : ""
        } ${dragging ? "shadow-lg rotate-2" : ""}`}
      >
        {processo.emoji && <span className="text-sm leading-none shrink-0">{processo.emoji}</span>}
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: st?.value === "ativo" ? "#10b981" : st?.value === "em_revisao" ? "#f59e0b" : "#94a3b8" }} />
        <p className="text-xs font-medium flex-1 min-w-0 truncate">{processo.titulo}</p>
        {subitens > 0 && <span className="flex items-center gap-0.5 shrink-0 text-[10px] text-muted-foreground"><GitBranch className="w-3 h-3" />{subitens}</span>}
        {processo.visibilidade === "publico" && <Globe className="w-3 h-3 text-brand shrink-0" />}
        {processo.visibilidade === "restrito" && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick}
      className={`rounded-lg border border-border/50 bg-background/80 p-2.5 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "opacity-40" : ""
      } ${dragging ? "shadow-lg rotate-2" : ""}`}
    >
      <div className="flex items-start gap-2">
        {processo.emoji && <span className="text-base leading-none shrink-0">{processo.emoji}</span>}
        <p className="text-sm font-medium flex-1 min-w-0">{processo.titulo}</p>
        {processo.visibilidade === "publico" && <Globe className="w-3 h-3 text-brand shrink-0 mt-0.5" />}
        {processo.visibilidade === "restrito" && <Lock className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {st && <Badge className={`text-[10px] px-1.5 py-0 ${st.cor}`}>{st.label}</Badge>}
        {processo.categoria && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{processo.categoria}</Badge>}
      </div>
      {prog.total > 0 && (
        <div className="mt-2">
          <Progress value={prog.pct} className="h-1" />
          <p className="text-[10px] text-muted-foreground mt-0.5">{prog.feitos}/{prog.total} passos</p>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
        {responsavel ? <span className="truncate">{responsavel}</span> : <span />}
        {subitens > 0 && <span className="flex items-center gap-1 shrink-0"><GitBranch className="w-3 h-3" />{subitens}</span>}
      </div>
    </div>
  );
}
