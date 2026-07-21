import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { DataDrawer } from "@/components/shared/DataDrawer";
import { TimelineList, type TimelineItem } from "@/components/shared/TimelineList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, MessageCircle, Mail, Users2, StickyNote, ArrowRightLeft, UserPlus, Ban,
  CalendarClock, Pencil, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { converterLeadEmPaciente } from "@/lib/marketing.functions";
import { currency, type Lead } from "./types";
import { LeadFormDialog } from "./LeadFormDialog";

const TIPO_ICON: Record<string, any> = {
  ligacao: Phone, whatsapp: MessageCircle, email: Mail, reuniao: Users2,
  nota: StickyNote, mudanca_etapa: ArrowRightLeft, conversao: UserPlus,
};
const TIPO_LABEL: Record<string, string> = {
  ligacao: "Ligação", whatsapp: "WhatsApp", email: "Email", reuniao: "Reunião",
  nota: "Nota", mudanca_etapa: "Mudança de etapa", conversao: "Conversão",
};

export function LeadDrawer({
  lead, onClose, onChanged,
}: { lead: Lead | null; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [contatoOpen, setContatoOpen] = useState(false);
  const [contatoTipo, setContatoTipo] = useState("ligacao");
  const [contatoDesc, setContatoDesc] = useState("");
  const [followOpen, setFollowOpen] = useState(false);
  const [followData, setFollowData] = useState("");
  const [followDesc, setFollowDesc] = useState("");
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");

  const converter = useServerFn(converterLeadEmPaciente);

  const { data: etapas } = useQuery({
    queryKey: ["etapas-mini"],
    queryFn: async () => (await supabase.from("pipeline_etapas").select("*").eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: interacoes } = useQuery({
    queryKey: ["lead-interacoes", lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from("lead_interacoes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!lead,
  });

  function invalida() {
    invalidarMarketing(qc);
    onChanged();
  }

  const mudarEtapa = useMutation({
    mutationFn: async (novaEtapaId: string) => {
      if (!lead) return;
      const now = new Date().toISOString();
      await supabase.from("leads").update({ etapa_id: novaEtapaId, etapa_atualizada_em: now }).eq("id", lead.id);
      await supabase.from("lead_interacoes").insert({
        lead_id: lead.id, tipo: "mudanca_etapa", etapa_anterior_id: lead.etapa_id, etapa_nova_id: novaEtapaId,
      });
    },
    onSuccess: () => { toast.success("Etapa atualizada"); invalida(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrarContato = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const now = new Date().toISOString();
      await supabase.from("lead_interacoes").insert({ lead_id: lead.id, tipo: contatoTipo, descricao: contatoDesc || null });
      await supabase.from("leads").update({ ultimo_contato_em: now }).eq("id", lead.id);
    },
    onSuccess: () => {
      toast.success("Contato registrado");
      setContatoOpen(false); setContatoDesc(""); setContatoTipo("ligacao");
      invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agendarFollowUp = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("tarefas").insert({
        titulo: `Follow-up: ${lead.nome}`,
        descricao: followDesc || null,
        lead_id: lead.id,
        prazo: followData || null,
        departamento: "comercial",
        origem: "marketing_lead",
        criador_id: user?.id ?? null,
        responsavel_id: lead.responsavel_id ?? null,
        status: "a_fazer",
      });
      await supabase.from("leads").update({ proximo_contato_em: followData ? new Date(followData).toISOString() : null }).eq("id", lead.id);
    },
    onSuccess: () => {
      toast.success("Follow-up agendado em Tarefas");
      setFollowOpen(false); setFollowData(""); setFollowDesc("");
      invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarPerdido = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const perdidoEtapa = etapas?.find((e) => e.tipo === "perdido");
      if (!perdidoEtapa) throw new Error("Nenhuma etapa 'perdido' configurada");
      const now = new Date().toISOString();
      await supabase.from("leads").update({
        etapa_id: perdidoEtapa.id, etapa_atualizada_em: now, motivo_perda: motivoPerda || null,
      }).eq("id", lead.id);
      await supabase.from("lead_interacoes").insert({
        lead_id: lead.id, tipo: "mudanca_etapa", etapa_anterior_id: lead.etapa_id, etapa_nova_id: perdidoEtapa.id,
        descricao: motivoPerda ? `Motivo: ${motivoPerda}` : null,
      });
    },
    onSuccess: () => {
      toast.success("Lead marcado como perdido");
      setPerdaOpen(false); setMotivoPerda("");
      invalida();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const converterMut = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("Nenhum lead selecionado");
      return converter({ data: { leadId: lead.id } });
    },
    onSuccess: (r: any) => {
      toast.success("Lead convertido em paciente!");
      invalida();
      onClose();
      window.open(`/pacientes/${r.pacienteId}`, "_self");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!lead) return null;

  const items: TimelineItem[] = (interacoes ?? []).map((it) => ({
    id: it.id,
    date: format(parseISO(it.created_at), "dd/MM/yyyy 'às' HH:mm"),
    title: TIPO_LABEL[it.tipo] ?? it.tipo,
    description: it.descricao ?? undefined,
    icon: TIPO_ICON[it.tipo],
    tone: it.tipo === "conversao" ? "success" : it.tipo === "mudanca_etapa" ? "brand" : "muted",
  }));

  const jaConvertido = !!lead.paciente_id_criado;
  const origemDetalhes = [
    lead.origem_detalhe && ["Detalhe", lead.origem_detalhe],
    lead.indicador_nome && ["Indicação", lead.indicador_nome],
    lead.parceiro_id && ["Parceiro", lead.parceiro_id],
    lead.utm_source && ["UTM source", lead.utm_source],
    lead.utm_medium && ["UTM medium", lead.utm_medium],
    lead.utm_campaign && ["UTM campaign", lead.utm_campaign],
  ].filter(Boolean) as [string, string][];

  return (
    <>
      <DataDrawer
        open={!!lead}
        onOpenChange={(v) => !v && onClose()}
        title={lead.nome}
        description={lead.nome_paciente ? `Paciente em potencial: ${lead.nome_paciente}` : undefined}
        width="lg"
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" />Editar
            </Button>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {lead.canal && <Badge variant="outline">{lead.canal.nome}</Badge>}
            {lead.campanha && <Badge variant="outline">{lead.campanha.nome}</Badge>}
            {jaConvertido && <Badge className="bg-emerald-100 text-emerald-700">Convertido em paciente</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Info label="Telefone" value={lead.telefone || "—"} />
            <Info label="Email" value={lead.email || "—"} />
            <Info label="Valor estimado" value={lead.valor_estimado ? currency(lead.valor_estimado) : "—"} />
            <Info label="Responsável" value={lead.responsavel?.nome || "—"} />
            <Info label="Último contato" value={lead.ultimo_contato_em ? formatDistanceToNow(parseISO(lead.ultimo_contato_em), { locale: ptBR, addSuffix: true }) : "Nenhum ainda"} />
            <Info label="Próximo contato" value={lead.proximo_contato_em ? format(parseISO(lead.proximo_contato_em), "dd/MM/yyyy") : "—"} />
          </div>

          {origemDetalhes.length > 0 && (
            <div className="rounded-lg border border-border/50 p-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Detalhes da origem</h3>
              <div className="grid grid-cols-2 gap-2">
                {origemDetalhes.map(([label, value]) => (
                  <Info key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          )}

          {lead.observacoes && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs">{lead.observacoes}</div>
          )}

          {!jaConvertido && (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">Etapa</span>
                <Select value={lead.etapa_id} onValueChange={(v) => mudarEtapa.mutate(v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {etapas?.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setContatoOpen((v) => !v)}>
                  <Phone className="w-3.5 h-3.5 mr-1" />Registrar contato
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFollowOpen((v) => !v)}>
                  <CalendarClock className="w-3.5 h-3.5 mr-1" />Agendar follow-up
                </Button>
                <Button size="sm" className="gradient-brand text-white" disabled={converterMut.isPending} onClick={() => converterMut.mutate()}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" />Converter em paciente
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPerdaOpen((v) => !v)}>
                  <Ban className="w-3.5 h-3.5 mr-1" />Marcar como perdido
                </Button>
              </div>

              {contatoOpen && (
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <Select value={contatoTipo} onValueChange={setContatoTipo}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="nota">Nota</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea rows={2} placeholder="O que foi conversado?" value={contatoDesc} onChange={(e) => setContatoDesc(e.target.value)} />
                  <Button size="sm" className="w-full" disabled={registrarContato.isPending} onClick={() => registrarContato.mutate()}>Salvar</Button>
                </div>
              )}

              {followOpen && (
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <Input type="date" value={followData} onChange={(e) => setFollowData(e.target.value)} />
                  <Textarea rows={2} placeholder="Lembrete (opcional)" value={followDesc} onChange={(e) => setFollowDesc(e.target.value)} />
                  <Button size="sm" className="w-full" disabled={agendarFollowUp.isPending} onClick={() => agendarFollowUp.mutate()}>Agendar</Button>
                </div>
              )}

              {perdaOpen && (
                <div className="rounded-lg border border-destructive/40 p-3 space-y-2">
                  <Textarea rows={2} placeholder="Motivo da perda" value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} />
                  <Button size="sm" variant="destructive" className="w-full" disabled={marcarPerdido.isPending} onClick={() => marcarPerdido.mutate()}>
                    Confirmar perda
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Histórico</h3>
            <TimelineList items={items} empty="Nenhuma interação registrada ainda." />
          </div>
        </div>
      </DataDrawer>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} editing={lead} onSaved={invalida} />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
