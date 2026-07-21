import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO, isPast } from "date-fns";
import { toast } from "sonner";
import {
  Copy, Link2, Send, ShieldCheck, ShieldOff, Trash2, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { portalCriarRegistro, portalRegistros } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const HUMORES = ["😞", "😕", "😐", "🙂", "😄"];

/**
 * Aba Portal (lado da equipe): convites de acesso para família/paciente,
 * gestão dos acessos ativos e o diário enviado pela família.
 */
export function PortalTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [nomeConvidado, setNomeConvidado] = useState("");
  const [emailConvidado, setEmailConvidado] = useState("");
  const [tipoConvite, setTipoConvite] = useState<"responsavel" | "paciente">("responsavel");
  const [resposta, setResposta] = useState("");

  const { data: convites } = useQuery({
    queryKey: ["portal-convites", pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_convites")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: acessos } = useQuery({
    queryKey: ["portal-acessos", pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_acessos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: registros } = useQuery({
    queryKey: ["portal-registros", pacienteId],
    queryFn: () => portalRegistros(pacienteId),
  });

  const criarConvite = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("portal_convites")
        .insert({
          paciente_id: pacienteId,
          tipo: tipoConvite,
          nome_convidado: nomeConvidado.trim() || null,
          email: emailConvidado.trim() || null,
          created_by: u.user?.id ?? null,
        })
        .select("token")
        .single();
      if (error) throw new Error(error.message);
      return data.token as string;
    },
    onSuccess: async (token) => {
      setNomeConvidado("");
      setEmailConvidado("");
      qc.invalidateQueries({ queryKey: ["portal-convites", pacienteId] });
      await copiarLink(token);
      toast.success("Convite criado e link copiado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revogarConvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portal_convites").update({ revogado: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-convites", pacienteId] }),
  });

  const toggleAcesso = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("portal_acessos").update({ ativo }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-acessos", pacienteId] }),
  });

  const responder = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles").select("nome").eq("id", u.user?.id ?? "").maybeSingle();
      await portalCriarRegistro({
        pacienteId,
        tipo: "resposta",
        texto: resposta.trim(),
        autorNome: profile?.nome ?? "Equipe",
        autorTipo: "equipe",
      });
    },
    onSuccess: () => {
      setResposta("");
      toast.success("Resposta publicada no portal.");
      qc.invalidateQueries({ queryKey: ["portal-registros", pacienteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copiarLink(token: string) {
    const url = `${window.location.origin}/portal/convite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.info(url);
    }
  }

  function statusConvite(c: { revogado: boolean; usado_em: string | null; expires_at: string }) {
    if (c.revogado) return <Badge variant="outline">Revogado</Badge>;
    if (c.usado_em) return <Badge className="bg-brand text-brand-foreground">Usado</Badge>;
    if (isPast(parseISO(c.expires_at))) return <Badge variant="destructive">Expirado</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  }

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-brand" /> Convidar família / paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nome (opcional)</Label>
              <Input value={nomeConvidado} onChange={(e) => setNomeConvidado(e.target.value)} placeholder="Ex.: Maria (mãe)" />
            </div>
            <div className="space-y-1.5">
              <Label>Email (opcional)</Label>
              <Input type="email" value={emailConvidado} onChange={(e) => setEmailConvidado(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de acesso</Label>
              <Select value={tipoConvite} onValueChange={(v) => setTipoConvite(v as typeof tipoConvite)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsavel">Responsável / família</SelectItem>
                  <SelectItem value="paciente">Paciente (adulto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            className="gradient-brand text-brand-foreground"
            disabled={criarConvite.isPending}
            onClick={() => criarConvite.mutate()}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Gerar link de convite
          </Button>
          <p className="text-xs text-muted-foreground">
            O link vale por 14 dias. Envie por WhatsApp ou email — a pessoa cria a
            própria conta e passa a ver evolução, orientações, agenda e financeiro.
          </p>

          {(convites ?? []).length > 0 && (
            <div className="space-y-1.5 pt-1">
              {(convites ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {c.nome_convidado || c.email || "Convite"}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {c.tipo === "paciente" ? "paciente" : "responsável"} · {format(parseISO(c.created_at), "dd/MM/yyyy")}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {statusConvite(c)}
                    {!c.revogado && !c.usado_em && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link" onClick={() => copiarLink(c.token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Revogar" onClick={() => revogarConvite.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-brand" /> Acessos ativos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(acessos ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Ninguém tem acesso ao portal deste paciente ainda.</p>
          )}
          {(acessos ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
              <div className="flex items-center gap-2">
                {a.ativo ? (
                  <ShieldCheck className="h-4 w-4 text-brand" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm">
                    {a.tipo === "paciente" ? "Paciente (adulto)" : "Responsável"}
                    {a.parentesco ? ` · ${a.parentesco}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    desde {format(parseISO(a.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{a.ativo ? "Ativo" : "Suspenso"}</span>
                <Switch checked={a.ativo} onCheckedChange={(v) => toggleAcesso.mutate({ id: a.id, ativo: v })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Diário da família</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="Responder à família no portal…"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!resposta.trim() || responder.isPending}
              onClick={() => responder.mutate()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {(registros ?? []).map((r) => (
              <div key={r.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {r.autor_nome} {r.autor_tipo === "equipe" && "(equipe)"} ·{" "}
                  {format(parseISO(r.created_at), "dd/MM/yyyy HH:mm")}
                  {r.humor ? ` · ${HUMORES[r.humor - 1]}` : ""}
                  {" · "}
                  <span className="capitalize">{r.tipo}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{r.texto}</p>
              </div>
            ))}
            {(registros ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum registro da família ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
