import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock,
  Plus,
  Trash2,
  CalendarPlus,
  CheckCircle2,
  Phone,
  User,
  Stethoscope,
  Tags,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/lista-espera")({
  component: ListaEsperaPage,
});

type Item = {
  id: string;
  nome_contato: string | null;
  telefone: string | null;
  prioridade: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  paciente: { nome: string } | null;
  profissional: { nome: string } | null;
  convenio: { nome: string } | null;
};

function ListaEsperaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [open, setOpen] = useState(false);
  const queryKey = ["lista-espera", mostrarTodos];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("lista_espera")
        .select(
          `id, nome_contato, telefone, prioridade, status, observacoes, created_at,
           paciente:pacientes(nome),
           profissional:profissionais_consultorio(nome),
           convenio:convenios(nome)`,
        );
      if (!mostrarTodos) q = q.eq("status", "aguardando");
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      // Alta prioridade primeiro, depois por chegada.
      return ((data ?? []) as any[]).sort((a, b) => {
        const pa = a.prioridade === "alta" ? 0 : 1;
        const pb = b.prioridade === "alta" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }) as Item[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("lista_espera")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lista-espera"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lista_espera").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lista-espera"] }); toast.success("Removido da lista"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const aguardando = (rows ?? []).filter((r) => r.status === "aguardando").length;
  const alta = (rows ?? []).filter((r) => r.status === "aguardando" && r.prioridade === "alta").length;

  return (
    <div className="space-y-6">
      <PageHero
        icon={Clock}
        eyebrow="Pacientes"
        title="Lista de espera"
        description="Pessoas aguardando uma vaga na agenda — priorize e agende quando abrir horário."
        variant="lilac"
        stats={[
          { label: "Aguardando", value: aguardando, icon: Clock },
          { label: "Prioridade alta", value: alta, icon: User },
        ]}
        actions={
          <Button onClick={() => setOpen(true)} className="bg-white/80 text-lilac-foreground hover:bg-white">
            <Plus className="mr-2 h-4 w-4" />Adicionar à lista
          </Button>
        }
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows?.length ?? 0} {mostrarTodos ? "registros" : "aguardando"}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={mostrarTodos}
            onChange={(e) => setMostrarTodos(e.target.checked)}
          />
          Mostrar todos (inclui agendados e atendidos)
        </label>
      </div>

      <div className="space-y-2">
        {(rows?.length ?? 0) === 0 && (
          <Card className="glass">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Ninguém na lista de espera.
            </CardContent>
          </Card>
        )}
        {rows?.map((r) => {
          const nome = r.paciente?.nome ?? r.nome_contato ?? "Sem nome";
          return (
            <Card key={r.id} className="glass card-lift">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{nome}</p>
                    {r.prioridade === "alta" && (
                      <Badge className="bg-destructive text-destructive-foreground text-[10px]">Prioridade alta</Badge>
                    )}
                    {r.status !== "aguardando" && (
                      <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {r.telefone && (
                      <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.telefone}</span>
                    )}
                    {r.profissional?.nome && (
                      <Badge variant="outline" className="text-[10px]">
                        <Stethoscope className="mr-1 h-3 w-3" />{r.profissional.nome}
                      </Badge>
                    )}
                    {r.convenio?.nome && (
                      <Badge variant="outline" className="text-[10px] text-brand border-brand/40">
                        <Tags className="mr-1 h-3 w-3" />{r.convenio.nome}
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      esperando há {formatDistanceToNow(new Date(r.created_at), { locale: ptBR })}
                    </span>
                  </div>
                  {r.observacoes && <p className="text-xs text-muted-foreground">{r.observacoes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.status === "aguardando" && (
                    <>
                      <Button
                        size="sm"
                        className="gradient-brand text-brand-foreground"
                        onClick={() => {
                          setStatus.mutate({ id: r.id, status: "agendado" });
                          navigate({ to: "/agenda" });
                        }}
                      >
                        <CalendarPlus className="mr-1 h-4 w-4" />Agendar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "atendido" })}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />Atendido
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar à lista de espera</DialogTitle></DialogHeader>
          <NovoItemForm onSaved={() => { qc.invalidateQueries({ queryKey: ["lista-espera"] }); setOpen(false); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NovoItemForm({ onSaved }: { onSaved: () => void }) {
  const [pacienteId, setPacienteId] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: pacientes } = useQuery({
    queryKey: ["le-pacientes"],
    queryFn: async () => (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: profissionais } = useQuery({
    queryKey: ["le-profissionais"],
    queryFn: async () =>
      (await supabase.from("profissionais_consultorio").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: convenios } = useQuery({
    queryKey: ["le-convenios"],
    queryFn: async () =>
      (await supabase.from("convenios").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  async function salvar() {
    if (!pacienteId && !nomeContato.trim()) {
      toast.error("Escolha um paciente ou informe um nome de contato.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("lista_espera").insert({
        paciente_id: pacienteId || null,
        nome_contato: pacienteId ? null : nomeContato.trim() || null,
        telefone: telefone.trim() || null,
        profissional_id: profissionalId || null,
        convenio_id: convenioId || null,
        prioridade,
        observacoes: observacoes.trim() || null,
        status: "aguardando",
      });
      if (error) throw error;
      toast.success("Adicionado à lista");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Paciente já cadastrado</Label>
        <Select value={pacienteId || "__none__"} onValueChange={(v) => setPacienteId(v === "__none__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Não cadastrado —</SelectItem>
            {pacientes?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!pacienteId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome do contato</Label>
            <Input value={nomeContato} onChange={(e) => setNomeContato(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
      )}

      {pacienteId && (
        <div>
          <Label>Telefone (opcional)</Label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Profissional (opcional)</Label>
          <Select value={profissionalId || "__none__"} onValueChange={(v) => setProfissionalId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Qualquer</SelectItem>
              {profissionais?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Convênio (opcional)</Label>
          <Select value={convenioId || "__none__"} onValueChange={(v) => setConvenioId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {convenios?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Prioridade</Label>
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>

      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar
        </Button>
      </DialogFooter>
    </div>
  );
}
