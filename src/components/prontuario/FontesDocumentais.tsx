import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extrairTextoDocumento } from "@/lib/fontes.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/shared/SectionCard";
import { FileText, Upload, Trash2, Sparkles, Loader2, CheckCircle2, FileUp } from "lucide-react";

/**
 * Fontes Documentais (Fase 1.5 · ETAPA 1).
 * Anexa relatórios/registros ao paciente e os transforma em FONTE do "Gerar com IA":
 * o texto é extraído por IA e cruzado na formulação — sem digitar tudo manualmente.
 * Ideal para pacientes antigos (1ª avaliação externa, evoluções, registro de sessões
 * de um plano anterior).
 */

export const FONTE_TIPOS = [
  { value: "relatorio_avaliacao", label: "Relatório de avaliação" },
  { value: "relatorio_evolucao", label: "Relatório de evolução" },
  { value: "registro_sessoes", label: "Registro de sessões (plano anterior)" },
  { value: "relatorio_medico", label: "Relatório / laudo médico" },
  { value: "relatorio_escolar", label: "Relatório escolar" },
  { value: "anamnese", label: "Anamnese externa" },
  { value: "outro", label: "Outro" },
];
const FONTE_LABEL = Object.fromEntries(FONTE_TIPOS.map((f) => [f.value, f.label]));

type Doc = {
  id: string;
  titulo: string;
  categoria: string | null;
  mime_type: string | null;
  storage_path: string;
  link_externo: string | null;
  usar_como_fonte: boolean;
  fonte_tipo: string | null;
  texto_extraido: string | null;
  extraido_em: string | null;
  created_at: string;
};

export function FontesDocumentais({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const extrair = useServerFn(extrairTextoDocumento);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [novoTipo, setNovoTipo] = useState("relatorio_avaliacao");
  const [extraindoId, setExtraindoId] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["paciente-docs-fonte", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("paciente_documentos")
        .select("id, titulo, categoria, mime_type, storage_path, link_externo, usar_como_fonte, fonte_tipo, texto_extraido, extraido_em, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Doc[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["paciente-docs-fonte", pacienteId] });
    qc.invalidateQueries({ queryKey: ["documentos", pacienteId] });
  };

  const usadas = docs.filter((d) => d.usar_como_fonte);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("Máx 25MB"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `pacientes/${pacienteId}/fontes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: ins, error: insErr } = await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId,
        titulo: file.name,
        categoria: "Fonte",
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
        origem: "plano-fonte",
        usar_como_fonte: true,
        fonte_tipo: novoTipo,
        uploaded_by: user?.id ?? null,
      }).select("id").single();
      if (insErr) throw insErr;
      invalidate();
      toast.success("Documento anexado — extraindo texto…");
      // Extração automática logo após o upload
      if (ins?.id) await runExtrair(ins.id);
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function runExtrair(id: string) {
    setExtraindoId(id);
    try {
      const r: any = await extrair({ data: { documento_id: id } });
      invalidate();
      toast.success(`Texto extraído (${r.chars} caracteres)`);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao extrair texto");
    } finally {
      setExtraindoId(null);
    }
  }

  async function patch(id: string, campos: Partial<Doc>) {
    await supabase.from("paciente_documentos").update(campos as never).eq("id", id);
    invalidate();
  }
  async function excluir(d: Doc) {
    if (!confirm(`Remover "${d.titulo}" das fontes? (o arquivo também é apagado)`)) return;
    if (d.storage_path && d.storage_path !== "external") {
      await supabase.storage.from("pacientes-docs").remove([d.storage_path]);
    }
    await supabase.from("paciente_documentos").delete().eq("id", d.id);
    invalidate();
  }

  return (
    <SectionCard
      title={`Fontes documentais (${usadas.length} em uso)`}
      description="ETAPA 1 · Anexe relatórios, laudos e registros de sessões — a IA extrai o texto e cruza na formulação (ideal p/ pacientes antigos)"
      icon={FileText}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Tipo do próximo documento</p>
          <Select value={novoTipo} onValueChange={setNovoTipo}>
            <SelectTrigger className="h-9 w-64 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONTE_TIPOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,image/*,text/plain" className="hidden" onChange={handleUpload} />
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Anexar documento
        </Button>
        <span className="text-[11px] text-muted-foreground">PDF, imagem ou texto (até 25MB)</span>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
          <FileUp className="mx-auto mb-2 h-5 w-5 opacity-60" />
          Nenhum documento anexado. Suba a 1ª avaliação (relatório externo), relatórios de evolução ou o registro de sessões de um plano anterior — a IA usa como fonte na geração do plano.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const extraido = !!d.texto_extraido;
            const podeExtrair = d.storage_path && d.storage_path !== "external";
            return (
              <div key={d.id} className="rounded-md border border-border/50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand" />
                  <span className="flex-1 truncate text-sm font-medium" title={d.titulo}>{d.titulo}</span>
                  {extraido ? (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> texto extraído
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">sem texto</Badge>
                  )}
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Switch checked={d.usar_como_fonte} onCheckedChange={(v) => patch(d.id, { usar_como_fonte: v })} />
                    usar como fonte
                  </label>
                  <Button size="sm" variant="ghost" onClick={excluir.bind(null, d)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={d.fonte_tipo ?? ""} onValueChange={(v) => patch(d.id, { fonte_tipo: v })}>
                    <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Tipo de fonte" /></SelectTrigger>
                    <SelectContent>{FONTE_TIPOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={!podeExtrair || extraindoId === d.id}
                    onClick={() => runExtrair(d.id)}
                  >
                    {extraindoId === d.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                    {extraido ? "Reextrair" : "Extrair texto"}
                  </Button>
                  {d.extraido_em && (
                    <span className="text-[10px] text-muted-foreground">extraído em {format(new Date(d.extraido_em), "dd/MM/yy HH:mm")}</span>
                  )}
                  {!podeExtrair && <span className="text-[10px] text-amber-600">link externo — baixe e anexe o arquivo</span>}
                </div>
                {extraido && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{d.texto_extraido?.slice(0, 300)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {usadas.length > 0 && (
        <p className="mt-3 rounded-md bg-brand/5 p-2 text-[11px] text-muted-foreground">
          <strong>{usadas.filter((d) => d.texto_extraido).length}</strong> documento(s) com texto extraído serão cruzados no próximo <strong>Gerar com IA</strong>.
          {usadas.some((d) => !d.texto_extraido) && " Documentos sem texto extraído não entram — clique em “Extrair texto”."}
        </p>
      )}
    </SectionCard>
  );
}
