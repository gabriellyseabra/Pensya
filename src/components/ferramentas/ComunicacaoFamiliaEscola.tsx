import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Copy, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarComunicacao } from "@/lib/ferramentas-ia.functions";

export function ComunicacaoFamiliaEscola({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gerarFn = useServerFn(gerarComunicacao);
  const [destinatario, setDestinatario] = useState<"familia" | "escola" | "profissional">("familia");
  const [tom, setTom] = useState<"acolhedor" | "formal" | "objetivo" | "motivador">("acolhedor");
  const [tamanho, setTamanho] = useState<"curta" | "media" | "longa">("media");
  const [canal, setCanal] = useState<"whatsapp" | "email" | "bilhete">("whatsapp");
  const [pacienteId, setPacienteId] = useState<string>("");
  const [contexto, setContexto] = useState("");
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["com-pacientes"],
    enabled: open,
    queryFn: async () => (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });

  async function gerar() {
    if (!contexto.trim()) { toast.error("Escreva o que precisa ser comunicado"); return; }
    setLoading(true);
    try {
      const res: any = await gerarFn({ data: { destinatario, tom, tamanho, canal, contexto: contexto.trim(), paciente_id: pacienteId || null } });
      setTexto(res?.texto ?? "");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar a mensagem");
    } finally {
      setLoading(false);
    }
  }

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comunicação para família / escola</DialogTitle></DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Destinatário</Label>
            <Select value={destinatario} onValueChange={(v) => setDestinatario(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="familia">Família</SelectItem>
                <SelectItem value="escola">Escola / professores</SelectItem>
                <SelectItem value="profissional">Outro profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="bilhete">Bilhete impresso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tom de voz</Label>
            <Select value={tom} onValueChange={(v) => setTom(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acolhedor">Acolhedor</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="objetivo">Objetivo</SelectItem>
                <SelectItem value="motivador">Motivador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Select value={tamanho} onValueChange={(v) => setTamanho(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="curta">Curta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="longa">Longa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Paciente (opcional — a IA considera o nome e o contexto)</Label>
          <Select value={pacienteId || "__none__"} onValueChange={(v) => setPacienteId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Sem paciente" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">Sem paciente (avulso)</SelectItem>
              {(pacientes as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">O que precisa ser comunicado</Label>
          <Textarea rows={3} value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="Ex.: avisar que a criança evoluiu na leitura e pedir apoio da escola nas atividades de casa…" />
        </div>

        <div className="flex justify-end">
          <Button onClick={gerar} disabled={loading} className="gradient-brand text-brand-foreground">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Gerar mensagem
          </Button>
        </div>

        {texto && (
          <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3">
            <Textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} className="bg-background" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(texto).then(() => toast.success("Copiado"))}>
                <Copy className="mr-1.5 h-4 w-4" />Copiar
              </Button>
              {canal === "whatsapp" && (
                <Button size="sm" variant="outline" onClick={whatsapp}>
                  <MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Revise antes de enviar — a IA pode errar. Você pode editar o texto acima.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
