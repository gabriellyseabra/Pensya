import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SessaoDialog } from "@/components/prontuario/SessaoDialog";
import {
  Plus, FlaskConical, Target as TargetIcon, CalendarCheck2, ListTodo,
  FileUp, Sparkles, ChevronDown,
} from "lucide-react";

const TIPOS_FREQUENCIA = [
  { value: "presente", label: "Presente" },
  { value: "falta_justificada", label: "Falta justificada" },
  { value: "falta_nao_justificada", label: "Falta não justificada" },
  { value: "reposicao", label: "Reposição" },
  { value: "cancelado_profissional", label: "Cancelado pelo profissional" },
];

export interface PacienteWorkflowActionsProps {
  pacienteId: string;
  /** "bar" para barra no header, "fab" para botão flutuante. */
  variant?: "bar" | "fab";
}

export function PacienteWorkflowActions({ pacienteId, variant = "bar" }: PacienteWorkflowActionsProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [openSessao, setOpenSessao] = useState<null | "avaliacao" | "intervencao">(null);
  const [openFreq, setOpenFreq] = useState(false);
  const [openTarefa, setOpenTarefa] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prontuario-sessoes", pacienteId] });
    qc.invalidateQueries({ queryKey: ["frequencia", pacienteId] });
    qc.invalidateQueries({ queryKey: ["evolucao-sessoes", pacienteId] });
    qc.invalidateQueries({ queryKey: ["evolucao-frequencia", pacienteId] });
    qc.invalidateQueries({ queryKey: ["paciente-tarefas", pacienteId] });
  };

  const actions = (
    <>
      <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
        Registrar sessão
      </DropdownMenuLabel>
      <DropdownMenuItem onClick={() => setOpenSessao("intervencao")}>
        <TargetIcon className="mr-2 h-4 w-4 text-brand" />
        Sessão de intervenção
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setOpenSessao("avaliacao")}>
        <FlaskConical className="mr-2 h-4 w-4 text-brand" />
        Sessão de avaliação
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
        Ações rápidas
      </DropdownMenuLabel>
      <DropdownMenuItem onClick={() => setOpenFreq(true)}>
        <CalendarCheck2 className="mr-2 h-4 w-4" /> Registrar frequência
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setOpenTarefa(true)}>
        <ListTodo className="mr-2 h-4 w-4" /> Nova tarefa
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate({
        to: "/pacientes/$id", params: { id: pacienteId }, hash: "documentos" as any,
      } as any)}>
        <FileUp className="mr-2 h-4 w-4" /> Documentos
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      {variant === "bar" ? (
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setOpenSessao("intervencao")}>
            <TargetIcon className="mr-2 h-4 w-4" /> Intervenção
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenSessao("avaliacao")}>
            <FlaskConical className="mr-2 h-4 w-4" /> Avaliação
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenFreq(true)}>
            <CalendarCheck2 className="mr-2 h-4 w-4" /> Frequência
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                Mais <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setOpenTarefa(true)}>
                <ListTodo className="mr-2 h-4 w-4" /> Nova tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({
                to: "/pacientes/$id", params: { id: pacienteId },
              } as any)}>
                <FileUp className="mr-2 h-4 w-4" /> Documentos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        // FAB
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg gradient-brand text-brand-foreground z-40"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-60">
            {actions}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {openSessao && (
        <SessaoDialog
          open={!!openSessao}
          onOpenChange={(v) => !v && setOpenSessao(null)}
          pacienteId={pacienteId}
          tipo={openSessao}
          onSaved={invalidate}
        />
      )}
      <RegistrarFrequenciaDialog
        open={openFreq}
        onOpenChange={setOpenFreq}
        pacienteId={pacienteId}
        onSaved={invalidate}
      />
      <NovaTarefaDialog
        open={openTarefa}
        onOpenChange={setOpenTarefa}
        pacienteId={pacienteId}
        onSaved={invalidate}
      />
    </>
  );
}

// =================== Frequência ===================
function RegistrarFrequenciaDialog({
  open, onOpenChange, pacienteId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; pacienteId: string; onSaved: () => void }) {
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tipo, setTipo] = useState("falta_justificada");
  const [motivo, setMotivo] = useState("");
  const [repostoEm, setRepostoEm] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("frequencia").insert({
        paciente_id: pacienteId,
        data_referencia: data,
        tipo,
        motivo: motivo || null,
        reposto_em: repostoEm || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Frequência registrada");
      onOpenChange(false); onSaved(); setMotivo(""); setRepostoEm("");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar frequência</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_FREQUENCIA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo / observação</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {tipo === "reposicao" && (
            <div>
              <Label>Data da reposição</Label>
              <Input type="date" value={repostoEm} onChange={(e) => setRepostoEm(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Nova tarefa rápida ===================
function NovaTarefaDialog({
  open, onOpenChange, pacienteId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; pacienteId: string; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
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
        titulo,
        prazo: prazo || null,
        prioridade,
        status: "a_fazer",
        origem: "manual",
        criador_id: user?.id ?? null,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Tarefa criada");
      setTitulo(""); setPrazo("");
      onOpenChange(false); onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Solicitar laudo para escola" />
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
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Criar tarefa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
