import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { invalidarMarketing } from "@/lib/marketing-cache";
import type { Lead } from "./types";

const NENHUM = "__nenhum__";
const ORIGEM_NAO_IDENTIFICADA = "__origem_nao_identificada__";

type FormState = {
  nome: string;
  nome_paciente: string;
  telefone: string;
  email: string;
  canal_id: string;
  campanha_id: string;
  responsavel_id: string;
  valor_estimado: string;
  origem_detalhe: string;
  indicador_nome: string;
  parceiro_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  observacoes: string;
};

function vazio(): FormState {
  return {
    nome: "", nome_paciente: "", telefone: "", email: "",
    canal_id: "", campanha_id: "", responsavel_id: "", valor_estimado: "",
    origem_detalhe: "", indicador_nome: "", parceiro_id: "",
    utm_source: "", utm_medium: "", utm_campaign: "", observacoes: "",
  };
}

export function LeadFormDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Lead | null; onSaved: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(vazio());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nome: editing.nome ?? "",
        nome_paciente: editing.nome_paciente ?? "",
        telefone: editing.telefone ?? "",
        email: editing.email ?? "",
        canal_id: editing.canal_id ?? "",
        campanha_id: editing.campanha_id ?? "",
        responsavel_id: editing.responsavel_id ?? "",
        valor_estimado: editing.valor_estimado != null ? String(editing.valor_estimado) : "",
        origem_detalhe: editing.origem_detalhe ?? "",
        indicador_nome: editing.indicador_nome ?? "",
        parceiro_id: editing.parceiro_id ?? "",
        utm_source: editing.utm_source ?? "",
        utm_medium: editing.utm_medium ?? "",
        utm_campaign: editing.utm_campaign ?? "",
        observacoes: editing.observacoes ?? "",
      });
    } else {
      setForm(vazio());
    }
  }, [open, editing]);

  const { data: canais } = useQuery({
    queryKey: ["canais-marketing-mini"],
    queryFn: async () => (await supabase.from("canais_marketing").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: campanhas } = useQuery({
    queryKey: ["campanhas-mini"],
    queryFn: async () => (await supabase.from("campanhas").select("id, nome").order("nome")).data ?? [],
  });

  const { data: equipe } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome").order("nome")).data ?? [],
  });

  const { data: primeiraEtapa } = useQuery({
    queryKey: ["etapa-inicial"],
    queryFn: async () =>
      (await supabase.from("pipeline_etapas").select("id").eq("ativo", true).order("ordem", { ascending: true }).limit(1).maybeSingle()).data,
    enabled: !editing,
  });

  const canalSelecionado = canais?.find((c) => c.id === form.canal_id);
  const canalNome = canalSelecionado?.nome.toLowerCase() ?? "";
  const isIndicacao = canalNome.includes("indica");
  const isEscola = canalNome.includes("escola");
  const isInstagram = canalNome.includes("instagram");
  const isGoogle = canalNome.includes("google");
  const isEstrategico = isIndicacao || isEscola || isInstagram || isGoogle || form.canal_id === ORIGEM_NAO_IDENTIFICADA;

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        nome_paciente: form.nome_paciente.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        canal_id: form.canal_id === ORIGEM_NAO_IDENTIFICADA ? null : form.canal_id,
        campanha_id: form.campanha_id || null,
        responsavel_id: form.responsavel_id || null,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        origem_detalhe: form.origem_detalhe.trim() || (form.canal_id === ORIGEM_NAO_IDENTIFICADA ? "Origem não identificada" : null),
        indicador_nome: form.indicador_nome.trim() || null,
        parceiro_id: form.parceiro_id.trim() || null,
        utm_source: form.utm_source.trim() || null,
        utm_medium: form.utm_medium.trim() || null,
        utm_campaign: form.utm_campaign.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!primeiraEtapa?.id) throw new Error("Nenhuma etapa de funil configurada");
        const { error } = await supabase.from("leads").insert({
          ...payload,
          etapa_id: primeiraEtapa.id,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Lead atualizado" : "Lead criado");
      invalidarMarketing(qc);
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do contato *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Nome do paciente (se diferente)</Label>
              <Input value={form.nome_paciente} onChange={(e) => setForm({ ...form, nome_paciente: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="55 21 99999-9999" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal de origem *</Label>
              <Select value={form.canal_id} onValueChange={(v) => setForm({ ...form, canal_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ORIGEM_NAO_IDENTIFICADA}>Origem não identificada</SelectItem>
                  {canais?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campanha (opcional)</Label>
              <Select value={form.campanha_id || NENHUM} onValueChange={(v) => setForm({ ...form, campanha_id: v === NENHUM ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem campanha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Sem campanha</SelectItem>
                  {campanhas?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsavel_id || NENHUM} onValueChange={(v) => setForm({ ...form, responsavel_id: v === NENHUM ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Sem responsável</SelectItem>
                  {equipe?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor estimado (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} />
            </div>
          </div>
          {isEstrategico && (
            <div className="rounded-lg border border-border/50 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Detalhes da origem</p>
              <div>
                <Label>{form.canal_id === ORIGEM_NAO_IDENTIFICADA ? "Como chegou até a clínica?" : "Detalhe da origem"}</Label>
                <Input
                  value={form.origem_detalhe}
                  onChange={(e) => setForm({ ...form, origem_detalhe: e.target.value })}
                  placeholder="Ex.: post específico, busca, evento, conversa..."
                />
              </div>
              {isIndicacao && (
                <div>
                  <Label>Nome de quem indicou</Label>
                  <Input value={form.indicador_nome} onChange={(e) => setForm({ ...form, indicador_nome: e.target.value })} />
                </div>
              )}
              {isEscola && (
                <div>
                  <Label>ID do parceiro/escola</Label>
                  <Input value={form.parceiro_id} onChange={(e) => setForm({ ...form, parceiro_id: e.target.value })} placeholder="UUID do parceiro, quando houver" />
                </div>
              )}
              {(isInstagram || isGoogle) && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>UTM source</Label>
                    <Input value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} placeholder={isInstagram ? "instagram" : "google"} />
                  </div>
                  <div>
                    <Label>UTM medium</Label>
                    <Input value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} placeholder="organic / cpc" />
                  </div>
                  <div>
                    <Label>UTM campaign</Label>
                    <Input value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="gradient-brand text-white"
            disabled={!form.nome.trim() || !form.canal_id || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {editing ? "Salvar" : "Criar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
