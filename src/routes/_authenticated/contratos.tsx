import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Edit2, Eye, Link as LinkIcon, Copy, MessageCircle, FileText, CheckCircle2, Printer,
} from "lucide-react";

function abrirPreviewPdf(html: string, titulo: string) {
  const w = window.open("", "_blank");
  if (!w) return toast.error("Permita pop-ups para visualizar o PDF");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  body{margin:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,sans-serif;}
  .toolbar{position:sticky;top:0;background:#0f172a;color:#fff;padding:10px 16px;display:flex;gap:8px;align-items:center;justify-content:space-between;z-index:10;}
  .toolbar button{background:#fff;color:#0f172a;border:0;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;}
  .page{max-width:820px;margin:24px auto;background:#fff;padding:48px;box-shadow:0 8px 24px rgba(0,0,0,.08);}
  @media print{.toolbar{display:none;}.page{box-shadow:none;margin:0;max-width:none;padding:24px;}body{background:#fff;}}
</style></head><body>
<div class="toolbar"><span>Pré-visualização — ${titulo}</span><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<div class="page">${html}</div>
</body></html>`);
  w.document.close();
}
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { renderContratoHtml, VARIAVEIS_DISPONIVEIS, TEMPLATE_EXEMPLO } from "@/lib/contratos";
import { getConfiguracaoClinica } from "@/lib/clinica-config";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/contratos")({
  component: ContratosPage,
});

function ContratosPage() {
  return (
    <div className="space-y-6">
      <PageHero
        icon={FileText}
        eyebrow="Documentos"
        title="Contratos"
        description="Gerencie modelos de contrato e envie-os para assinatura eletrônica."
      />

      <Tabs defaultValue="contratos">
        <TabsList className="glass">
          <TabsTrigger value="contratos">Contratos emitidos</TabsTrigger>
          <TabsTrigger value="templates">Modelos</TabsTrigger>
        </TabsList>
        <TabsContent value="contratos" className="mt-4"><ContratosTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Templates ---------------- */

function TemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo excluído");
      qc.invalidateQueries({ queryKey: ["contract_templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">Modelos de contrato</h2>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
        </Button>
      </div>
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum modelo cadastrado. Crie um para começar.
        </p>
      ) : (
        <div className="grid gap-2">
          {templates.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div>
                <div className="font-medium text-sm">{t.nome}</div>
                {t.descricao && <div className="text-xs text-muted-foreground">{t.descricao}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => confirm(`Excluir "${t.nome}"?`) && del.mutate(t.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDialog
        open={open}
        onOpenChange={setOpen}
        template={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["contract_templates"] })}
      />
    </Card>
  );
}

function TemplateDialog({
  open, onOpenChange, template, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; template: any | null; onSaved: () => void }) {
  const [nome, setNome] = useState(template?.nome ?? "");
  const [descricao, setDescricao] = useState(template?.descricao ?? "");
  const [conteudo, setConteudo] = useState(template?.conteudo_html ?? TEMPLATE_EXEMPLO);

  // reset when template changes
  useMemo(() => {
    setNome(template?.nome ?? "");
    setDescricao(template?.descricao ?? "");
    setConteudo(template?.conteudo_html ?? TEMPLATE_EXEMPLO);
  }, [template]);

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do modelo");
    const payload = { nome, descricao, conteudo_html: conteudo };
    const { error } = template?.id
      ? await supabase.from("contract_templates").update(payload).eq("id", template.id)
      : await supabase.from("contract_templates").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Modelo salvo");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Contrato padrão" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Conteúdo (HTML) *</Label>
              <div className="text-xs text-muted-foreground">
                Use variáveis no formato <code>{`{{paciente.nome}}`}</code>
              </div>
            </div>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={16}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIAVEIS_DISPONIVEIS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${v.key}}}`);
                    toast.success(`{{${v.key}}} copiado`);
                  }}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted/50 transition"
                  title="Clique para copiar"
                >
                  <code>{`{{${v.key}}}`}</code> <span className="text-muted-foreground">— {v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização</Label>
            <div
              className="mt-2 border rounded-lg p-4 bg-background prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: conteudo }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Contratos emitidos ---------------- */

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviado: { label: "Enviado", variant: "default" },
  assinado: { label: "Assinado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "outline" },
};

function ContratosTab() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const pacIds = Array.from(new Set((data ?? []).map((c: any) => c.paciente_id).filter(Boolean)));
      const tplIds = Array.from(new Set((data ?? []).map((c: any) => c.template_id).filter(Boolean)));
      const [{ data: pacs }, { data: tpls }] = await Promise.all([
        pacIds.length ? supabase.from("pacientes").select("id,nome").in("id", pacIds) : Promise.resolve({ data: [] } as any),
        tplIds.length ? supabase.from("contract_templates").select("id,nome").in("id", tplIds) : Promise.resolve({ data: [] } as any),
      ]);
      const pm = new Map((pacs ?? []).map((p: any) => [p.id, p]));
      const tm = new Map((tpls ?? []).map((t: any) => [t.id, t]));
      return (data ?? []).map((c: any) => ({ ...c, paciente: pm.get(c.paciente_id) ?? null, template: tm.get(c.template_id) ?? null }));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato excluído");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
  });

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">Contratos</h2>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo contrato
        </Button>
      </div>

      {contratos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum contrato emitido ainda.
        </p>
      ) : (
        <div className="grid gap-2">
          {contratos.map((c: any) => {
            const linkAssinar = `${window.location.origin}/assinar/${c.token_assinatura}`;
            const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "secondary" };
            return (
              <div key={c.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {c.paciente?.nome ?? "—"}
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {c.status === "assinado" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.template?.nome ?? "Sem modelo"} ·{" "}
                    {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {c.assinado_em && (
                      <> · Assinado em {format(new Date(c.assinado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {c.token_assinatura && c.status !== "assinado" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(linkAssinar);
                        toast.success("Link copiado");
                      }}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Link
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a target="_blank" rel="noreferrer" href={linkAssinar}>
                          <LinkIcon className="w-3.5 h-3.5 mr-1" /> Abrir
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirPreviewPdf(
                      (c.dados_preenchimento as any)?.conteudo_html ?? "",
                      `Contrato — ${c.paciente?.nome ?? ""}`,
                    )}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" /> Visualizar PDF
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/assinar/$token" params={{ token: c.token_assinatura ?? "" }} target="_blank">
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                    </Link>
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => confirm("Excluir contrato?") && del.mutate(c.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NovoContratoDialog open={novoOpen} onOpenChange={setNovoOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["contratos"] })} />
    </Card>
  );
}

function NovoContratoDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [pacienteId, setPacienteId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [valor, setValor] = useState("");
  const [profissionalNome, setProfissionalNome] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id,nome,valor_acordado,endereco,numero_parcelas,modalidade_id,profissional_responsavel_id")
        .order("nome");
      if (error) { toast.error(error.message); return []; }
      // hidrata nomes de modalidade e profissional sem depender de FK
      const modIds = Array.from(new Set((data ?? []).map((p: any) => p.modalidade_id).filter(Boolean)));
      const profIds = Array.from(new Set((data ?? []).map((p: any) => p.profissional_responsavel_id).filter(Boolean)));
      const [{ data: mods }, { data: profs }] = await Promise.all([
        modIds.length ? supabase.from("modalidades").select("id,nome").in("id", modIds) : Promise.resolve({ data: [] } as any),
        profIds.length ? supabase.from("profissionais_consultorio").select("id,nome").in("id", profIds) : Promise.resolve({ data: [] } as any),
      ]);
      const modMap = new Map((mods ?? []).map((m: any) => [m.id, m.nome]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.nome]));
      return (data ?? []).map((p: any) => ({
        ...p,
        modalidade: p.modalidade_id ? { nome: modMap.get(p.modalidade_id) } : null,
        profissional: p.profissional_responsavel_id ? { nome: profMap.get(p.profissional_responsavel_id) } : null,
      }));
    },
    enabled: open,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-min"],
    queryFn: async () => {
      const { data } = await supabase.from("contract_templates").select("id,nome,conteudo_html").eq("ativo", true).order("nome");
      return data ?? [];
    },
    enabled: open,
  });

  const create = async () => {
    if (!pacienteId || !templateId) return toast.error("Selecione paciente e modelo");
    const paciente = pacientes.find((p: any) => p.id === pacienteId) as any;
    const template = templates.find((t: any) => t.id === templateId) as any;
    if (!template) return;

    // pega responsavel principal
    const { data: resps } = await supabase
      .from("responsaveis")
      .select("nome,cpf,email,telefone,principal")
      .eq("paciente_id", pacienteId)
      .order("principal", { ascending: false })
      .limit(1);
    const resp: any = resps?.[0] ?? {};
    const clinicaCfg = await getConfiguracaoClinica();

    const vars = {
      paciente,
      responsavel: resp,
      valor_acordado: valor || paciente?.valor_acordado || "",
      numero_parcelas: (paciente as any)?.numero_parcelas || 12,
      profissional: { nome: profissionalNome || paciente?.profissional?.nome || "" },
      modalidade: modalidade || paciente?.modalidade?.nome || "",
      endereco: endereco || paciente?.endereco || clinicaCfg?.endereco || "",
      cidade: cidade || clinicaCfg?.cidade || "",
      data_hoje: new Date().toLocaleDateString("pt-BR"),
      ano_contrato: new Date().getFullYear(),
      clinica: {
        nome: clinicaCfg?.nome_clinica || "",
        razao_social: clinicaCfg?.razao_social || "",
        cnpj: clinicaCfg?.cnpj || "",
        endereco: clinicaCfg?.endereco || "",
        telefone: clinicaCfg?.telefone || "",
        email: clinicaCfg?.email || "",
      },
    };

    const htmlPreenchido = renderContratoHtml(template.conteudo_html, vars);
    const token = crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);

    const { error } = await supabase.from("contratos").insert({
      paciente_id: pacienteId,
      template_id: templateId,
      status: "enviado",
      signatario_nome: resp?.nome ?? null,
      signatario_email: resp?.email ?? null,
      signatario_cpf: resp?.cpf ?? null,
      token_assinatura: token,
      enviado_em: new Date().toISOString(),
      dados_preenchimento: { ...vars, conteudo_html: htmlPreenchido },
    });
    if (error) return toast.error(error.message);
    toast.success("Contrato criado");
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Paciente *</Label>
            <Select value={pacienteId} onValueChange={setPacienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pacientes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modelo *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Valor acordado</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex: 250,00" /></div>
            <div><Label>Profissional responsável</Label><Input value={profissionalNome} onChange={(e) => setProfissionalNome(e.target.value)} /></div>
            <div><Label>Modalidade</Label><Input value={modalidade} onChange={(e) => setModalidade(e.target.value)} /></div>
            <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Endereço de atendimento</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Campos em branco serão preenchidos com os dados já salvos do paciente, quando existirem.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create}>Gerar contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
