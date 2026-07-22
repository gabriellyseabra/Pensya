import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { CLINICA_LOGO_BUCKET, clinicaLogoUrl, getMinhaOrganizacao, CORES_TEMA, aplicarCorTema } from "@/lib/clinica-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  component: ConfigPage,
});

import { PageHero } from "@/components/shared/PageHero";
import { Settings as SettingsIcon, Building2, Users as UsersIcon, BookOpen, School, Wallet, ListChecks, ArrowRight, Library } from "lucide-react";
import { Link } from "@tanstack/react-router";

type TabDef = { key: string; label: string; fields: readonly string[] };

const GROUPS: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; tabs: TabDef[] }[] = [
  {
    key: "clinica", label: "Clínica", icon: Building2,
    tabs: [
      { key: "__identidade", label: "Identidade da clínica", fields: [] },
      { key: "locais", label: "Locais", fields: ["nome", "endereco"] },
      { key: "modalidades", label: "Modalidades", fields: ["nome", "cor"] },
      { key: "status_frequencia", label: "Status de frequência", fields: ["nome", "cor"] },
    ],
  },
  {
    key: "clinico", label: "Catálogo clínico", icon: BookOpen,
    tabs: [
      { key: "diagnosticos", label: "Diagnósticos", fields: ["codigo", "nome", "descricao"] },
      { key: "categorias_habilidades", label: "Categorias de habilidades", fields: ["nome"] },
      { key: "habilidades", label: "Habilidades", fields: ["nome", "descricao"] },
      { key: "__baterias_link", label: "Baterias por demanda", fields: [] },
      { key: "__recursos_link", label: "Banco de Recursos", fields: [] },
      { key: "__referencias_link", label: "Banco de Referências", fields: [] },
    ],
  },
  {
    key: "rede", label: "Rede externa", icon: School,
    tabs: [
      { key: "escolas", label: "Escolas", fields: ["nome", "contato", "telefone", "email"] },
    ],
  },
  {
    key: "financeiro", label: "Financeiro", icon: Wallet,
    tabs: [
      { key: "__plano_contas", label: "Plano de contas", fields: [] },
      { key: "contas_financeiras", label: "Contas / caixas", fields: ["nome", "tipo", "saldo_inicial"] },
      { key: "tipos_servico", label: "Tipos de serviço", fields: ["nome", "valor_padrao"] },
      { key: "centros_custo", label: "Centros de custo", fields: ["nome"] },
      { key: "fornecedores", label: "Fornecedores", fields: ["nome", "documento", "email", "telefone"] },
    ],
  },
];

function ConfigPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={SettingsIcon}
        eyebrow="Sistema"
        title="Configurações"
        description="Gerencie todos os dados base do sistema — cadastros, equipe, catálogo clínico e financeiro."
        variant="dark"
      />

      <Tabs defaultValue={GROUPS[0].key}>
        <TabsList className="glass h-auto flex-wrap">
          {GROUPS.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="gap-1.5">
              <g.icon className="h-3.5 w-3.5" />
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {(
              <Tabs defaultValue={g.tabs[0]?.key}>
                <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
                  <TabsList className="glass flex h-auto w-full flex-row flex-wrap justify-start gap-1 md:flex-col md:items-stretch">
                    {g.tabs.map((t) => (
                      <TabsTrigger key={t.key} value={t.key} className="w-full justify-start">
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="min-w-0">
                    {g.tabs.map((t) => (
                      <TabsContent key={t.key} value={t.key} className="mt-0">
                        {t.key === "__identidade" ? (
                          <ClinicaIdentidadeConfig />
                        ) : t.key === "__plano_contas" ? (
                          <PlanoContasTable />
                        ) : t.key === "__baterias_link" ? (
                          <Card className="glass p-6 space-y-3">
                            <div className="flex items-center gap-3">
                              <ListChecks className="w-5 h-5 text-brand" />
                              <div>
                                <h3 className="font-medium">Baterias por demanda</h3>
                                <p className="text-sm text-muted-foreground">Modelos de baterias (TDAH, Dislexia, etc.) aplicados em 1 clique ao planejar uma avaliação.</p>
                              </div>
                            </div>
                            <Link to="/configuracoes/baterias">
                              <Button className="gradient-brand text-brand-foreground">
                                Gerenciar baterias <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                          </Card>
                        ) : t.key === "__recursos_link" ? (
                          <Card className="glass p-6 space-y-3">
                            <div className="flex items-center gap-3">
                              <Library className="w-5 h-5 text-brand" />
                              <div>
                                <h3 className="font-medium">Banco de Recursos</h3>
                                <p className="text-sm text-muted-foreground">Jogos, materiais, estratégias e tecnologias organizados por habilidades/domínios, para apoiar a escolha nas sessões.</p>
                              </div>
                            </div>
                            <Link to="/configuracoes/recursos">
                              <Button className="gradient-brand text-brand-foreground">
                                Gerenciar recursos <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                          </Card>
                        ) : t.key === "__referencias_link" ? (
                          <Card className="glass p-6 space-y-3">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-brand" />
                              <div>
                                <h3 className="font-medium">Banco de Referências</h3>
                                <p className="text-sm text-muted-foreground">Artigos, e-books e diretrizes que alimentam a IA (plano, sessões, raciocínio e relatórios). As referências relevantes ao caso ou fixadas entram automaticamente no contexto.</p>
                              </div>
                            </div>
                            <Link to="/configuracoes/referencias">
                              <Button className="gradient-brand text-brand-foreground">
                                Gerenciar referências <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                          </Card>
                        ) : (
                          <CrudTable tableName={t.key} label={t.label} fields={t.fields} />
                        )}
                      </TabsContent>
                    ))}
                  </div>
                </div>
              </Tabs>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

type Row = Record<string, unknown> & { id: string };

function CrudTable({ tableName, label, fields }: { tableName: string; label: string; fields: readonly string[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const queryKey = ["config", tableName];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName as never).select("*").order("nome" as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing?.id) {
        const { error } = await supabase.from(tableName as never).update(payload as never).eq("id" as never, editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      setEditing(null);
      toast.success("Salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName as never).delete().eq("id" as never, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Novo
        </Button>
      </div>

      <div className="space-y-1">
        {rows?.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum registro.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {"cor" in r && r.cor ? (
                <span className="h-4 w-4 rounded-full border" style={{ background: String(r.cor) }} />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{String(r.nome ?? "")}</p>
                {fields.slice(1).map((f) => r[f] ? (
                  <span key={f} className="text-xs text-muted-foreground mr-2">{String(r[f])}</span>
                ) : null)}
              </div>
              {"ativo" in r && r.ativo === false && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} {label.toLowerCase()}</DialogTitle></DialogHeader>
          <CrudForm
            fields={fields}
            initial={editing ?? {}}
            onSubmit={(payload) => upsert.mutate(payload)}
            submitting={upsert.isPending}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CrudForm({
  fields, initial, onSubmit, submitting,
}: {
  fields: readonly string[];
  initial: Partial<Row>;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    fields.forEach((k) => { f[k] = initial[k] != null ? String(initial[k]) : ""; });
    return f;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    fields.forEach((k) => { payload[k] = form[k] || null; });
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((f) => (
        <div key={f}>
          <Label className="capitalize">{f.replace(/_/g, " ")}</Label>
          {f === "cor" ? (
            <Input type="color" value={form[f] || "#9b87f5"} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          ) : (
            <Input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} required={f === "nome"} />
          )}
        </div>
      ))}
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="gradient-brand text-brand-foreground">Salvar</Button>
      </DialogFooter>
    </form>
  );
}

type PlanoConta = { id: string; codigo: string | null; nome: string; tipo: "receita" | "despesa"; parent_id: string | null; ativo: boolean; ordem: number };

function PlanoContasTable() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PlanoConta | null>(null);
  const [novoTipo, setNovoTipo] = useState<"receita" | "despesa">("despesa");
  const [open, setOpen] = useState(false);
  const queryKey = ["config", "plano_contas"];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_contas").select("*").order("codigo");
      if (error) throw error;
      return (data ?? []) as PlanoConta[];
    },
  });

  const raizes = (rows ?? []).filter((r) => !r.parent_id);
  const folhas = (rows ?? []).filter((r) => r.parent_id);
  const porTipo = (tipo: "receita" | "despesa") => folhas.filter((r) => r.tipo === tipo);

  const upsert = useMutation({
    mutationFn: async (payload: { nome: string; codigo: string; tipo: "receita" | "despesa" }) => {
      if (editing?.id) {
        const { error } = await supabase.from("plano_contas").update({ nome: payload.nome, codigo: payload.codigo || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const raiz = raizes.find((r) => r.tipo === payload.tipo);
        if (!raiz) throw new Error(`Categoria raiz de ${payload.tipo} não encontrada`);
        const irmas = porTipo(payload.tipo).filter((f) => !/^outr/i.test(f.nome));
        const proximaOrdem = irmas.length ? Math.max(...irmas.map((f) => f.ordem)) + 1 : 1;
        const { error } = await supabase.from("plano_contas").insert({
          nome: payload.nome, codigo: payload.codigo || `${raiz.codigo}.${proximaOrdem}`,
          tipo: payload.tipo, parent_id: raiz.id, ativo: true, ordem: proximaOrdem,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setOpen(false); setEditing(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_contas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function Secao({ tipo, titulo }: { tipo: "receita" | "despesa"; titulo: string }) {
    const itens = porTipo(tipo);
    return (
      <Card className="glass p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{titulo}</h3>
          <Button size="sm" onClick={() => { setEditing(null); setNovoTipo(tipo); setOpen(true); }} className="gradient-brand text-brand-foreground">
            <Plus className="mr-2 h-4 w-4" />Nova
          </Button>
        </div>
        <div className="space-y-1">
          {itens.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma categoria.</p>}
          {itens.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.nome}</p>
                {r.codigo && <span className="text-xs text-muted-foreground">{r.codigo}</span>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Secao tipo="despesa" titulo="Categorias de saída (despesas)" />
      <Secao tipo="receita" titulo="Categorias de entrada (receitas)" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
          <PlanoContaForm
            editing={editing}
            tipo={editing?.tipo ?? novoTipo}
            onTipoChange={setNovoTipo}
            onSubmit={(payload) => upsert.mutate(payload)}
            submitting={upsert.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanoContaForm({
  editing, tipo, onTipoChange, onSubmit, submitting,
}: {
  editing: PlanoConta | null;
  tipo: "receita" | "despesa";
  onTipoChange: (t: "receita" | "despesa") => void;
  onSubmit: (payload: { nome: string; codigo: string; tipo: "receita" | "despesa" }) => void;
  submitting: boolean;
}) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [codigo, setCodigo] = useState(editing?.codigo ?? "");

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ nome, codigo, tipo }); }}
      className="space-y-3"
    >
      <div>
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={(v) => onTipoChange(v as "receita" | "despesa")} disabled={!!editing}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="despesa">Saída (despesa)</SelectItem>
            <SelectItem value="receita">Entrada (receita)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div>
        <Label>Código (opcional)</Label>
        <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Gerado automaticamente se vazio" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="gradient-brand text-brand-foreground">Salvar</Button>
      </DialogFooter>
    </form>
  );
}

function ClinicaIdentidadeConfig() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_clinica: "", razao_social: "", cnpj: "", endereco: "",
    cidade: "", telefone: "", email: "", responsavel_nome: "",
  });
  const [corTema, setCorTema] = useState<string>("roxo");
  const [emiteNf, setEmiteNf] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["minha-organizacao"],
    queryFn: getMinhaOrganizacao,
  });

  useEffect(() => {
    if (!cfg) return;
    setForm({
      nome_clinica: cfg.nome ?? "",
      razao_social: cfg.razao_social ?? "",
      cnpj: cfg.cnpj ?? "",
      endereco: cfg.endereco ?? "",
      cidade: cfg.cidade ?? "",
      telefone: cfg.telefone ?? "",
      email: cfg.email ?? "",
      responsavel_nome: cfg.responsavel_nome ?? "",
    });
    setCorTema(cfg.cor_tema ?? "roxo");
    setEmiteNf(cfg.emite_nf ?? false);
  }, [cfg]);

  const logoAtual = preview ?? clinicaLogoUrl(cfg?.logo_path);

  function escolherLogo(f?: File | null) {
    if (!f) return;
    setLogo(f);
    setPreview(URL.createObjectURL(f));
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!cfg?.id) throw new Error("Organização não encontrada");
      let logo_path = cfg.logo_path ?? null;
      if (logo) {
        const ext = logo.name.split(".").pop() || "png";
        const path = `${cfg.id}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(CLINICA_LOGO_BUCKET).upload(path, logo, { upsert: true });
        if (upErr) throw upErr;
        logo_path = path;
      }
      const { nome_clinica, ...resto } = form;
      const { error } = await supabase
        .from("organizacoes")
        .update({ nome: nome_clinica, ...resto, logo_path, cor_tema: corTema, emite_nf: emiteNf })
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minha-organizacao"] });
      qc.invalidateQueries({ queryKey: ["organizacao-branding-publica"] });
      aplicarCorTema(corTema);
      setLogo(null);
      toast.success("Identidade da clínica salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-6 space-y-5 max-w-2xl">
      <div>
        <h3 className="font-medium text-lg">Identidade da clínica</h3>
        <p className="text-sm text-muted-foreground">
          Sua logo e dados cadastrais aparecem nos documentos que você gera pelo sistema
          (contratos, relatórios, planos terapêuticos, cartas de encaminhamento). A marca
          Pensya continua fixa nas telas do próprio sistema — isso aqui é só a identidade
          da sua clínica nos seus documentos.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted"
        >
          {logoAtual ? (
            <img src={logoAtual} alt="Logo da clínica" className="h-full w-full object-contain p-1" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => escolherLogo(e.target.files?.[0])}
        />
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {logoAtual ? "Trocar logo" : "Enviar logo"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou SVG. Fundo transparente recomendado.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Nome da clínica</Label>
          <Input value={form.nome_clinica} onChange={(e) => setForm({ ...form, nome_clinica: e.target.value })} placeholder="Como aparece nos documentos" />
        </div>
        <div>
          <Label>Responsável técnico</Label>
          <Input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
        </div>
        <div>
          <Label>Razão social</Label>
          <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
        </div>
        <div className="sm:col-span-2">
          <Label>Endereço</Label>
          <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade/UF" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Cor do sistema</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Define a cor dos botões e destaques do sistema para toda a sua equipe.
        </p>
        <div className="flex flex-wrap gap-2">
          {CORES_TEMA.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCorTema(c.valor)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                corTema === c.valor
                  ? "border-brand bg-brand/10 font-medium"
                  : "border-border hover:bg-muted",
              )}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: c.amostra }}
              />
              {c.nome}
              {corTema === c.valor && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Emitir nota fiscal aos pacientes</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Quando ativado, o cadastro público pergunta à família se deseja nota fiscal e em nome de
              quem emitir. Deixe desligado se você não emite NF — a pergunta some do formulário.
            </p>
          </div>
          <Switch checked={emiteNf} onCheckedChange={setEmiteNf} />
        </div>
      </div>

      <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gradient-brand text-brand-foreground">
        {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar identidade da clínica
      </Button>
    </Card>
  );
}
