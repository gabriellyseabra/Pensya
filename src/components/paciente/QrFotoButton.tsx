import { useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Copy, Check, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

/**
 * Gera um QR (e link) de curta duração para a família/profissional enviar fotos
 * do celular direto para a galeria do paciente, sem login. Cria um token em
 * `foto_upload_tokens`; a página pública /foto/$token faz o upload.
 */
export function QrFotoButton({ pacienteId }: { pacienteId: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function gerarToken(): string {
    // Token aleatório e opaco (não previsível).
    const arr = new Uint8Array(18);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function abrir() {
    setOpen(true);
    setQr(null);
    setCarregando(true);
    try {
      const token = gerarToken();
      const { error } = await supabase.from("foto_upload_tokens").insert({ token, paciente_id: pacienteId });
      if (error) throw error;
      const url = `${window.location.origin}/foto/${token}`;
      setLink(url);
      setQr(await QRCode.toDataURL(url, { width: 320, margin: 1 }));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar QR");
      setOpen(false);
    } finally {
      setCarregando(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={abrir}>
        <QrCode className="mr-2 h-4 w-4" /> Enviar do celular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-w-sm text-center">
          <DialogHeader><DialogTitle className="flex items-center justify-center gap-2"><Smartphone className="h-4 w-4" /> Enviar foto do celular</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Aponte a câmera do celular para o QR. As fotos caem direto na galeria deste paciente. O link vale por 2 horas.</p>

          <div className="flex justify-center py-2">
            {carregando || !qr ? (
              <div className="grid h-[240px] w-[240px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
            ) : (
              <img src={qr} alt="QR para enviar foto" className="h-[240px] w-[240px] rounded-xl border" />
            )}
          </div>

          {link && (
            <Button variant="outline" size="sm" onClick={copiar} className="mx-auto">
              {copiado ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiado ? "Copiado!" : "Copiar link"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
