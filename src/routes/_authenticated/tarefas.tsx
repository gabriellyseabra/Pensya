import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Briefcase, DollarSign, Megaphone, Handshake, Package, Users, ListChecks, AlertTriangle, Flame } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { DataDrawer } from "@/components/shared/DataDrawer";
import { PageHero } from "@/components/shared/PageHero";
import { TwoColumn, PanelCard, BigStatCard, StatTile, NotifRow } from "@/components/shared/panels";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

const DEPARTAMENTOS = [
  { value: "gestao", label: "Gestão", icon: Briefcase },
  { value: "financeiro", label: "Financeiro", icon: DollarSign },
  { value: "marketing", label: "Marketing", icon: Megaphone },
  { value: "comercial", label: "Comercial", icon: Handshake },
  { value: "produtos", label: "Produtos", icon: Package },
  { value: "pacientes", label: "Pacientes", icon: Users },
] as const;

type DepartamentoValue = (typeof DEPARTAMENTOS)[number]["value"];

function TarefasPage() {
  const [statusFilter, setStatusFilter] = useState<"todas" | "abertas" | "concluidas">("abertas");
  const [depFilter, setDepFilter] = useState<DepartamentoValue | "todos">("todos");
  const [selected, setSelected] = useState<any | null>(null);
  const qc = useQueryClient();
  const { isTerapeutaRestrito } = useRoles();

  const { data: tarefas } = useQuery({
    queryKey: ["tarefas", statusFilter, depFilter, isTerapeutaRestrito],
    queryFn: async () => {
      let q = supabase
        .from("tarefas")
        .select("*, paciente:pacientes(id, nome), lead:leads(id, nome)")
        .is("sessao_id", null) // Exclui tarefas de sessão (orientações "para casa")
        .order("prazo", { ascending: true, nullsFirst: false });
      if (statusFilter === "abertas") q = q.neq("status", "concluida");
      if (statusFilter === "concluidas") q = q.eq("status", "concluida");
      if (depFilter !== "todos") q = q.eq("departamento", depFilter);
      // Terapeuta só vê tarefas atribuídas a ela (ou criadas por ela).
      if (isTerapeutaRestrito) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) q = q.or(`responsavel_id.eq.${user.id},criador_id.eq.${user.id}`);
      }
      const { data } = await q;

      // Calcula status "atrasado" automaticamente
      const hoje = format(new Date(), "yyyy-MM-dd");
      return (data ?? []).map((t: any) => ({
        ...t,
        status_calculado: t.status === "concluida" ? "concluida" :
                         (t.prazo && t.prazo < hoje) ? "atrasado" :
                         t.status,
      }));
    },
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: concluida ? "concluida" : "pendente",
          concluida_em: concluida ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  const deleteTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa excluída");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Contagem por departamento
  const { data: contagemDep } = useQuery({
    queryKey: ["tarefas-contagem-dep", isTerapeutaRestrito],
    queryFn: async () => {
      let cq = supabase
        .from("tarefas")
        .select("departamento, status")
        .is("sessao_id", null)
        .neq("status", "concluida");
      if (isTerapeutaRestrito) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) cq = cq.or(`responsavel_id.eq.${user.id},criador_id.eq.${user.id}`);
      }
      const { data } = await cq;
      const map = new Map<string, number>();
      (data ?? []).forEach((t: any) => {
        const k = t.departamento ?? "sem";
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      return map;
    },
  });

  const hojeStr = format(new Date(), "yyyy-MM-dd");
  const abertas = (tarefas ?? []).filter((t: any) => t.status !== "concluida");
  const vencidas = abertas.filter((t: any) => t.prazo && t.prazo < hojeStr).length;
  const altaPrioridade = abertas.filter((t: any) => t.prioridade === "alta").length;

  return (
    <div className="space-y-6">
      <PageHero
        icon={ListChecks}
        eyebrow="Organização"
        title="Tarefas"
        description="Priorize o que importa e mantenha cada área da clínica em dia."
        variant="brand"
        actions={
          <>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <TabsList className="bg-white/15 text-brand-foreground">
                <TabsTrigger value="abertas">Abertas</TabsTrigger>
                <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
                <TabsTrigger value="todas">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
            <NovaTarefaDialog onCreated={() => qc.invalidateQueries({ queryKey: ["tarefas"] })} />
          </>
        }
      />

      <TwoColumn side={<TarefasSidePanel contagemDep={contagemDep} abertas={abertas} />}>
        {/* Visão modular */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BigStatCard
            label="Tarefas abertas"
            value={abertas.length}
            icon={ListChecks}
            bars={DEPARTAMENTOS.map((d) => ({ value: contagemDep?.get(d.value) ?? 0 }))}
            hint="Distribuição por departamento"
            delay={60}
          />
          <div className="animate-fade-up card-lift soft-card p-5" style={{ animationDelay: "120ms" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Prioridades</span>
              <Flame className="h-4 w-4 text-lilac" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={AlertTriangle} value={vencidas} label="Vencidas" />
              <StatTile icon={Flame} value={altaPrioridade} label="Alta prioridade" />
            </div>
          </div>
          <div className="animate-fade-up card-lift soft-card p-5" style={{ animationDelay: "180ms" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Nesta visão</span>
              <Briefcase className="h-4 w-4 text-lilac" />
            </div>
            <p className="text-3xl font-semibold leading-none">{tarefas?.length ?? 0}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {statusFilter === "abertas"
                ? "Tarefas em aberto"
                : statusFilter === "concluidas"
                  ? "Tarefas concluídas"
                  : "Todas as tarefas"}
              {depFilter !== "todos" ? ` · ${labelDep(depFilter)}` : ""}
            </p>
          </div>
        </div>

        {/* Filtro por departamento (chips) */}
        <div className="flex flex-wrap gap-2">
          <Chip active={depFilter === "todos"} onClick={() => setDepFilter("todos")}>
            Todos
          </Chip>
          {DEPARTAMENTOS.map((d) => {
            const count = contagemDep?.get(d.value) ?? 0;
            const Icon = d.icon;
            return (
              <Chip key={d.value} active={depFilter === d.value} onClick={() => setDepFilter(d.value)}>
                <Icon className="w-3.5 h-3.5" />
                {d.label}
                {count > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{count}</Badge>}
              </Chip>
            );
          })}
        </div>

        <div className="space-y-2">
        {tarefas?.length === 0 && (
          <Card className="glass p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</Card>
        )}
        {tarefas?.map((t: any, i: number) => {
          const statusColor = t.status_calculado === "concluida" ? "success" :
                             t.status_calculado === "atrasado" ? "destructive" :
                             "outline";
          const statusLabel = t.status_calculado === "concluida" ? "Feito" :
                             t.status_calculado === "atrasado" ? "Atrasado" :
                             "Pendente";

          return (
            <Card
              key={t.id}
              className="glass card-lift animate-fade-up p-4 flex items-center gap-3 cursor-pointer"
              style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              onClick={() => setSelected(t)}
            >
              <Checkbox
                checked={t.status === "concluida"}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(c) => toggleTarefa.mutate({ id: t.id, concluida: !!c })}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                  {t.titulo}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {t.departamento ? `${labelDep(t.departamento)} · ` : ""}
                  {t.paciente?.nome ? `${t.paciente.nome} · ` : ""}
                  {t.lead?.nome ? `Lead: ${t.lead.nome} · ` : ""}
                  {t.prazo ? `Prazo ${format(parseISO(t.prazo), "dd/MM/yyyy")}` : "Sem prazo"}
                  {t.origem && t.origem !== "manual" ? ` · ${t.origem}` : ""}
                </p>
              </div>
              <Badge variant={statusColor}>
                {statusLabel}
              </Badge>
              <Badge variant={t.prioridade === "alta" ? "destructive" : t.prioridade === "baixa" ? "secondary" : "outline"}>
                {t.prioridade}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Excluir tarefa?")) {
                    deleteTarefa.mutate(t.id);
                  }
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          );
        })}
        </div>
      </TwoColumn>

      <TarefaDrawer
        tarefa={selected}
        onClose={() => setSelected(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["tarefas"] })}
      />
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "gradient-brand text-white shadow-soft"
          : "bg-background/60 hover:bg-accent border border-border"
      }`}
    >
      {children}
    </button>
  );
}

function labelDep(v: string) {
  return DEPARTAMENTOS.find((d) => d.value === v)?.label ?? v;
}

function TarefasSidePanel({
  contagemDep,
  abertas,
}: {
  contagemDep?: Map<string, number>;
  abertas: any[];
}) {
  const deps = DEPARTAMENTOS.map((d) => ({
    ...d,
    count: contagemDep?.get(d.value) ?? 0,
  })).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...deps.map((d) => d.count));
  const altaList = abertas.filter((t) => t.prioridade === "alta").slice(0, 5);

  return (
    <>
      <PanelCard title="Por departamento" icon={Briefcase} delay={80}>
        <div className="space-y-2.5">
          {deps.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.value}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Icon className="h-3.5 w-3.5 text-lilac" /> {d.label}
                  </span>
                  <span className="text-muted-foreground">{d.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-lilac-soft/50">
                  <div
                    className="h-full rounded-full bg-lilac"
                    style={{ width: `${(d.count / max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>

      <PanelCard title="Alta prioridade" icon={Flame} delay={140}>
        {altaList.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma tarefa de alta prioridade ✨</p>
        ) : (
          <div className="space-y-1">
            {altaList.map((t) => (
              <NotifRow
                key={t.id}
                leading={
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                    <Flame className="h-4 w-4" />
                  </span>
                }
                title={t.titulo}
                subtitle={
                  (t.departamento ? `${labelDep(t.departamento)}` : "Sem depto.") +
                  (t.prazo ? ` · ${format(parseISO(t.prazo), "dd/MM")}` : "")
                }
              />
            ))}
          </div>
        )}
      </PanelCard>
    </>
  );
}

function NovaTarefaDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", paciente_id: "", prazo: "",
    prioridade: "media", departamento: "" as string, responsavel_id: "",
  });

  const { data: pacientes } = useQuery({
    queryKey: ["pac-mini-t"],
    queryFn: async () => (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });

  // Membros da equipe (para atribuir a tarefa a um responsável).
  const { data: membros } = useQuery({
    queryKey: ["tarefa-membros"],
    queryFn: async () => {
      const { data: orgId } = await supabase.rpc("my_org_id");
      if (!orgId) return [];
      const { data: m } = await supabase
        .from("organizacao_membros").select("user_id").eq("org_id", orgId).eq("ativo", true);
      const ids = (m ?? []).map((x) => x.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids).order("nome");
      return profs ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("tarefas").insert({
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        paciente_id: form.paciente_id || null,
        prazo: form.prazo || null,
        prioridade: form.prioridade,
        departamento: form.departamento || null,
        responsavel_id: form.responsavel_id || null,
        origem: "manual",
        criador_id: user?.id ?? null,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada!");
      setOpen(false);
      setForm({ titulo: "", descricao: "", paciente_id: "", prazo: "", prioridade: "media", departamento: "", responsavel_id: "" });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Departamento</Label>
              <Select value={form.departamento} onValueChange={(v) => setForm({ ...form, departamento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paciente (opcional)</Label>
              <Select value={form.paciente_id} onValueChange={(v) => setForm({ ...form, paciente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem paciente" /></SelectTrigger>
                <SelectContent>{pacientes?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Responsável (quem vai executar)</Label>
            <Select value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sem responsável definido" /></SelectTrigger>
              <SelectContent>{(membros ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome || "—"}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">Terapeutas só veem as tarefas atribuídas a elas.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.titulo || mutation.isPending}
            className="gradient-brand text-brand-foreground"
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TarefaDrawer({
  tarefa, onClose, onChanged,
}: { tarefa: any | null; onClose: () => void; onChanged: () => void }) {
  const open = !!tarefa;

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!tarefa) return;
      const { error } = await supabase.from("tarefas").delete().eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa excluída");
      onChanged();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!tarefa) return;
      const { error } = await (supabase.from("tarefas") as any).update(patch).eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizada");
      onChanged();
    },
  });

  if (!tarefa) return null;

  return (
    <DataDrawer
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={tarefa.titulo}
      description={tarefa.descricao || undefined}
      width="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate()}>
            <Trash2 className="w-4 h-4 mr-1" />Excluir
          </Button>
          <Button onClick={onClose} className="gradient-brand text-brand-foreground">Fechar</Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <Row label="Status">
          <Select
            value={tarefa.status}
            onValueChange={(v) =>
              updateMut.mutate({
                status: v,
                concluida_em: v === "concluida" ? new Date().toISOString() : null,
              })
            }
          >
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_progresso">Em progresso</SelectItem>
              <SelectItem value="concluida">Feito</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Departamento">
          <Select
            value={tarefa.departamento ?? ""}
            onValueChange={(v) => updateMut.mutate({ departamento: v })}
          >
            <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {DEPARTAMENTOS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Prioridade">
          <Select
            value={tarefa.prioridade}
            onValueChange={(v) => updateMut.mutate({ prioridade: v })}
          >
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Prazo">
          <Input
            type="date"
            className="h-8 w-[180px]"
            defaultValue={tarefa.prazo ?? ""}
            onBlur={(e) => updateMut.mutate({ prazo: e.target.value || null })}
          />
        </Row>
        <Row label="Origem">
          <Badge variant="outline">{tarefa.origem ?? "manual"}</Badge>
        </Row>
        {tarefa.paciente && (
          <Row label="Paciente">
            <span>{tarefa.paciente.nome}</span>
          </Row>
        )}
        {tarefa.lead && (
          <Row label="Lead">
            <span>{tarefa.lead.nome}</span>
          </Row>
        )}
        <Row label="Criada em">
          <span className="text-muted-foreground">
            {tarefa.created_at ? format(parseISO(tarefa.created_at), "dd/MM/yyyy 'às' HH:mm") : "—"}
          </span>
        </Row>
      </div>
    </DataDrawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
