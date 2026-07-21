import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Send, Trophy, HelpCircle, Eye, MessageSquareReply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortal, primeiroNome } from "@/components/portal/portal-context";
import { portalCriarRegistro, portalRegistros } from "@/lib/portal.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/diario")({
  component: PortalDiario,
});

const TIPOS = [
  { value: "observacao", label: "Observação", icon: Eye },
  { value: "marco", label: "Conquista", icon: Trophy },
  { value: "duvida", label: "Dúvida", icon: HelpCircle },
] as const;

const HUMORES = ["😞", "😕", "😐", "🙂", "😄"];

const TIPO_LABEL: Record<string, string> = {
  observacao: "Observação",
  marco: "Conquista",
  duvida: "Dúvida",
  resposta: "Resposta da equipe",
};

function PortalDiario() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<string>("observacao");
  const [texto, setTexto] = useState("");
  const [humor, setHumor] = useState<number | null>(null);

  const { data: registros, isLoading } = useQuery({
    queryKey: ["portal-registros", pid],
    queryFn: () => portalRegistros(pid),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles").select("nome").eq("id", u.user?.id ?? "").maybeSingle();
      await portalCriarRegistro({
        pacienteId: pid,
        tipo,
        texto: texto.trim(),
        humor,
        autorNome: profile?.nome ?? "Família",
      });
    },
    onSuccess: () => {
      setTexto("");
      setHumor(null);
      toast.success("Registro enviado para a equipe.");
      qc.invalidateQueries({ queryKey: ["portal-registros", pid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Diário da família</h1>
        <p className="text-sm text-muted-foreground">
          Conte como {primeiroNome(paciente.nome)} está em casa — a equipe acompanha tudo por aqui.
        </p>
      </div>

      <Card className="glass">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  tipo === t.value
                    ? "border-brand bg-accent text-accent-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder={
              tipo === "duvida"
                ? "Escreva sua dúvida para a equipe…"
                : "O que aconteceu? Como foi o comportamento, o sono, a escola…"
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">Como foi o dia?</span>
              {HUMORES.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setHumor(humor === i + 1 ? null : i + 1)}
                  className={cn(
                    "rounded-full p-1 text-lg transition-transform",
                    humor === i + 1 ? "scale-125 bg-accent" : "opacity-60 hover:opacity-100",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="gradient-brand text-brand-foreground"
              disabled={!texto.trim() || criar.isPending}
              onClick={() => criar.mutate()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {(registros ?? []).map((r) => (
          <Card key={r.id} className={cn("glass", r.autor_tipo === "equipe" && "border-brand/40")}>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {r.autor_tipo === "equipe" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-brand">
                      <MessageSquareReply className="h-3 w-3" /> {r.autor_nome} (equipe)
                    </span>
                  ) : (
                    r.autor_nome
                  )}
                  {" · "}
                  {format(parseISO(r.created_at), "dd/MM/yyyy HH:mm")}
                </p>
                <div className="flex items-center gap-1.5">
                  {r.humor && <span>{HUMORES[r.humor - 1]}</span>}
                  <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.texto}</p>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (registros ?? []).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum registro ainda. Escreva o primeiro! 💙
          </p>
        )}
      </div>
    </div>
  );
}
