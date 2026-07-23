import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clinicaLogoUrl } from "@/lib/clinica-config";
import { Camera, CheckCircle2, Loader2, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/foto/$token")({
  ssr: false,
  component: FotoUploadPage,
});

type TokenInfo = { paciente_id: string; paciente_nome: string; clinica_nome: string | null; logo_path: string | null };

function FotoUploadPage() {
  const { token } = Route.useParams();
  const [enviando, setEnviando] = useState(false);
  const [enviadas, setEnviadas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ["foto-token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("foto_token_info", { _token: token });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as TokenInfo | undefined;
    },
  });

  async function enviar(files: FileList | null) {
    if (!files || !info) return;
    setErro(null);
    setEnviando(true);
    let ok = 0;
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `pacientes/${info.paciente_id}/galeria/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type || "image/jpeg" });
        if (upErr) { setErro(upErr.message); continue; }
        const { error: rpcErr } = await supabase.rpc("galeria_publica_add", {
          _token: token, _storage_path: path, _mime: file.type || "image/jpeg", _titulo: file.name,
        });
        if (rpcErr) { setErro(rpcErr.message); continue; }
        ok++;
      }
      setEnviadas((n) => n + ok);
    } finally {
      setEnviando(false);
    }
  }

  const logo = clinicaLogoUrl(info?.logo_path);

  return (
    <div className="min-h-screen bg-gradient-to-b from-lilac/20 to-background px-5 py-10">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {logo ? (
            <img src={logo} alt="" className="h-14 w-auto object-contain" />
          ) : (
            <img src="/pensya-icon.svg" alt="Pensya" className="h-12 w-12" />
          )}
          {info?.clinica_nome && <p className="text-sm font-medium text-muted-foreground">{info.clinica_nome}</p>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : !info ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="font-medium">Link inválido ou expirado</p>
            <p className="mt-1 text-sm text-muted-foreground">Peça um novo link à clínica.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Enviar foto</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              As fotos vão direto para o prontuário de <strong>{info.paciente_nome}</strong>.
            </p>

            <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-brand px-4 py-6 text-brand-foreground transition-opacity hover:opacity-90">
              {enviando ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
              <span className="font-medium">{enviando ? "Enviando…" : "Tirar foto"}</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={enviando} onChange={(e) => enviar(e.target.files)} />
            </label>

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm hover:bg-accent">
              <ImagePlus className="h-4 w-4" /> Escolher da galeria
              <input type="file" accept="image/*" multiple className="hidden" disabled={enviando} onChange={(e) => enviar(e.target.files)} />
            </label>

            {enviadas > 0 && (
              <p className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {enviadas} foto{enviadas > 1 ? "s" : ""} enviada{enviadas > 1 ? "s" : ""}!
              </p>
            )}
            {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground">Pensya · Central de fotos</p>
      </div>
    </div>
  );
}
