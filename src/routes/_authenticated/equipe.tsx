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
import { toast } from "sonner";
import { UserPlus, Copy, Link2, Ban, Loader2, ShieldCheck, Users, Pencil, Trash2, Stethoscope, KeyRound } from "lucide-react";
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
