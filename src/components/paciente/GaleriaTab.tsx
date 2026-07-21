import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Upload, Download, Trash2, ImageIcon, Film, Play, Loader2 } from "lucide-react";

const BUCKET = "pacientes-docs";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type Midia = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  storage_path: string;
  mime_type: string | null;
  origem: string | null;
  sessao_id: string | null;
  created_at: string;
};

const ORIGEM_LABEL: Record<string, string> = {
  sessao: "Sessão",
  familia: "Família",
  upload: "Upload",
};

function isVideo(m: Midia) {
  return (m.mime_type ?? "").startsWith("video/");
}

export function GaleriaTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Midia | null>(null);

  const { data: midias = [], isLoading } = useQuery({
    queryKey: ["paciente-galeria", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("paciente_documentos")
        .select("id, titulo, descricao, storage_path, mime_type, origem, sessao_id, created_at")
        .eq("paciente_id", pacienteId)
        .eq("galeria", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as Midia[];
    },
  });

  // Resolve signed URLs em lote para exibição.
  useEffect(() => {
    let cancel = false;
    async function resolve() {
      if (!midias.length) { setSigned({}); return; }
      const paths = midias.map((m) => m.storage_path);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (cancel || !data) return;
      const map: Record<string, string> = {};
      data.forEach((d, i) => { if (d.signedUrl) map[midias[i].id] = d.signedUrl; });
      setSigned(map);
    }
    resolve();
    return () => { cancel = true; };
  }, [midias]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      let ok = 0;
      for (const file of files) {
        const ehImagem = file.type.startsWith("image/");
        const ehVideo = file.type.startsWith("video/");
        if (!ehImagem && !ehVideo) { toast.error(`${file.name}: envie imagem ou vídeo`); continue; }
        if (file.size > MAX_BYTES) { toast.error(`${file.name}: máximo 25MB`); continue; }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? (ehVideo ? "mp4" : "jpg");
        const path = `pacientes/${pacienteId}/galeria/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { error: insErr } = await supabase.from("paciente_documentos").insert({
          paciente_id: pacienteId,
          categoria: "Galeria",
          titulo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
          galeria: true,
          origem: "upload",
        });
        if (insErr) { toast.error(insErr.message); continue; }
        ok++;
      }
      if (ok > 0) toast.success(`${ok} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["paciente-galeria", pacienteId] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const baixar = async (m: Midia) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(m.storage_path, 60, { download: m.titulo ?? true });
    if (error || !data) { toast.error(error?.message ?? "Falha ao baixar"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = m.titulo ?? "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const remover = useMutation({
    mutationFn: async (m: Midia) => {
      await supabase.storage.from(BUCKET).remove([m.storage_path]);
      const { error } = await supabase.from("paciente_documentos").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido da galeria");
      qc.invalidateQueries({ queryKey: ["paciente-galeria", pacienteId] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand" /> Galeria do paciente
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Fotos e vídeos do paciente — inclusive os anexados no registro de sessão. Clique para ampliar ou baixar.
          </p>
        </div>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? "Enviando..." : "Enviar fotos/vídeos"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={upload} />
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : midias.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-8 text-center">
            Nenhuma foto ou vídeo ainda. Envie aqui ou anexe no registro de uma sessão.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {midias.map((m) => {
              const url = signed[m.id];
              const video = isVideo(m);
              return (
                <div key={m.id} className="group relative overflow-hidden rounded-lg border border-border/50 bg-background/40">
                  <button
                    type="button"
                    onClick={() => setPreview(m)}
                    className="block aspect-square w-full"
                    title="Ampliar"
                  >
                    {!url ? (
                      <div className="h-full w-full animate-pulse bg-muted" />
                    ) : video ? (
                      <div className="relative h-full w-full bg-black/80">
                        <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Play className="h-8 w-8 text-white/90 drop-shadow" fill="currentColor" />
                        </span>
                      </div>
                    ) : (
                      <img src={url} alt={m.titulo ?? ""} className="h-full w-full object-cover" />
                    )}
                  </button>

                  <div className="absolute left-1.5 top-1.5 flex gap-1">
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                      {video ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {ORIGEM_LABEL[m.origem ?? ""] ?? "Upload"}
                    </Badge>
                  </div>

                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button size="sm" variant="secondary" className="h-7 w-7 p-0" onClick={() => baixar(m)} title="Baixar">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover da galeria?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O arquivo será excluído permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remover.mutate(m)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                    <p className="truncate">{m.titulo}</p>
                    <p className="text-white/70">{format(parseISO(m.created_at), "dd/MM/yyyy")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Visualização ampliada */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">{preview?.titulo}</DialogTitle>
          </DialogHeader>
          {preview && signed[preview.id] && (
            isVideo(preview) ? (
              <video src={signed[preview.id]} controls autoPlay className="max-h-[70vh] w-full rounded-lg bg-black" />
            ) : (
              <img src={signed[preview.id]} alt={preview.titulo ?? ""} className="max-h-[70vh] w-full rounded-lg object-contain" />
            )
          )}
          {preview && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {ORIGEM_LABEL[preview.origem ?? ""] ?? "Upload"} · {format(parseISO(preview.created_at), "dd/MM/yyyy")}
              </p>
              <Button size="sm" variant="outline" onClick={() => baixar(preview)}>
                <Download className="mr-2 h-4 w-4" /> Baixar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
