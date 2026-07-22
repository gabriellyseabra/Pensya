import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UserPlus, Copy, Link2, Ban, Loader2, ShieldCheck, Users, Pencil, Trash2, Stethoscope, KeyRound, Plus, Mail, Phone, Briefcase, Wallet, LayoutGrid } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import { PageHero } from "@/components/shared/PageHero";
import { cn } from "@/lib/utils";
import { TwoColumn, PanelCard, StatTile } from "@/components/shared/panels";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

const ROLES = ["admin", "profissional", "secretaria"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  profissional: "Terapeuta",
  secretaria: "Secretaria",
};

function EquipePage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const { data: especialidades } = useQuery({
    queryKey: ["especialidades-equipe"],
    queryFn: async () =>
      (await supabase.from("especialidades").select("id, nome").order("nome")).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["equipe"],
    queryFn: async () => {
      // Escopa a equipe aos membros da organização atual (organizacao_membros),
      // não a todos os profiles do sistema — assim a pensya_admin que está só
      // "visitando" a clínica não aparece como membro.
      const { data: orgId } = await supabase.rpc("my_org_id");
      if (!orgId) return [];
      const { data: membros } = await supabase
        .from("organizacao_membros")
        .select("user_id, papel")
        .eq("org_id", orgId)
        .eq("ativo", true);
      const ids = (membros ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const [{ data: profiles }, { data: profs }] = await Promise.all([
        supabase.from("profiles").select("*").in("id", ids),
        supabase
          .from("profissionais_consultorio")
          .select("id, user_id, especialidade_id, cor, email")
          .not("user_id", "is", null),
      ]);
      return (membros ?? []).map((m) => {
        const p: any = (profiles ?? []).find((x) => x.id === m.user_id) ?? { id: m.user_id, nome: "—" };
        const prof = (profs ?? []).find((x: any) => x.user_id === m.user_id);
        return {
          ...p,
          roles: [m.papel],
          prof_id: prof?.id ?? null,
          especialidade_id: prof?.especialidade_id ?? null,
          cor: prof?.cor ?? null,
          email: prof?.email ?? null,
        };
      });
    },
  });

  const especialidadeNome = (id: string | null) =>
    (especialidades ?? []).find((e) => e.id === id)?.nome ?? null;

  const [editing, setEditing] = useState<any | null>(null);

  const removerMembro = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).rpc("equipe_remover_membro", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      toast.success("Membro removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: convites } = useQuery({
    queryKey: ["equipe-convites"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("convites_equipe")
        .select("id, token, nome, email, role, criado_em, expira_em, revogado, usado_em")
        .is("usado_em", null)
        .eq("revogado", false)
        .order("criado_em", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: (typeof ROLES)[number] }) => {
      // Papel dentro da organização = organizacao_membros.papel (o que has_role
      // usa no banco e o que o menu passa a ler).
      const { error } = await supabase
        .from("organizacao_membros")
        .update({ papel: role })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      toast.success("Papel atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revogar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("convites_equipe")
        .update({ revogado: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe-convites"] });
      toast.success("Convite revogado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function linkDoConvite(token: string) {
    return `${window.location.origin}/equipe/convite/${token}`;
  }
  async function copiarLink(token: string) {
    await navigator.clipboard.writeText(linkDoConvite(token));
    toast.success("Link copiado — envie para a pessoa");
  }

  const totalMembros = members?.length ?? 0;
  const admins = (members ?? []).filter((m) => m.roles.includes("admin")).length;

  return (
    <div className="space-y-6">
      <PageHero
        icon={Users}
        eyebrow="Trabalhar em equipe é sempre melhor"
        title="Equipe"
        description="Membros com acesso ao sistema. O admin cria o cadastro e envia o link para a pessoa criar a senha e enviar a foto."
        actions={
          isAdmin && (
            <NovoMembroDialog
              onCreated={() => qc.invalidateQueries({ queryKey: ["equipe-convites"] })}
            />
          )
        }
        visual={
          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex items-center">
              {(members ?? []).slice(0, 6).map((m, i) => (
                <Avatar
                  key={m.id}
                  className={cn(
                    "h-12 w-12 ring-2 ring-white/70 transition-transform hover:-translate-y-1",
                    i > 0 && "-ml-3",
                  )}
                >
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="gradient-brand text-xs text-brand-foreground">
                    {m.nome
                      ?.split(" ")
                      .map((s: string) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              ))}
              {totalMembros > 6 && (
                <span className="-ml-3 grid h-12 w-12 place-items-center rounded-full bg-white/70 text-xs font-semibold text-lilac-foreground ring-2 ring-white/70">
                  +{totalMembros - 6}
                </span>
              )}
            </div>
            <div className="flex gap-2.5">
              <div className="rounded-2xl bg-white/60 px-4 py-2 text-center text-lilac-foreground ring-1 ring-white/30 backdrop-blur">
                <p className="text-xl font-semibold leading-none">{totalMembros}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Membros</p>
              </div>
              <div className="rounded-2xl bg-white/60 px-4 py-2 text-center text-lilac-foreground ring-1 ring-white/30 backdrop-blur">
                <p className="text-xl font-semibold leading-none">{admins}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Admins</p>
              </div>
            </div>
          </div>
        }
      />

      <Tabs defaultValue="membros">
        <TabsList className="glass h-auto flex-wrap">
          <TabsTrigger value="membros" className="gap-1.5"><Users className="h-3.5 w-3.5" />Membros</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Por especialidade</TabsTrigger>
          <TabsTrigger value="especialidades" className="gap-1.5"><Stethoscope className="h-3.5 w-3.5" />Especialidades</TabsTrigger>
          <TabsTrigger value="externos" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" />Profissionais externos</TabsTrigger>
        </TabsList>

        <TabsContent value="membros" className="mt-4">
      <TwoColumn
        side={
          <>
            <PanelCard title="Composição da equipe" icon={ShieldCheck} delay={80}>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <StatTile
                    key={r}
                    value={(members ?? []).filter((m) => m.roles.includes(r)).length}
                    label={ROLE_LABEL[r]}
                  />
                ))}
              </div>
            </PanelCard>

            {isAdmin && convites && convites.length > 0 && (
              <PanelCard title="Convites pendentes" icon={Link2} delay={140}>
                <div className="space-y-2">
                  {convites.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-border/50 bg-background/40 p-3"
                    >
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ROLE_LABEL[c.role] ?? c.role} · expira{" "}
                        {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copiarLink(c.token)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => revogar.mutate(c.id)}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" /> Revogar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </PanelCard>
            )}
          </>
        }
      >
      {/* Membros */}
      <div className="grid gap-3">
        {members?.map((m, i) => (
          <Card
            key={m.id}
            className="glass card-lift animate-fade-up flex items-center gap-4 p-4"
            style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}
          >
            <Avatar className="h-12 w-12">
              {m.avatar_url && <AvatarImage src={m.avatar_url} />}
              <AvatarFallback className="gradient-brand text-brand-foreground">
                {m.nome
                  ?.split(" ")
                  .map((s: string) => s[0])
                  .slice(0, 2)
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{m.nome || <span className="text-muted-foreground">Sem nome</span>}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {m.roles.length === 0 && <Badge variant="outline">Sem papel</Badge>}
                {m.roles.map((r: string) => (
                  <Badge key={r} variant="secondary">
                    {ROLE_LABEL[r] ?? r}
                  </Badge>
                ))}
                {especialidadeNome(m.especialidade_id) && (
                  <Badge
                    variant="outline"
                    className="gap-1"
                    style={m.cor ? { borderColor: m.cor, color: m.cor } : undefined}
                  >
                    <Stethoscope className="h-3 w-3" />
                    {especialidadeNome(m.especialidade_id)}
                  </Badge>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  value={m.roles[0] || ""}
                  onValueChange={(v) =>
                    setRole.mutate({ userId: m.id, role: v as (typeof ROLES)[number] })
                  }
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Definir papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  title={m.email ? "Redefinir senha / reenviar acesso" : "Sem e-mail vinculado"}
                  disabled={!m.email}
                  onClick={async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(m.email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(error.message);
                    else toast.success(`E-mail de acesso enviado para ${m.email}`);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" title="Editar" onClick={() => setEditing(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remover da equipe"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        `Remover ${m.nome || "este membro"} da equipe? Ele perderá o acesso ao sistema.`,
                      )
                    )
                      removerMembro.mutate(m.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      </TwoColumn>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardEspecialidades especialidades={especialidades ?? []} />
        </TabsContent>

        <TabsContent value="especialidades" className="mt-4">
          <EspecialidadesCrud isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="externos" className="mt-4">
          <ProfissionaisExternos isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      <EditarMembroDialog
        membro={editing}
        especialidades={especialidades ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["equipe"] })}
      />
    </div>
  );
}

function EditarMembroDialog({
  membro,
  especialidades,
  onClose,
  onSaved,
}: {
  membro: any | null;
  especialidades: { id: string; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState<string>("__none__");
  const [cor, setCor] = useState<string>("#5585b1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (membro) {
      setNome(membro.nome ?? "");
      setEspecialidadeId(membro.especialidade_id ?? "__none__");
      setCor(membro.cor ?? "#5585b1");
    }
  }, [membro]);

  async function salvar() {
    if (!membro) return;
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const { error: e1 } = await supabase
        .from("profiles")
        .update({ nome: nome.trim() })
        .eq("id", membro.id);
      if (e1) throw e1;

      const espId = especialidadeId === "__none__" ? null : especialidadeId;
      if (membro.prof_id) {
        const { error: e2 } = await supabase
          .from("profissionais_consultorio")
          .update({ nome: nome.trim(), especialidade_id: espId, cor })
          .eq("id", membro.prof_id);
        if (e2) throw e2;
      }
      toast.success("Membro atualizado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!membro} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Especialidade</Label>
            <Select value={especialidadeId} onValueChange={setEspecialidadeId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem especialidade</SelectItem>
                {especialidades.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!membro?.prof_id && (
              <p className="text-[11px] text-muted-foreground">
                Especialidade e cor se aplicam a profissionais vinculados à agenda.
              </p>
            )}
          </div>
          {membro?.prof_id && (
            <div className="space-y-1.5">
              <Label>Cor na agenda</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-card"
                />
                <span className="text-sm text-muted-foreground">{cor}</span>
              </div>
            </div>
          )}
          {membro?.prof_id && <RemuneracaoConfig profId={membro.prof_id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoMembroDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("profissional");
  const [registro, setRegistro] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const { data: especialidades } = useQuery({
    queryKey: ["especialidades-equipe"],
    queryFn: async () =>
      (await supabase.from("especialidades").select("id, nome").order("nome")).data ?? [],
  });

  async function criar() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const token =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("convites_equipe").insert({
        token,
        nome: nome.trim(),
        email: email.trim() || null,
        role,
        registro_profissional: registro.trim() || null,
        especialidade_id:
          role === "profissional" && especialidadeId !== "__none__" ? especialidadeId : null,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
      setLink(`${window.location.origin}/equipe/convite/${token}`);
      onCreated();
      toast.success("Convite criado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar convite");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setNome("");
    setEmail("");
    setRole("profissional");
    setRegistro("");
    setEspecialidadeId("__none__");
    setLink(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-1.5 h-4 w-4" /> Adicionar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo membro da equipe</DialogTitle>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Convite criado! Envie este link para a pessoa criar a senha e enviar a foto:</p>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Criar outro
              </Button>
              <Button onClick={() => setOpen(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="para vincular ao cadastro"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as (typeof ROLES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {role === "profissional" && (
                <div className="space-y-1.5">
                  <Label>Registro profissional</Label>
                  <Input
                    value={registro}
                    onChange={(e) => setRegistro(e.target.value)}
                    placeholder="opcional"
                  />
                </div>
              )}
            </div>
            {role === "profissional" && (
              <div className="space-y-1.5">
                <Label>Especialidade</Label>
                <Select value={especialidadeId} onValueChange={setEspecialidadeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem especialidade</SelectItem>
                    {(especialidades ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {role === "profissional" && (
              <p className="text-xs text-muted-foreground">
                Terapeutas têm acesso apenas à Agenda e aos Pacientes.
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={criar} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar link de convite
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============== REMUNERAÇÃO (conecta à Folha) ============== */
const FORMAS_REPASSE_EQUIPE = [
  { value: "fixo_mensal", label: "Valor fixo mensal" },
  { value: "por_sessao", label: "Por sessão" },
  { value: "por_paciente", label: "Por paciente" },
  { value: "percentual", label: "Percentual sobre receita" },
];

function RemuneracaoConfig({ profId }: { profId: string }) {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("colaborador_config")
      .select("*")
      .eq("profissional_id", profId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setCfg(data ?? { forma_repasse: "por_sessao", vinculo: "autonomo", salario_base: 0, valor_por_sessao: 0, comissao_percentual: 0 });
        setLoading(false);
      });
    return () => { active = false; };
  }, [profId]);

  if (loading || !cfg) {
    return <div className="rounded-lg border p-3 text-xs text-muted-foreground">Carregando remuneração…</div>;
  }

  const forma = cfg.forma_repasse ?? "por_sessao";
  const set = (patch: any) => setCfg({ ...cfg, ...patch });

  async function salvar() {
    setSaving(true);
    try {
      const payload = {
        profissional_id: profId,
        forma_repasse: forma,
        vinculo: cfg.vinculo ?? "autonomo",
        salario_base: Number(cfg.salario_base || 0),
        valor_por_sessao: Number(cfg.valor_por_sessao || 0),
        comissao_percentual: Number(cfg.comissao_percentual || 0),
      };
      const { error } = await supabase.from("colaborador_config").upsert(payload, { onConflict: "profissional_id" });
      if (error) throw error;
      toast.success("Remuneração salva — já vale na Folha");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-brand" />
        <Label className="text-sm">Forma de remuneração (folha de pagamento)</Label>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Forma de repasse</Label>
        <Select value={forma} onValueChange={(v) => set({ forma_repasse: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMAS_REPASSE_EQUIPE.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {forma === "fixo_mensal" && (
        <div>
          <Label className="text-xs text-muted-foreground">Valor fixo mensal (R$)</Label>
          <Input type="number" step="0.01" value={cfg.salario_base ?? 0} onChange={(e) => set({ salario_base: Number(e.target.value) })} />
        </div>
      )}
      {forma === "por_sessao" && (
        <div>
          <Label className="text-xs text-muted-foreground">Valor por sessão (R$)</Label>
          <Input type="number" step="0.01" value={cfg.valor_por_sessao ?? 0} onChange={(e) => set({ valor_por_sessao: Number(e.target.value) })} />
        </div>
      )}
      {forma === "percentual" && (
        <div>
          <Label className="text-xs text-muted-foreground">% sobre a receita</Label>
          <Input type="number" step="0.01" value={cfg.comissao_percentual ?? 0} onChange={(e) => set({ comissao_percentual: Number(e.target.value) })} />
        </div>
      )}
      {forma === "por_paciente" && (
        <p className="text-[11px] text-muted-foreground">
          Os valores por paciente são definidos em <strong>Financeiro › Folha › Configurar</strong>, onde cada paciente recebe um valor por sessão ou fixo no mês.
        </p>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Vínculo</Label>
        <Select value={cfg.vinculo ?? "autonomo"} onValueChange={(v) => set({ vinculo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
            <SelectItem value="autonomo">Autônomo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button size="sm" variant="outline" onClick={salvar} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Salvar remuneração
      </Button>
    </div>
  );
}

/* ============== DASHBOARD POR ESPECIALIDADE ============== */
function DashboardEspecialidades({ especialidades }: { especialidades: { id: string; nome: string }[] }) {
  const { data: profs } = useQuery({
    queryKey: ["equipe-por-especialidade"],
    queryFn: async () => {
      const { data: pc } = await supabase
        .from("profissionais_consultorio")
        .select("id, nome, user_id, especialidade_id, cor, email, ativo")
        .eq("ativo", true)
        .order("nome");
      const ids = (pc ?? []).map((p) => p.user_id).filter(Boolean) as string[];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids)
        : { data: [] as any[] };
      return (pc ?? []).map((p) => ({
        ...p,
        avatar_url: (profiles ?? []).find((x: any) => x.id === p.user_id)?.avatar_url ?? null,
      }));
    },
  });

  const lista = profs ?? [];
  const grupos = [
    ...especialidades.map((e) => ({ id: e.id, nome: e.nome, membros: lista.filter((p) => p.especialidade_id === e.id) })),
    { id: "__sem__", nome: "Sem especialidade", membros: lista.filter((p) => !p.especialidade_id) },
  ].filter((g) => g.membros.length > 0);

  if (lista.length === 0) {
    return <Card className="glass p-8 text-center text-muted-foreground">Nenhum profissional cadastrado ainda.</Card>;
  }

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <div key={g.id}>
          <div className="mb-2 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-brand" />
            <h3 className="font-semibold">{g.nome}</h3>
            <Badge variant="outline">{g.membros.length}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.membros.map((p: any) => (
              <Card key={p.id} className="glass card-lift flex items-center gap-3 p-4">
                <Avatar className="h-12 w-12" style={p.cor ? { boxShadow: `0 0 0 2px ${p.cor}` } : undefined}>
                  {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                  <AvatarFallback className="gradient-brand text-brand-foreground">
                    {(p.nome ?? "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nome}</p>
                  {p.email && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3" />{p.email}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============== ESPECIALIDADES (CRUD) ============== */
function EspecialidadesCrud({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const { data: rows } = useQuery({
    queryKey: ["config", "especialidades"],
    queryFn: async () => (await supabase.from("especialidades").select("*").order("nome")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("especialidades").insert({ nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); qc.invalidateQueries({ queryKey: ["config", "especialidades"] }); qc.invalidateQueries({ queryKey: ["especialidades-equipe"] }); toast.success("Especialidade adicionada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("especialidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config", "especialidades"] }); qc.invalidateQueries({ queryKey: ["especialidades-equipe"] }); toast.success("Removida"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Card className="glass p-5 space-y-4 max-w-xl">
      <div>
        <h3 className="font-medium">Especialidades</h3>
        <p className="text-sm text-muted-foreground">Áreas de atuação usadas para classificar os profissionais e colorir a agenda.</p>
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <Input placeholder="Ex.: Psicopedagogia, Fonoaudiologia…" value={novo} onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && novo.trim()) add.mutate(novo); }} />
          <Button onClick={() => novo.trim() && add.mutate(novo)} disabled={add.isPending} className="gradient-brand text-white">
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {(rows ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma especialidade cadastrada.</p>}
        {(rows ?? []).map((e: any) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-sm">{e.nome}</span>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm(`Remover "${e.nome}"?`)) del.mutate(e.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============== PROFISSIONAIS EXTERNOS (CRUD) ============== */
function ProfissionaisExternos({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const { data: rows } = useQuery({
    queryKey: ["config", "profissionais_externos"],
    queryFn: async () => (await supabase.from("profissionais_externos").select("*").order("nome")).data ?? [],
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissionais_externos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config", "profissionais_externos"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-4">
      <Card className="glass p-4 text-sm">
        <p className="font-medium">O que são profissionais externos?</p>
        <p className="text-muted-foreground">
          Prestadores que apoiam o negócio mas não atendem pacientes — por exemplo <strong>Marketing, Comercial,
          Social media, Contabilidade, TI, Design</strong>. Ficam registrados aqui com contato e área de atuação,
          separados da equipe clínica.
        </p>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button className="gradient-brand text-white" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo profissional externo
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(rows ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum profissional externo cadastrado.</p>}
        {(rows ?? []).map((p: any) => (
          <Card key={p.id} className="glass p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.nome}</p>
                {p.observacoes && <Badge variant="outline" className="mt-1 gap-1"><Briefcase className="h-3 w-3" />{p.observacoes}</Badge>}
                <div className="mt-2 space-y-0.5">
                  {p.telefone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{p.telefone}</p>}
                  {p.email && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{p.email}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => { if (confirm(`Remover "${p.nome}"?`)) del.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <ExternoDialog open={open} onOpenChange={setOpen} editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["config", "profissionais_externos"] })} />
    </div>
  );
}

function ExternoDialog({ open, onOpenChange, editing, onSaved }: any) {
  const [form, setForm] = useState<any>({ nome: "", observacoes: "", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(editing ?? { nome: "", observacoes: "", telefone: "", email: "" });
  }, [open, editing]);

  async function salvar() {
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        observacoes: form.observacoes?.trim() || null,
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
      };
      if (editing?.id) {
        const { error } = await supabase.from("profissionais_externos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profissionais_externos").insert(payload);
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} profissional externo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Área / função</Label>
            <Input placeholder="Ex.: Marketing, Comercial, Social media…" value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
