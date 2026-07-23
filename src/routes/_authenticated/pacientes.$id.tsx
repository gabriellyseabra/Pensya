import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PacienteAcoesMenu } from "@/components/paciente/PacienteAcoesMenu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  User,
  FileText,
  Wallet,
  Pencil,
  Save,
  X,
  Upload,
  Plus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Briefcase,
  Heart,
  Baby,
  Activity,
  Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProntuarioTab } from "@/components/prontuario/ProntuarioTab";
import { FrequenciaTab } from "@/components/paciente/FrequenciaTab";
import { ANAMNESE_SECOES, campoVisivel } from "@/lib/anamnese-schema";
import { PlanoTab } from "@/components/prontuario/PlanoTab";
import { EvolucaoTab } from "@/components/prontuario/EvolucaoTab";
import { ResumoTab } from "@/components/paciente/ResumoTab";

import { PacienteWorkflowActions } from "@/components/paciente/PacienteWorkflowActions";
import { PerfilClinicoVivoTab } from "@/components/paciente/PerfilClinicoVivoTab";
import { AvaliacaoWizard } from "@/components/paciente/AvaliacaoWizard";
import { AdministrativoTab } from "@/components/paciente/AdministrativoTab";
import { DataDrawer } from "@/components/shared/DataDrawer";
import { ArquivosTab } from "@/components/paciente/ArquivosTab";
import { FichaCadastralTab } from "@/components/paciente/FichaCadastralTab";
import { PacienteTabsNav, resolverAba } from "@/components/paciente/PacienteTabsNav";
import { ImportarProntuarioTab } from "@/components/paciente/ImportarProntuarioTab";
import { BrainStateCard } from "@/components/paciente/BrainStateCard";
import { PACIENTE_STATUS, PACIENTE_STATUS_LABEL } from "@/lib/paciente-status";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/pacientes/$id")({
  validateSearch: (s: Record<string, unknown>): { aba?: string; sub?: string } => ({
    aba: typeof s.aba === "string" ? s.aba : undefined,
    sub: typeof s.sub === "string" ? s.sub : undefined,
  }),
  component: PacienteDetailPage,
});

type Paciente = Record<string, any>;
type Responsavel = Record<string, any>;

function PacienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Aba ativa na URL (?aba=&sub=) — permite deep-link e aceita valores legados.
  const search = Route.useSearch();
  const { aba: abaAtiva, sub: subClinico } = resolverAba(search.aba, search.sub);
  const irParaAba = (aba: string, sub?: string) =>
    navigate({ to: "/pacientes/$id", params: { id }, search: sub ? { aba, sub } : { aba } });
  const [adminSubTab, setAdminSubTab] = useState("financeiro");
  // Terapeuta não vê a aba Administrativo (dados financeiros do paciente).
  const { isTerapeutaRestrito: ehTerapeuta } = useRoles();

  const { data: paciente, isLoading } = useQuery({
    queryKey: ["paciente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select(
          `
          *,
          modalidade:modalidades!pacientes_modalidade_id_fkey(id, nome, cor),
          escola:escolas!pacientes_escola_id_fkey(id, nome),
          profissional_responsavel:profissionais_consultorio!pacientes_profissional_responsavel_id_fkey(id, nome),
          lead_origem:leads!pacientes_lead_origem_id_fkey(id, nome),
          canal_origem:canais_marketing!pacientes_canal_origem_id_fkey(id, nome),
          campanha_origem:campanhas!pacientes_campanha_origem_id_fkey(id, nome),
          responsaveis(*),
          paciente_diagnosticos(diagnostico:diagnosticos(nome))
        `,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) console.error("paciente fetch", error);
      return data as Paciente | null;
    },
  });

  const { data: preAnamnese } = useQuery({
    queryKey: ["paciente-pre-anamnese", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("paciente_pre_anamnese")
        .select("*")
        .eq("paciente_id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: modalidades } = useQuery({
    queryKey: ["modalidades-ativas"],
    queryFn: async () =>
      ((await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome"))
        .data ?? []) as { id: string; nome: string }[],
  });
  const { data: profissionais } = useQuery({
    queryKey: ["profissionais-ativos"],
    queryFn: async () =>
      ((
        await supabase
          .from("profissionais_consultorio")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome")
      ).data ?? []) as { id: string; nome: string }[],
  });
  const { data: escolas } = useQuery({
    queryKey: ["escolas-todas"],
    queryFn: async () =>
      ((await supabase.from("escolas").select("id, nome").order("nome")).data ?? []) as {
        id: string;
        nome: string;
      }[],
  });

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Paciente>({});
  const [resps, setResps] = useState<Responsavel[]>([]);
  const [signedFoto, setSignedFoto] = useState<string | null>(null);

  useEffect(() => {
    if (paciente && !editOpen) {
      setForm(paciente);
      setResps(paciente.responsaveis ?? []);
    }
  }, [paciente, editOpen]);

  // Resolve signed URL para foto quando necessário
  useEffect(() => {
    let cancel = false;
    async function resolve() {
      if (!paciente?.foto_path) {
        setSignedFoto(null);
        return;
      }
      const bucket = paciente.foto_path.startsWith("pacientes/")
        ? "pacientes-docs"
        : "cadastro-publico";
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(paciente.foto_path, 60 * 60);
      if (!cancel) setSignedFoto(data?.signedUrl ?? null);
    }
    resolve();
    return () => {
      cancel = true;
    };
  }, [paciente?.foto_path]);

  const salvar = useMutation({
    mutationFn: async () => {
      const allowed = [
        "nome",
        "data_nascimento",
        "genero",
        "cpf",
        "documento",
        "telefone",
        "email",
        "endereco",
        "escola_id",
        "escolaridade",
        "serie_curso",
        "contato_escola",
        "modalidade_id",
        "profissional_responsavel_id",
        "status",
        "motivo_status",
        "data_inicio",
        "data_ultima_avaliacao",
        "data_alta",
        "autoriza_imagem",
        "queixa_principal",
        "expectativas",
        "hipotese_diagnostica",
        "observacoes",
        "modelo_pagamento",
        "valor_acordado",
        "dia_vencimento",
        "numero_parcelas",
        "foto_url",
        "foto_path",
      ];
      const payload: any = {};
      for (const k of allowed) if (k in form) payload[k] = form[k] === "" ? null : form[k];
      const { error } = await supabase.from("pacientes").update(payload).eq("id", id);
      if (error) throw error;

      const originais = (paciente?.responsaveis ?? []) as Responsavel[];
      const idsAtuais = new Set(resps.filter((r) => r.id).map((r) => r.id));
      const removidos = originais.filter((o) => !idsAtuais.has(o.id)).map((o) => o.id);
      if (removidos.length) {
        await supabase.from("responsaveis").delete().in("id", removidos);
      }
      for (const r of resps) {
        const base: any = {
          paciente_id: id,
          nome: r.nome ?? "",
          parentesco: r.parentesco ?? null,
          telefone: r.telefone ?? null,
          email: r.email ?? null,
          documento: r.documento ?? null,
          idade: r.idade ? Number(r.idade) : null,
          profissao: r.profissao ?? null,
          estado_civil: r.estado_civil ?? null,
          principal: !!r.principal,
          deseja_nf: !!r.deseja_nf,
          dados_nf: r.dados_nf ?? null,
        };
        if (r.id) {
          await supabase.from("responsaveis").update(base).eq("id", r.id);
        } else {
          await supabase.from("responsaveis").insert(base);
        }
      }
    },
    onSuccess: () => {
      toast.success("Paciente atualizado");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["paciente", id] });
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
    onError: (e: any) => toast.error("Falha ao salvar: " + e.message),
  });

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máx 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie JPG ou PNG");
      return;
    }
    setUploadingFoto(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `pacientes/${id}/foto-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("pacientes-docs")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) {
      toast.error(upErr.message);
      setUploadingFoto(false);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("pacientes-docs")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const { error: updErr } = await supabase
      .from("pacientes")
      .update({ foto_url: signed?.signedUrl ?? null, foto_path: path })
      .eq("id", id);
    if (updErr) {
      toast.error(updErr.message);
      setUploadingFoto(false);
      return;
    }
    toast.success("Foto atualizada");
    setUploadingFoto(false);
    qc.invalidateQueries({ queryKey: ["paciente", id] });
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!paciente) return <div>Paciente não encontrado.</div>;

  const idade = paciente.data_nascimento
    ? Math.floor(
        (Date.now() - new Date(paciente.data_nascimento).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      )
    : null;

  const fotoSrc = paciente.foto_url || signedFoto;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/pacientes" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {paciente.is_modelo && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-4">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="text-sm">
            <p className="font-medium">
              Paciente modelo — dados fictícios para você explorar o Pensya
            </p>
            <p className="mt-0.5 text-muted-foreground">
              A ficha da Sofia já vem completa de ponta a ponta: cadastro, anamnese estruturada,
              avaliação com resultados de testes, plano terapêutico com CIF, metas funcionais e GAS,
              sessões vinculadas às metas, perfil clínico vivo e frequência. Navegue pelas abas,
              edite e teste à vontade — nada aqui é dado real. Quando não precisar mais, oculte o
              modelo na lista de pacientes ou consulte a{" "}
              <Link to="/central-de-ajuda" className="font-medium text-brand hover:underline">
                Central de ajuda
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <Card className="overflow-hidden p-0">
        {/* Faixa gradiente */}
        <div className="h-20 gradient-lilac sm:h-24" />
        <div className="px-5 pb-5 sm:px-6">
          {/* Linha: foto flutuante na faixa + ações */}
          <div className="flex items-start justify-between gap-4">
            <div className="relative -mt-12 shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] border-4 border-card bg-muted shadow-[var(--shadow-card)]">
                {fotoSrc ? (
                  <img src={fotoSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center gradient-brand text-brand-foreground">
                    <User className="h-10 w-10" />
                  </span>
                )}
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFoto}
              />
              <button
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto}
                title="Alterar foto"
                className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex shrink-0 gap-2">
              <Button onClick={() => setEditOpen(true)} className="rounded-full">
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <PacienteAcoesMenu
                pacienteId={id}
                pacienteNome={paciente.nome}
                arquivado={paciente.arquivado}
                status={paciente.status}
                redirectAfterDelete
              />
            </div>
          </div>

          {/* Nome (área branca, logo abaixo da foto) */}
          <div className="mt-3 min-w-0">
            <h1 className="truncate text-2xl font-display leading-tight tracking-tight">
              {paciente.nome}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {paciente.data_nascimento
                ? `${idade} anos · ${format(parseISO(paciente.data_nascimento), "dd MMM yyyy", { locale: ptBR })}`
                : "Nascimento não informado"}
              {paciente.genero ? ` · ${paciente.genero}` : ""}
            </p>
          </div>

          {/* Contatos / info rápida */}
          {(paciente.telefone || paciente.email || paciente.endereco || paciente.escola) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {paciente.telefone && <InfoChip icon={Phone}>{paciente.telefone}</InfoChip>}
              {paciente.email && <InfoChip icon={Mail}>{paciente.email}</InfoChip>}
              {paciente.endereco && (
                <InfoChip icon={MapPin}>{String(paciente.endereco).split("\n")[0]}</InfoChip>
              )}
              {paciente.escola && <InfoChip icon={GraduationCap}>{paciente.escola.nome}</InfoChip>}
            </div>
          )}

          {/* Badges de status / diagnósticos */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant={paciente.status === "ativo" ? "default" : "outline"}
              className="rounded-full"
            >
              {PACIENTE_STATUS_LABEL[paciente.status as keyof typeof PACIENTE_STATUS_LABEL] ??
                paciente.status}
            </Badge>
            {paciente.modalidade && (
              <Badge variant="secondary" className="rounded-full">
                {paciente.modalidade.nome}
              </Badge>
            )}
            {paciente.profissional_responsavel && (
              <Badge variant="outline" className="rounded-full">
                {paciente.profissional_responsavel.nome}
              </Badge>
            )}
            {paciente.paciente_diagnosticos?.map(
              (pd: any, i: number) =>
                pd.diagnostico && (
                  <Badge key={i} className="rounded-full bg-accent text-accent-foreground">
                    {pd.diagnostico.nome}
                  </Badge>
                ),
            )}
          </div>

          <div className="mt-4">
            <PacienteWorkflowActions pacienteId={id} variant="bar" />
          </div>
        </div>
      </Card>

      {/* Ações rápidas mobile do paciente */}
      <PacienteWorkflowActions pacienteId={id} variant="fab" />

      {/* ABAS */}
      <Tabs value={abaAtiva} className="space-y-4">
        <PacienteTabsNav
          aba={abaAtiva}
          sub={subClinico}
          onNavigate={irParaAba}
          hideAdministrativo={ehTerapeuta}
        />

        <TabsContent value="resumo" className="space-y-6">
          <BrainStateCard pacienteId={id} />
          <ResumoTab pacienteId={id} />
        </TabsContent>

        <TabsContent value="cadastro">
          <FichaCadastralTab paciente={paciente} onEditar={() => setEditOpen(true)} />
        </TabsContent>

        {/* Área Clínico: fluxo terapêutico em subabas */}
        <TabsContent value="clinico">
          {subClinico === "avaliacao" && (
            <AvaliacaoWizard
              pacienteId={id}
              onNavigateToTab={(tab, subTab) => {
                const destino = resolverAba(tab);
                if (subTab) setAdminSubTab(subTab);
                irParaAba(destino.aba, destino.sub);
              }}
            />
          )}
          {subClinico === "plano" && (
            <PlanoTab
              pacienteId={id}
              onVerMonitoramento={() => irParaAba("clinico", "monitoramento")}
            />
          )}
          {subClinico === "sessoes" && (
            <div className="space-y-4">
              <ProntuarioTab pacienteId={id} />
              <details className="rounded-xl border bg-muted/30 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Importar prontuário antigo (de outro sistema ou papel)
                </summary>
                <div className="pt-3">
                  <ImportarProntuarioTab pacienteId={id} />
                </div>
              </details>
            </div>
          )}
          {subClinico === "frequencia" && <FrequenciaTab pacienteId={id} />}
          {subClinico === "monitoramento" && <EvolucaoTab pacienteId={id} />}
          {subClinico === "perfil" && <PerfilClinicoVivoTab pacienteId={id} />}
        </TabsContent>

        <TabsContent value="arquivos">
          <ArquivosTab pacienteId={id} />
        </TabsContent>

        <TabsContent value="administrativo">
          <AdministrativoTab
            pacienteId={id}
            activeTab={adminSubTab}
            onActiveTabChange={setAdminSubTab}
          />
        </TabsContent>
      </Tabs>

      {/* DRAWER: Editar paciente */}
      <DataDrawer
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) {
            setForm(paciente);
            setResps(paciente.responsaveis ?? []);
          }
        }}
        title={`Editar — ${paciente.nome}`}
        description="Atualize cadastro, responsáveis e pré-anamnese"
        width="xl"
        accent
        icon={<Pencil className="h-5 w-5" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {salvar.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        }
      >
        <Tabs defaultValue="cadastro" className="space-y-4">
          <TabsList className="h-auto gap-1 rounded-full bg-muted/70 p-1">
            {[
              ["cadastro", "Cadastro"],
              ["responsaveis", "Responsáveis"],
              ["anamnese", "Anamnese"],
            ].map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* CADASTRO */}
          <TabsContent value="cadastro" className="space-y-4">
            <Section icon={<User className="w-4 h-4 text-brand" />} title="Dados pessoais">
              <FormRow label="Nome">
                <Input
                  value={form.nome ?? ""}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Nascimento">
                  <Input
                    type="date"
                    value={form.data_nascimento ?? ""}
                    onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                  />
                </FormRow>
                <FormRow label="Gênero">
                  <Select
                    value={form.genero ?? ""}
                    onValueChange={(v) => setForm({ ...form, genero: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="CPF">
                  <Input
                    value={form.cpf ?? ""}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  />
                </FormRow>
                <FormRow label="Documento">
                  <Input
                    value={form.documento ?? ""}
                    onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Telefone">
                  <Input
                    value={form.telefone ?? ""}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </FormRow>
                <FormRow label="E-mail">
                  <Input
                    value={form.email ?? ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </FormRow>
              </div>
              <FormRow label="Endereço completo">
                <Textarea
                  rows={2}
                  value={form.endereco ?? ""}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </FormRow>
            </Section>

            <Section icon={<GraduationCap className="w-4 h-4 text-brand" />} title="Escola">
              <FormRow label="Escola">
                <Select
                  value={form.escola_id ?? "__none"}
                  onValueChange={(v) => setForm({ ...form, escola_id: v === "__none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem escola" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem escola</SelectItem>
                    {escolas?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Escolaridade">
                  <Input
                    value={form.escolaridade ?? ""}
                    onChange={(e) => setForm({ ...form, escolaridade: e.target.value })}
                  />
                </FormRow>
                <FormRow label="Série / curso">
                  <Input
                    value={form.serie_curso ?? ""}
                    onChange={(e) => setForm({ ...form, serie_curso: e.target.value })}
                  />
                </FormRow>
              </div>
              <FormRow label="Contato da escola">
                <Input
                  value={form.contato_escola ?? ""}
                  onChange={(e) => setForm({ ...form, contato_escola: e.target.value })}
                />
              </FormRow>
            </Section>

            <Section icon={<Briefcase className="w-4 h-4 text-brand" />} title="Atendimento">
              <FormRow label="Modalidade">
                <Select
                  value={form.modalidade_id ?? "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, modalidade_id: v === "__none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem modalidade</SelectItem>
                    {modalidades?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Profissional responsável">
                <Select
                  value={form.profissional_responsavel_id ?? "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, profissional_responsavel_id: v === "__none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem responsável</SelectItem>
                    {profissionais?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Status">
                <Select
                  value={form.status ?? "ativo"}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACIENTE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PACIENTE_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Motivo do status">
                <Input
                  value={form.motivo_status ?? ""}
                  onChange={(e) => setForm({ ...form, motivo_status: e.target.value })}
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Início">
                  <Input
                    type="date"
                    value={form.data_inicio ?? ""}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                  />
                </FormRow>
                <FormRow label="Última avaliação">
                  <Input
                    type="date"
                    value={form.data_ultima_avaliacao ?? ""}
                    onChange={(e) => setForm({ ...form, data_ultima_avaliacao: e.target.value })}
                  />
                </FormRow>
              </div>
              <FormRow label="Data de alta">
                <Input
                  type="date"
                  value={form.data_alta ?? ""}
                  onChange={(e) => setForm({ ...form, data_alta: e.target.value })}
                />
              </FormRow>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={!!form.autoriza_imagem}
                  onCheckedChange={(v) => setForm({ ...form, autoriza_imagem: v })}
                />
                <Label className="text-sm">Autoriza uso de imagem</Label>
              </div>
            </Section>

            <Section icon={<Heart className="w-4 h-4 text-brand" />} title="Clínico">
              <FormRow label="Queixa principal">
                <Textarea
                  rows={3}
                  value={form.queixa_principal ?? ""}
                  onChange={(e) => setForm({ ...form, queixa_principal: e.target.value })}
                />
              </FormRow>
              <FormRow label="Expectativas">
                <Textarea
                  rows={3}
                  value={form.expectativas ?? ""}
                  onChange={(e) => setForm({ ...form, expectativas: e.target.value })}
                />
              </FormRow>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!form.hipotese_diagnostica}
                  onCheckedChange={(v) => setForm({ ...form, hipotese_diagnostica: v })}
                />
                <Label className="text-sm">Possui hipótese diagnóstica</Label>
              </div>
              <FormRow label="Observações gerais">
                <Textarea
                  rows={3}
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </FormRow>
            </Section>

            <Section icon={<Wallet className="w-4 h-4 text-brand" />} title="Financeiro">
              <FormRow label="Modelo de pagamento">
                <Select
                  value={form.modelo_pagamento ?? "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, modelo_pagamento: v === "__none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Não definido</SelectItem>
                    <SelectItem value="mensalidade">Mensalidade</SelectItem>
                    <SelectItem value="sessao">Por sessão</SelectItem>
                    <SelectItem value="pacote">Pacote</SelectItem>
                    <SelectItem value="convenio">Convênio</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Valor acordado (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_acordado ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        valor_acordado: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </FormRow>
                <FormRow label="Dia de vencimento">
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_vencimento ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dia_vencimento: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </FormRow>
              </div>
              <FormRow label="Nº de parcelas">
                <Input
                  type="number"
                  min="1"
                  value={form.numero_parcelas ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      numero_parcelas: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </FormRow>
            </Section>
          </TabsContent>

          {/* RESPONSÁVEIS */}
          <TabsContent value="responsaveis" className="space-y-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setResps([
                  ...resps,
                  { nome: "", parentesco: "", telefone: "", principal: resps.length === 0 },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar responsável
            </Button>
            {resps.length === 0 && (
              <Card className="glass p-6">
                <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
              </Card>
            )}
            <div className="grid gap-4">
              {resps.map((r, idx) => (
                <Card key={r.id ?? `new-${idx}`} className="glass">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!r.principal}
                          onCheckedChange={(v) => {
                            const next = [...resps];
                            if (v) next.forEach((x, i) => (x.principal = i === idx));
                            else next[idx].principal = false;
                            setResps(next);
                          }}
                        />
                        <Label className="text-xs">Principal</Label>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover responsável?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Será removido ao salvar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => setResps(resps.filter((_, i) => i !== idx))}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <FormRow label="Nome">
                      <Input
                        value={r.nome ?? ""}
                        onChange={(e) => updateResp(idx, "nome", e.target.value, resps, setResps)}
                      />
                    </FormRow>
                    <div className="grid grid-cols-2 gap-3">
                      <FormRow label="Parentesco">
                        <Input
                          value={r.parentesco ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "parentesco", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                      <FormRow label="Idade">
                        <Input
                          type="number"
                          value={r.idade ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "idade", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormRow label="Telefone">
                        <Input
                          value={r.telefone ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "telefone", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                      <FormRow label="E-mail">
                        <Input
                          value={r.email ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "email", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormRow label="CPF">
                        <Input
                          value={r.documento ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "documento", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                      <FormRow label="Profissão">
                        <Input
                          value={r.profissao ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "profissao", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                    </div>
                    <FormRow label="Estado civil">
                      <Input
                        value={r.estado_civil ?? ""}
                        onChange={(e) =>
                          updateResp(idx, "estado_civil", e.target.value, resps, setResps)
                        }
                      />
                    </FormRow>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!r.deseja_nf}
                        onCheckedChange={(v) => updateResp(idx, "deseja_nf", v, resps, setResps)}
                      />
                      <Label className="text-sm">Deseja nota fiscal</Label>
                    </div>
                    {r.deseja_nf && (
                      <FormRow label="Dados para NF">
                        <Textarea
                          rows={2}
                          value={r.dados_nf ?? ""}
                          onChange={(e) =>
                            updateResp(idx, "dados_nf", e.target.value, resps, setResps)
                          }
                        />
                      </FormRow>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ANAMNESE (read-only — reflete a Anamnese Inteligente preenchida em Avaliação) */}
          <TabsContent value="anamnese" className="space-y-4">
            {(() => {
              const secoes = (preAnamnese?.secoes_estruturadas ?? {}) as Record<
                string,
                Record<string, any>
              >;
              const temEstruturada = Object.keys(secoes).length > 0;
              if (temEstruturada) {
                return (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Reflete a Anamnese preenchida em <strong>Avaliação → Anamnese</strong>. Para
                      editar, use aquela aba.
                    </p>
                    <AnamneseEstruturadaView
                      secoes={secoes}
                      resumos={(preAnamnese?.resumos_secao ?? {}) as Record<string, string>}
                    />
                  </>
                );
              }
              if (!preAnamnese) {
                return (
                  <Card className="glass p-6">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma anamnese preenchida ainda.
                    </p>
                  </Card>
                );
              }
              return (
                <div className="grid gap-4">
                  <JsonBlock
                    title="Gestação"
                    icon={<Baby className="w-4 h-4 text-brand" />}
                    data={preAnamnese.gestacao}
                  />
                  <JsonBlock
                    title="Parto"
                    icon={<Baby className="w-4 h-4 text-brand" />}
                    data={preAnamnese.parto}
                  />
                  <JsonBlock
                    title="Saúde e dados antropométricos"
                    icon={<Activity className="w-4 h-4 text-brand" />}
                    data={preAnamnese.saude}
                  />
                  <JsonBlock
                    title="Contexto familiar"
                    icon={<Users className="w-4 h-4 text-brand" />}
                    data={preAnamnese.contexto_familiar}
                  />
                  <JsonBlock
                    title="Tratamentos anteriores"
                    icon={<FileText className="w-4 h-4 text-brand" />}
                    data={preAnamnese.tratamentos_anteriores}
                  />
                  <JsonBlock
                    title="Outros especialistas"
                    icon={<Users className="w-4 h-4 text-brand" />}
                    data={preAnamnese.outros_especialistas}
                  />
                  <JsonBlock
                    title="Exames clínicos"
                    icon={<Activity className="w-4 h-4 text-brand" />}
                    data={preAnamnese.exames_clinicos}
                  />
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </DataDrawer>
    </div>
  );
}

function updateResp(
  idx: number,
  key: string,
  value: any,
  resps: Responsavel[],
  setResps: (r: Responsavel[]) => void,
) {
  const next = [...resps];
  next[idx] = { ...next[idx], [key]: value };
  setResps(next);
}

function InfoChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Renderiza, em modo leitura, a Anamnese Inteligente (secoes_estruturadas) usando os
 * rótulos do schema — para que a aba "Anamnese" da ficha reflita o que a terapeuta
 * preencheu no formulário (Avaliação → Anamnese), e não apenas o cadastro inicial legado.
 */
function AnamneseEstruturadaView({
  secoes,
  resumos,
}: {
  secoes: Record<string, Record<string, any>>;
  resumos?: Record<string, string>;
}) {
  const blocos = ANAMNESE_SECOES.map((sec) => {
    const dados = secoes[sec.key] ?? {};
    const linhas = sec.campos
      .filter((c) => campoVisivel(c, dados))
      .map((c) => {
        const v = dados[c.key];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
        const valor = Array.isArray(v)
          ? v.join(", ")
          : typeof v === "boolean"
            ? v
              ? "Sim"
              : "Não"
            : String(v);
        return { label: c.label, valor };
      })
      .filter(Boolean) as { label: string; valor: string }[];
    const resumo = resumos?.[sec.key];
    if (linhas.length === 0 && !resumo) return null;
    return { key: sec.key, titulo: sec.titulo, linhas, resumo };
  }).filter(Boolean) as {
    key: string;
    titulo: string;
    linhas: { label: string; valor: string }[];
    resumo?: string;
  }[];

  if (blocos.length === 0) {
    return (
      <Card className="glass p-6">
        <p className="text-sm text-muted-foreground">Anamnese ainda sem respostas preenchidas.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {blocos.map((b) => (
        <Card key={b.key} className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              {b.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {b.linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-[200px_1fr] gap-3 text-sm">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="whitespace-pre-wrap">{l.valor}</span>
              </div>
            ))}
            {b.resumo && (
              <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2 mt-2">
                {b.resumo}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function JsonBlock({ title, icon, data }: { title: string; icon: React.ReactNode; data: any }) {
  const entries =
    data && typeof data === "object"
      ? Object.entries(data).filter(([, v]) => v !== null && v !== "" && v !== undefined)
      : [];
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground/60">Nenhuma informação preenchida.</p>
        )}
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="whitespace-pre-wrap">
              {typeof v === "boolean"
                ? v
                  ? "Sim"
                  : "Não"
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
