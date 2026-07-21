import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extrairTextoReferencia } from "@/lib/referencias.functions";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, Pencil, ExternalLink, Search, Upload, Sparkles, Loader2, CheckCircle2, Pin } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export const Route = createFileRoute("/_authenticated/configuracoes/referencias")({
  component: ReferenciasPage,
});

export const REFERENCIA_TIPOS = [
  { value: "artigo", label: "Artigo" },
  { value: "ebook", label: "E-book" },
  { value: "livro", label: "Livro" },
  { value: "capitulo", label: "Capítulo" },
  { value: "diretriz", label: "Diretriz / consenso" },
  { value: "outro", label: "Outro" },
];
const TIPO_LABEL = Object.fromEntries(REFERENCIA_TIPOS.map((t) => [t.value, t.label]));

type Referencia = {
  id: string; titulo: string; autores: string | null; ano: number | null; tipo: string;
  link: string | null; arquivo_path: string | null; resumo: string | null;
  texto_extraido: string | null; tags: string[]; dominio: string | null;
  fixada: boolean; ativo: boolean;
};

const vazio = { titulo: "", autores: "", ano: "", tipo: "artigo", dominio: "", tags: "", resumo: "", link: "", fixada: false, ativo: true };

function ReferenciasPage() {
  const qc = useQueryClient();
  const extrair = useServerFn(extrairTextoReferencia);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [dialog, setDialog] = useState<null | { id?: string; form: typeof vazio }>(null);
  const [extraindoId, setExtraindoId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadAlvo, setUploadAlvo] = useState<string | null>(null);

  const { data: referencias = [] } = useQuery({
    queryKey: ["referencias-bank"],
    queryFn: async () => {
      const { data } = await supabase.from("referencias").select("*").order("titulo");
      return (data ?? []) as Referencia[];
    },
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return referencias.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (!q) return true;
      return r.titulo.toLowerCase().includes(q)
        || (r.autores ?? "").toLowerCase().includes(q)
        || (r.dominio ?? "").toLowerCase().includes(q)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(q));
    });
  }, [referencias, busca, filtroTipo]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["referencias-bank"] });

  async function salvar() {
    if (!dialog) return;
    const f = dialog.form;
    if (!f.titulo.trim()) { toast.error("Informe o título da referência"); return; }
    const anoNum = f.ano.trim() ? Number(f.ano.trim()) : null;
    if (anoNum !== null && (!Number.isInteger(anoNum) || anoNum < 1900 || anoNum > 2100)) {
      toast.error("Ano inválido"); return;
    }
    const payload = {
      titulo: f.titulo.trim(), autores: f.autores || null, ano: anoNum, tipo: f.tipo,
      dominio: f.dominio || null, resumo: f.resumo || null, link: f.link || null,
      fixada: f.fixada, ativo: f.ativo,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    if (dialog.id) {
      const { error } = await supabase.from("referencias").update(payload).eq("id", dialog.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("referencias").insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Referência salva");
    setDialog(null);
    invalidate();
  }

  async function excluir(r: Referencia) {
    if (!confirm(`Excluir "${r.titulo}"?`)) return;
    if (r.arquivo_path) await supabase.storage.from("pacientes-docs").remove([r.arquivo_path]);
    await supabase.from("referencias").delete().eq("id", r.id);
    invalidate();
  }
  async function toggleAtivo(r: Referencia) {
    await supabase.from("referencias").update({ ativo: !r.ativo }).eq("id", r.id);
    invalidate();
  }
  async function toggleFixada(r: Referencia) {
    await supabase.from("referencias").update({ fixada: !r.fixada }).eq("id", r.id);
    invalidate();
  }

  function pedirUpload(id: string) {
    setUploadAlvo(id);
    uploadRef.current?.click();
  }

  async function onArquivoEscolhido(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = uploadAlvo;
    setUploadAlvo(null);
    if (!file || !id) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("Arquivo acima de 25MB"); return; }
    setUploadingId(id);
    try {
      const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase();
      const path = `referencias/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("referencias").update({ arquivo_path: path }).eq("id", id);
      if (error) throw error;
      invalidate();
      toast.success("Arquivo anexado — agora extraia o texto");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao anexar arquivo");
    } finally {
      setUploadingId(null);
    }
  }

  async function runExtrair(id: string) {
    setExtraindoId(id);
    try {
      const r: any = await extrair({ data: { referencia_id: id } });
      invalidate();
      toast.success(`Texto extraído (${r.chars} caracteres)`);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao extrair texto");
    } finally {
      setExtraindoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <input ref={uploadRef} type="file" accept="application/pdf,image/*,text/plain" className="hidden" onChange={onArquivoEscolhido} />
      <PageHeader
        icon={BookOpen}
        title="Banco de Referências"
        description="Artigos, e-books, capítulos e diretrizes que alimentam a IA (plano, sessões, raciocínio e relatórios). As referências relevantes ao caso — por tags/domínio — ou fixadas entram automaticamente no contexto."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por título, autor, domínio ou tag…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {REFERENCIA_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setDialog({ form: { ...vazio } })}><Plus className="mr-2 h-4 w-4" />Nova referência</Button>
      </div>

      {filtradas.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {referencias.length === 0 ? "Nenhuma referência cadastrada. Adicione artigos, e-books e diretrizes para fundamentar as gerações da IA." : "Nenhuma referência encontrada com esse filtro."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((r) => {
            const temTexto = !!(r.texto_extraido && r.texto_extraido.trim());
            return (
              <Card key={r.id} className={r.ativo ? "" : "opacity-60"}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">{[r.autores, r.ano].filter(Boolean).join(" · ") || "—"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                        {r.dominio && <Badge variant="secondary" className="text-[10px]">{r.dominio}</Badge>}
                        {r.fixada && <Badge className="bg-brand/15 text-brand text-[10px]"><Pin className="mr-0.5 h-2.5 w-2.5" />fixada</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ id: r.id, form: {
                        titulo: r.titulo, autores: r.autores ?? "", ano: r.ano != null ? String(r.ano) : "", tipo: r.tipo,
                        dominio: r.dominio ?? "", tags: (r.tags ?? []).join(", "), resumo: r.resumo ?? "", link: r.link ?? "",
                        fixada: r.fixada, ativo: r.ativo,
                      } })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir(r)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </div>
                  </div>
                  {r.resumo && <p className="line-clamp-2 text-xs text-muted-foreground">{r.resumo}</p>}
                  {(r.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">{r.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {temTexto && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />texto extraído ({r.texto_extraido!.length} car.)
                      </span>
                    )}
                    {r.arquivo_path ? (
                      <Button size="sm" variant="outline" className="h-7"
                        disabled={extraindoId === r.id}
                        onClick={() => runExtrair(r.id)}>
                        {extraindoId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        {temTexto ? "Reextrair" : "Extrair texto"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7"
                        disabled={uploadingId === r.id}
                        onClick={() => pedirUpload(r.id)}>
                        {uploadingId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                        Anexar PDF
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleFixada(r)}>
                      <Pin className={`mr-1 h-3 w-3 ${r.fixada ? "text-brand" : ""}`} />{r.fixada ? "Desafixar" : "Fixar"}
                    </Button>
                    {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink className="h-3 w-3" />link</a>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog?.id ? "Editar referência" : "Nova referência"}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Título</Label>
                <Input value={dialog.form.titulo} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, titulo: e.target.value } })} placeholder="Ex.: Consciência fonológica e alfabetização" />
              </div>
              <div>
                <Label className="text-xs">Autores</Label>
                <Input value={dialog.form.autores} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, autores: e.target.value } })} placeholder="Ex.: Capovilla & Seabra" />
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <Input value={dialog.form.ano} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, ano: e.target.value } })} placeholder="Ex.: 2019" inputMode="numeric" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={dialog.form.tipo} onValueChange={(v) => setDialog({ ...dialog, form: { ...dialog.form, tipo: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REFERENCIA_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Domínio (opcional)</Label>
                <Input value={dialog.form.dominio} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, dominio: e.target.value } })} placeholder="Ex.: Linguagem" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Tags / temas (vírgula)</Label>
                <Input value={dialog.form.tags} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, tags: e.target.value } })} placeholder="Ex.: dislexia, consciência fonológica, TDAH" />
                <p className="mt-1 text-[10px] text-muted-foreground">Usadas para casar a referência com o caso (queixa, domínios, metas) automaticamente.</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Resumo / pontos-chave</Label>
                <Textarea rows={3} value={dialog.form.resumo} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, resumo: e.target.value } })} placeholder="Usado no contexto da IA quando não há PDF extraído." />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Link (opcional)</Label>
                <Input value={dialog.form.link} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, link: e.target.value } })} placeholder="https://…" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={dialog.form.fixada} onCheckedChange={(v) => setDialog({ ...dialog, form: { ...dialog.form, fixada: v } })} />
                <Label className="text-xs">Fixar (sempre usar na IA)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={dialog.form.ativo} onCheckedChange={(v) => setDialog({ ...dialog, form: { ...dialog.form, ativo: v } })} />
                <Label className="text-xs">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
