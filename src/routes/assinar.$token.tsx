import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Printer, Shield, Eraser } from "lucide-react";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/assinar/$token")({
  ssr: false,
  component: AssinarPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="glass-strong p-8 max-w-md text-center">
        <h1 className="text-2xl font-display mb-2">Contrato não encontrado</h1>
        <p className="text-muted-foreground">
          Este link de assinatura não é válido ou foi removido.
        </p>
      </Card>
    </div>
  ),
});

function AssinarPage() {
  const { token } = Route.useParams();
  const [contrato, setContrato] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_contrato_por_token", { _token: token });
      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }
      const c = data[0];
      setContrato(c);
      setNome(c.signatario_nome ?? "");
      setCpf(c.signatario_cpf ?? "");
      setLoading(false);
    })();
  }, [token]);

  const assinar = async () => {
    if (!nome.trim() || !cpf.trim()) return toast.error("Preencha nome e CPF");
    if (!aceito) return toast.error("Você precisa aceitar os termos");
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Assine no campo abaixo");
    setEnviando(true);
    try {
      const dataUrl = sigRef.current.toDataURL("image/png");
      let ip = "";
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json()).ip;
      } catch {}
      const { error } = await supabase.rpc("assinar_contrato", {
        _token: token,
        _assinatura_imagem: dataUrl,
        _signatario_nome: nome,
        _signatario_cpf: cpf,
        _ip: ip,
      });
      if (error) throw error;
      toast.success("Contrato assinado!");
      // reload
      const { data } = await supabase.rpc("get_contrato_por_token", { _token: token });
      setContrato(data?.[0] ?? null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao assinar");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass-strong p-8 max-w-md text-center">
          <h1 className="text-2xl font-display mb-2">Contrato não encontrado</h1>
          <p className="text-muted-foreground">Este link de assinatura não é válido.</p>
        </Card>
      </div>
    );
  }

  const assinado = contrato.status === "assinado";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" /> Assinatura eletrônica segura
          </div>
          {assinado && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
            </Button>
          )}
        </div>

        <Card className="bg-white p-8 sm:p-12 shadow-soft print:shadow-none print:p-0">
          <div
            className="prose prose-sm sm:prose max-w-none"
            dangerouslySetInnerHTML={{ __html: contrato.conteudo_html ?? "" }}
          />

          {assinado && (
            <div className="mt-12 border-t pt-6">
              <div className="text-center">
                {contrato.assinatura_imagem && (
                  <img src={contrato.assinatura_imagem} alt="Assinatura" className="mx-auto max-h-32" />
                )}
                <div className="border-t border-foreground/40 mx-auto w-64 mt-2 pt-2">
                  <div className="font-medium">{contrato.signatario_nome}</div>
                  <div className="text-xs text-muted-foreground">CPF: {contrato.signatario_cpf}</div>
                </div>
              </div>
              <div className="mt-6 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 print:bg-transparent print:border">
                <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Documento assinado eletronicamente
                </div>
                <div>Assinado em: {contrato.assinado_em && format(new Date(contrato.assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                <div className="break-all">Hash SHA-256: {contrato.hash_documento}</div>
              </div>
            </div>
          )}
        </Card>

        {!assinado && (
          <Card className="glass p-6 print:hidden">
            <h2 className="font-semibold mb-4">Assinar contrato</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div>
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <Label>Sua assinatura *</Label>
                <Button variant="ghost" size="sm" onClick={() => sigRef.current?.clear()}>
                  <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
                </Button>
              </div>
              <div className="border rounded-lg bg-white">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#0f172a"
                  canvasProps={{ className: "w-full h-40 rounded-lg" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Desenhe sua assinatura usando o mouse ou o dedo (em dispositivos touch).
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm mb-4">
              <Checkbox checked={aceito} onCheckedChange={(v) => setAceito(!!v)} className="mt-0.5" />
              <span>
                Li e concordo com todos os termos deste contrato e declaro que esta assinatura
                eletrônica tem o mesmo valor jurídico de uma assinatura manuscrita.
              </span>
            </label>

            <Button onClick={assinar} disabled={enviando} className="w-full gradient-brand text-white">
              {enviando ? "Assinando..." : "Assinar contrato"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
