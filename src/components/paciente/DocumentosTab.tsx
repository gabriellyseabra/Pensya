import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, FileText, Link as LinkIcon, Plus, Sparkles, Loader2, Printer, Settings2, Pencil, Eye, X, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarRelatorioPaciente } from "@/lib/relatorios.functions";
import { derivarTemplateDeModelo } from "@/lib/templates.functions";
import { NAVE_CSS, NAVE_HEADER_HTML } from "@/lib/nave-relatorio";

const CATEGORIAS = [
  "Laudo", "Relatório", "Receita", "Exame", "Atestado",
  "Documento pessoal", "Contrato", "Autorização", "Outro",
];

type Doc = {
  id: string; titulo: string; categoria: string | null; descricao: string | null;
  storage_path: string; mime_type: string | null; tamanho_bytes: number | null;
  link_externo: string | null; created_at: string;
};

export function DocumentosTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Doc | null>(null);
  const [form, setForm] = useState<{ titulo: string; categoria: string; descricao: string; link: string }>({
    titulo: "", categoria: "Laudo", descricao: "", link: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["paciente-docs", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("paciente_documentos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .not("galeria", "is", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as Doc[];
    },
  });

  async function salvar() {
    if (!form.titulo.trim()) { toast.error("Informe um título"); return; }
    if (!file && !form.link.trim()) { toast.error("Envie um arquivo ou informe um link"); return; }
    setSaving(true);
    try {
      let storage_path = "";
      let mime: string | null = null;
      let size: number | null = null;
      if (file) {
        if (file.size > 25 * 1024 * 1024) throw new Error("Máximo 25MB");
        const ext = file.name.split(".").pop() ?? "bin";
        storage_path = `pacientes/${pacienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("pacientes-docs")
          .upload(storage_path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        mime = file.type;
        size = file.size;
      }
      const { error } = await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId,
        titulo: form.titulo.trim(),
        categoria: form.categoria,
        descricao: form.descricao || null,
        storage_path: storage_path || "external",
        link_externo: form.link.trim() || null,
        mime_type: mime,
        tamanho_bytes: size,
      });
      if (error) throw error;
      toast.success("Documento adicionado");
      setOpen(false);
      setForm({ titulo: "", categoria: "Laudo", descricao: "", link: "" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["paciente-docs", pacienteId] });
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function visualizar(d: Doc) {
    if (d.link_externo && d.storage_path === "external") {
      window.open(d.link_externo, "_blank");
      return;
    }
    setViewingDoc(d);
  }

  async function baixar(d: Doc) {
    if (d.link_externo && d.storage_path === "external") {
      window.open(d.link_externo, "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from("pacientes-docs").createSignedUrl(d.storage_path, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  const remover = useMutation({
    mutationFn: async (d: Doc) => {
      if (d.storage_path && d.storage_path !== "external") {
        await supabase.storage.from("pacientes-docs").remove([d.storage_path]);
      }
      const { error } = await supabase.from("paciente_documentos").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["paciente-docs", pacienteId] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand" /> Documentos do paciente
        </CardTitle>
        <div className="flex gap-2">
          <GerarRelatorioButton pacienteId={pacienteId} onSaved={() => qc.invalidateQueries({ queryKey: ["paciente-docs", pacienteId] })} />
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo documento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhum documento ainda.</TableCell></TableRow>
            )}
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="font-medium">{d.titulo}</div>
                  {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
                  {d.link_externo && d.storage_path === "external" && (
                    <Badge variant="outline" className="mt-1 text-[10px]"><LinkIcon className="w-3 h-3 mr-1" />Link externo</Badge>
                  )}
                </TableCell>
                <TableCell>{d.categoria && <Badge variant="secondary">{d.categoria}</Badge>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.tamanho_bytes ? `${(d.tamanho_bytes / 1024).toFixed(0)} KB` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(parseISO(d.created_at), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => visualizar(d)} title="Visualizar">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => baixar(d)} title="Download">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => { if (confirm("Remover este documento?")) remover.mutate(d); }}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Arquivo (até 25MB)</Label>
                <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Ou link externo</Label>
              <Input placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              <Upload className="w-4 h-4 mr-1" />{saving ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} pacienteId={pacienteId} />}
    </Card>
  );
}

// =================== Gerar relatório com IA ===================
const TIPOS_RELATORIO = [
  { value: "avaliacao", label: "Relatório de Avaliação (Nave)" },
  { value: "evolucao", label: "Relatório de Evolução" },
  { value: "plano_terapeutico", label: "Plano Terapêutico" },
  { value: "laudo", label: "Laudo Psicopedagógico" },
];

function GerarRelatorioButton({ pacienteId, onSaved }: { pacienteId: string; onSaved: () => void }) {
  const gerar = useServerFn(gerarRelatorioPaciente);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"evolucao" | "plano_terapeutico" | "laudo" | "avaliacao">("avaliacao");
  const [templateId, setTemplateId] = useState<string>("__padrao__");
  const today = new Date().toISOString().slice(0, 10);
  const ago90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(ago90);
  const [fim, setFim] = useState(today);
  const [contexto, setContexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ titulo: string; paciente_nome: string; html: string; periodo: { inicio: string; fim: string } } | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["doc-templates", tipo],
    queryFn: async () => {
      const { data } = await supabase
        .from("documento_templates")
        .select("id, nome, descricao")
        .eq("ativo", true)
        .in("tipo", [tipo, "livre"])
        .order("nome");
      return data ?? [];
    },
  });

  async function gerarPreview() {
    setLoading(true);
    try {
      const r: any = await gerar({ data: {
        paciente_id: pacienteId, tipo, periodo_inicio: inicio, periodo_fim: fim,
        contexto_extra: contexto || undefined,
        template_id: templateId !== "__padrao__" ? templateId : undefined,
      } });
      setPreview(r);
    } catch (e: any) {
      toast.error("Falha ao gerar", { description: e.message });
    } finally { setLoading(false); }
  }

  function renderHTML(p: { titulo: string; paciente_nome: string; html: string; periodo: { inicio: string; fim: string } }) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${p.titulo} — ${p.paciente_nome}</title>
<style>${NAVE_CSS}</style></head><body>
<div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
${NAVE_HEADER_HTML}
<h1>${p.titulo}</h1>
<p class="meta"><strong>${p.paciente_nome}</strong> · Período: ${p.periodo.inicio} a ${p.periodo.fim} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</p>
${p.html}
</body></html>`;
  }

  function abrirImpressao() {
    if (!preview) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Bloqueador de pop-up impediu abrir"); return; }
    w.document.write(renderHTML(preview));
    w.document.close();
  }

  async function salvarComoDocumento() {
    if (!preview) return;
    setSavingDoc(true);
    try {
      const html = renderHTML(preview);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const path = `pacientes/${pacienteId}/${preview.titulo.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.html`;
      const { error: upErr } = await supabase.storage.from("pacientes-docs").upload(path, blob, { contentType: "text/html", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId,
        titulo: `${preview.titulo} — ${preview.periodo.inicio} a ${preview.periodo.fim}`,
        categoria: tipo === "laudo" ? "Laudo" : "Relatório",
        descricao: "Gerado automaticamente com IA",
        storage_path: path,
        mime_type: "text/html",
        tamanho_bytes: blob.size,
      });
      if (insErr) throw insErr;
      toast.success("Documento salvo");
      onSaved();
      setOpen(false);
      setPreview(null);
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSavingDoc(false); }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles className="w-4 h-4 mr-1" /> Gerar com IA
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Gerar documento com IA</span>
              <TemplatesManagerButton />
            </DialogTitle>
          </DialogHeader>
          {!preview ? (
            <div className="grid gap-3">
              <div>
                <Label>Tipo de documento</Label>
                <Select value={tipo} onValueChange={(v: any) => { setTipo(v); setTemplateId("__padrao__"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RELATORIO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__padrao__">Estrutura padrão da Nave</SelectItem>
                    {templates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Crie templates personalizados para reaproveitar sua estrutura preferida.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Período — início</Label>
                  <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Período — fim</Label>
                  <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Contexto adicional (opcional)</Label>
                <Textarea rows={3} value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="Pontos a destacar, motivo do laudo, etc." />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={gerarPreview} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  {loading ? "Gerando…" : "Gerar"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border rounded p-4 max-h-[55vh] overflow-y-auto bg-card prose prose-sm max-w-none"
                   dangerouslySetInnerHTML={{ __html: preview.html }} />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPreview(null)}>Refazer</Button>
                <Button variant="secondary" onClick={abrirImpressao}>
                  <Printer className="w-4 h-4 mr-1" /> Abrir / Imprimir
                </Button>
                <Button onClick={salvarComoDocumento} disabled={savingDoc}>
                  <Upload className="w-4 h-4 mr-1" /> {savingDoc ? "Salvando…" : "Salvar como documento"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// =================== Gerenciador de templates ===================
const TIPOS_TEMPLATE: { value: "avaliacao" | "evolucao" | "plano_terapeutico" | "laudo" | "reuniao" | "livre"; label: string }[] = [
  { value: "avaliacao", label: "Avaliação" },
  { value: "evolucao", label: "Evolução" },
  { value: "plano_terapeutico", label: "Plano terapêutico" },
  { value: "laudo", label: "Laudo" },
  { value: "reuniao", label: "Reunião" },
  { value: "livre", label: "Livre" },
];

// =================== Visualizador de documentos ===================
function DocumentViewer({ doc, onClose, pacienteId }: { doc: Doc; onClose: () => void; pacienteId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function loadUrl() {
      if (doc.link_externo && doc.storage_path === "external") {
        setUrl(doc.link_externo);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.storage.from("pacientes-docs").createSignedUrl(doc.storage_path, 60 * 10);
      if (error) {
        toast.error("Erro ao carregar documento");
        setLoading(false);
        return;
      }
      setUrl(data.signedUrl);
      setLoading(false);
    }
    loadUrl();
  }, [doc]);

  function handlePrint() {
    if (!url) return;
    const isImage = doc.mime_type?.startsWith("image/");
    const isPdf = doc.mime_type === "application/pdf";
    const isHtml = doc.mime_type === "text/html";

    if (isPdf || isHtml) {
      window.open(url, "_blank", "width=1200,height=800");
      return;
    }

    if (isImage) {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`
          <!DOCTYPE html>
          <html>
          <head><title>${doc.titulo}</title></head>
          <body style="margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh">
            <img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain" />
            <style>@media print { body { background: white; } }</style>
            <script>window.print();</script>
          </body>
          </html>
        `);
        w.document.close();
      }
      return;
    }

    window.open(url, "_blank");
  }

  const isImage = doc.mime_type?.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";
  const isHtml = doc.mime_type === "text/html";

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!max-w-7xl w-[95vw] h-[95vh] overflow-hidden flex flex-col p-4">
        <DialogHeader className="flex flex-row items-start justify-between flex-wrap gap-2 pb-2 border-b">
          <div className="flex-1 min-w-0">
            <DialogTitle className="truncate text-lg">{doc.titulo}</DialogTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
              {doc.categoria && <Badge variant="secondary" className="text-xs">{doc.categoria}</Badge>}
              {doc.tamanho_bytes && <span className="text-xs">{(doc.tamanho_bytes / 1024).toFixed(0)} KB</span>}
              <span className="text-xs">{format(parseISO(doc.created_at), "dd/MM/yyyy 'às' HH:mm")}</span>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8 flex-shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-1">
          {doc.descricao && (
            <div className="px-6 py-2 bg-muted rounded flex items-start gap-2 text-sm">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">{doc.descricao}</p>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-muted rounded">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando documento...</p>
              </div>
            </div>
          ) : url ? (
            <div className="flex-1 bg-muted rounded overflow-hidden">
              {isImage ? (
                <img src={url} alt={doc.titulo} className="w-full h-full object-contain" />
              ) : isPdf ? (
                <iframe src={url} className="w-full h-full border-0" title={doc.titulo} />
              ) : isHtml ? (
                <iframe srcDoc={url} className="w-full h-full border-0" title={doc.titulo} sandbox="allow-same-origin" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm">Tipo de arquivo não pode ser visualizado diretamente</p>
                  <p className="text-xs">Baixe o arquivo para abrir</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-destructive/10 rounded">
              <p className="text-sm text-destructive">Erro ao carregar o documento</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t mt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          {url && (
            <>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" /> Imprimir
              </Button>
              <Button size="sm" onClick={() => { window.open(url, "_blank"); }}>
                <Download className="w-4 h-4 mr-1" /> Download
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Gerenciador de templates ===================
function TemplatesManagerButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<{ nome: string; tipo: any; descricao: string; estrutura: string; instrucoes_extra: string }>({
    nome: "", tipo: "evolucao", descricao: "", estrutura: "", instrucoes_extra: "",
  });
  const [saving, setSaving] = useState(false);
  const [importando, setImportando] = useState(false);
  const modeloRef = useRef<HTMLInputElement>(null);
  const derivar = useServerFn(derivarTemplateDeModelo);

  async function importarModelo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (modeloRef.current) modeloRef.current.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Envie um PDF"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Máximo 15MB"); return; }
    setImportando(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        reader.readAsDataURL(file);
      });
      const t: any = await derivar({ data: { pdf_base64: base64, pdf_mime: file.type, filename: file.name } });
      setEditing(null);
      setForm({
        nome: t.nome ?? file.name.replace(/\.pdf$/i, ""),
        tipo: t.tipo ?? "livre",
        descricao: t.descricao ?? "",
        estrutura: t.estrutura ?? "",
        instrucoes_extra: t.instrucoes_extra ?? "",
      });
      toast.success("Modelo importado — revise a estrutura e o tom e salve.");
    } catch (err: any) {
      toast.error("Falha ao importar modelo", { description: err.message });
    } finally {
      setImportando(false);
    }
  }

  const { data: items = [] } = useQuery({
    queryKey: ["doc-templates-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documento_templates")
        .select("*")
        .order("tipo")
        .order("nome");
      return data ?? [];
    },
  });

  function abrirNovo() {
    setEditing(null);
    setForm({ nome: "", tipo: "evolucao", descricao: "", estrutura: "", instrucoes_extra: "" });
  }
  function abrirEdicao(t: any) {
    setEditing(t);
    setForm({
      nome: t.nome, tipo: t.tipo, descricao: t.descricao ?? "",
      estrutura: t.estrutura ?? "", instrucoes_extra: t.instrucoes_extra ?? "",
    });
  }

  async function salvar() {
    if (!form.nome.trim() || !form.estrutura.trim()) {
      toast.error("Nome e estrutura são obrigatórios"); return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editing) {
        const { error } = await supabase.from("documento_templates").update({
          nome: form.nome, tipo: form.tipo, descricao: form.descricao || null,
          estrutura: form.estrutura, instrucoes_extra: form.instrucoes_extra || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        const { error } = await supabase.from("documento_templates").insert({
          nome: form.nome, tipo: form.tipo, descricao: form.descricao || null,
          estrutura: form.estrutura, instrucoes_extra: form.instrucoes_extra || null,
          created_by: user?.id,
        });
        if (error) throw error;
        toast.success("Template criado");
      }
      qc.invalidateQueries({ queryKey: ["doc-templates-all"] });
      qc.invalidateQueries({ queryKey: ["doc-templates"] });
      abrirNovo();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("documento_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template excluído");
    qc.invalidateQueries({ queryKey: ["doc-templates-all"] });
    qc.invalidateQueries({ queryKey: ["doc-templates"] });
    if (editing?.id === id) abrirNovo();
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Settings2 className="w-4 h-4 mr-1" /> Templates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Templates de documentos</DialogTitle>
          </DialogHeader>
          <div className="grid lg:grid-cols-[260px_1fr] gap-4">
            <div className="space-y-2 border rounded-lg p-2 max-h-[60vh] overflow-y-auto">
              <Button size="sm" variant="outline" className="w-full" onClick={abrirNovo}>
                <Plus className="w-4 h-4 mr-1" /> Novo template
              </Button>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => modeloRef.current?.click()} disabled={importando}>
                {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {importando ? "Lendo modelo…" : "Importar modelo (PDF)"}
              </Button>
              <input ref={modeloRef} type="file" accept="application/pdf" className="hidden" onChange={importarModelo} />
              <p className="text-[10px] text-muted-foreground px-1">
                Envie um relatório/laudo seu em PDF; a IA extrai a estrutura e o tom num template editável.
              </p>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Nenhum template salvo ainda.</p>
              )}
              {items.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-2 rounded border cursor-pointer text-sm ${editing?.id === t.id ? "border-brand bg-brand/5" : "hover:bg-muted"}`}
                  onClick={() => abrirEdicao(t)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{t.nome}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); excluir(t.id); }}
                      className="text-destructive hover:text-destructive/80 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-1">{t.tipo}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {editing ? <><Pencil className="w-3 h-3" /> Editando: {editing.nome}</> : <><Plus className="w-3 h-3" /> Novo template</>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Laudo modelo escola privada" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_TEMPLATE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Quando usar este template" />
              </div>
              <div>
                <Label>Estrutura (seções/tópicos) *</Label>
                <Textarea
                  rows={10} value={form.estrutura}
                  onChange={(e) => setForm({ ...form, estrutura: e.target.value })}
                  placeholder={"1. Identificação\n2. Motivo da avaliação\n3. Instrumentos aplicados\n4. ..."}
                />
                <p className="text-[11px] text-muted-foreground mt-1">A IA seguirá esta lista como sumário do documento.</p>
              </div>
              <div>
                <Label>Instruções extras</Label>
                <Textarea
                  rows={3} value={form.instrucoes_extra}
                  onChange={(e) => setForm({ ...form, instrucoes_extra: e.target.value })}
                  placeholder="Tom, linguagem, foco, advertências, etc."
                />
              </div>
              <DialogFooter>
                {editing && (
                  <Button variant="ghost" onClick={abrirNovo}>Cancelar edição</Button>
                )}
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  {editing ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
