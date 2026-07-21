import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  a_fazer: "A fazer",
  em_progresso: "Em progresso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const ORIGEM_LABEL: Record<string, string> = {
  manual: "Manual",
  sessao: "Sessão",
  reuniao: "Reunião",
  plano: "Plano",
  ia: "IA",
};

export function TarefasTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["paciente-tarefas-full", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("status")
        .order("prazo", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: concluida ? "concluida" : "a_fazer",
          concluida_em: concluida ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paciente-tarefas-full", pacienteId] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["paciente-tarefas-full", pacienteId] });
    },
  });

  const grupos = {
    a_fazer: tarefas?.filter((t: any) => t.status === "a_fazer" || t.status === "pendente") ?? [],
    em_progresso: tarefas?.filter((t: any) => t.status === "em_progresso" || t.status === "em_andamento") ?? [],
    concluida: tarefas?.filter((t: any) => t.status === "concluida") ?? [],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tarefas clínicas</h2>
          <p className="text-sm text-muted-foreground">
            Encaminhamentos, revisões e ações vinculadas ao paciente.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Nova tarefa
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {(["a_fazer", "em_progresso", "concluida"] as const).map((status) => {
        const lista = grupos[status];
        if (!lista.length) return null;
        return (
          <div key={status} className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {STATUS_LABEL[status]} <span className="text-foreground/60">({lista.length})</span>
            </h3>
            <div className="space-y-2">
              {lista.map((t: any) => {
                const atrasada = t.prazo && t.status !== "concluida" && new Date(t.prazo) < new Date();
                return (
                  <Card key={t.id} className="glass">
                    <CardContent className="pt-4 pb-4 flex items-start gap-3">
                      <Checkbox
                        className="mt-0.5"
                        checked={t.status === "concluida"}
                        onCheckedChange={(c) => toggle.mutate({ id: t.id, concluida: !!c })}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                          {t.titulo}
                        </p>
                        {t.descricao && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{t.descricao}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {t.prazo && (
                            <Badge variant={atrasada ? "destructive" : "outline"} className="text-[10px]">
                              {atrasada && <AlertCircle className="w-3 h-3 mr-1" />}
                              {format(parseISO(t.prazo), "dd/MM/yyyy")}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">{t.prioridade}</Badge>
                          {t.origem && t.origem !== "manual" && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              {t.origem === "ia" && <Sparkles className="w-2.5 h-2.5" />}
                              {ORIGEM_LABEL[t.origem] ?? t.origem}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => remover.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {tarefas?.length === 0 && (
        <Card className="glass p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma tarefa registrada. Tarefas também são criadas automaticamente a partir de sessões e reuniões.
          </p>
        </Card>
      )}

      <NovaTarefaPacienteDialog
        open={open}
        onOpenChange={setOpen}
        pacienteId={pacienteId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["paciente-tarefas-full", pacienteId] })}
      />
    </div>
  );
}

function NovaTarefaPacienteDialog({
  open, onOpenChange, pacienteId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; pacienteId: string; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("tarefas").insert({
        paciente_id: pacienteId,
        titulo: titulo.trim(),
        descricao: descricao || null,
        prazo: prazo || null,
        prioridade,
        status: "a_fazer",
        origem: "manual",
        criador_id: user?.id ?? null,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Tarefa criada");
      setTitulo(""); setDescricao(""); setPrazo(""); setPrioridade("media");
      onOpenChange(false); onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
