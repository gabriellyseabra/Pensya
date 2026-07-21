import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export type Lanc = {
  id: string; tipo: string; status: string; descricao: string; valor: number;
  vencimento: string; pago_em: string | null; competencia: string;
  conta_id: string | null; plano_conta_id: string | null;
  tipo_servico_id: string | null; centro_custo_id: string | null;
  fornecedor_id: string | null; paciente_id: string | null;
  forma_pagamento: string | null; observacoes: string | null;
};

/** Campos + lógica de salvar de um lançamento (receita/despesa) em `lancamentos_financeiros`. */
export function LancamentoForm({
  editing, onSaved, onCancel,
}: {
  editing: Lanc | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Lanc>>(editing ?? { tipo: "despesa", status: "previsto", vencimento: new Date().toISOString().slice(0, 10), competencia: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  // Enquanto falso, mudar o Vencimento também atualiza a Competência (mesmo mês).
  // Assim que o usuário mexe na Competência diretamente, os dois passam a ser independentes
  // (ex.: pago em junho, mas referente à competência de maio).
  const [competenciaManual, setCompetenciaManual] = useState(false);

  useEffect(() => {
    setForm(editing ?? { tipo: "despesa", status: "previsto", vencimento: new Date().toISOString().slice(0, 10), competencia: new Date().toISOString().slice(0, 10) });
    setCompetenciaManual(false);
  }, [editing]);

  const { data: contas } = useQuery({
    queryKey: ["sel-contas"],
    queryFn: async () => (await supabase.from("contas_financeiras").select("id, nome").eq("ativo", true).order("ordem")).data ?? [],
  });
  const { data: planos } = useQuery({
    queryKey: ["sel-planos", form.tipo],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome, tipo, parent_id").eq("ativo", true).order("codigo")).data ?? [],
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["sel-fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: tipos } = useQuery({
    queryKey: ["sel-tipos"],
    queryFn: async () => (await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const planosFiltrados = (planos ?? []).filter((p: any) => p.tipo === form.tipo && p.parent_id);

  async function salvar() {
    setSaving(true);
    try {
      const payload: any = {
        tipo: form.tipo, status: form.status ?? "previsto",
        descricao: form.descricao || "Sem descrição", valor: Number(form.valor || 0),
        vencimento: form.vencimento, competencia: form.competencia || form.vencimento,
        pago_em: form.status === "confirmado" ? (form.pago_em ?? new Date().toISOString().slice(0, 10)) : null,
        conta_id: form.conta_id || null, plano_conta_id: form.plano_conta_id || null,
        tipo_servico_id: form.tipo_servico_id || null, centro_custo_id: form.centro_custo_id || null,
        fornecedor_id: form.fornecedor_id || null, paciente_id: form.paciente_id || null,
        forma_pagamento: form.forma_pagamento || null, observacoes: form.observacoes || null,
      };
      if (editing?.id) {
        const { error } = await supabase.from("lancamentos_financeiros").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lancamentos_financeiros").insert(payload);
        if (error) throw error;
      }
      toast.success("Lançamento salvo");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="previsto">Previsto</SelectItem>
              <SelectItem value="confirmado">Confirmado / Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição</Label>
          <Input value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Vencimento</Label>
          <Input
            type="date" value={form.vencimento ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({
                ...f,
                vencimento: v,
                competencia: competenciaManual ? f.competencia : (v ? `${v.slice(0, 7)}-01` : f.competencia),
              }));
            }}
          />
        </div>
        <div>
          <Label>Competência (mês de referência)</Label>
          <Input
            type="month" value={(form.competencia ?? "").slice(0, 7)}
            onChange={(e) => {
              setCompetenciaManual(true);
              setForm({ ...form, competencia: e.target.value ? `${e.target.value}-01` : undefined });
            }}
          />
        </div>
        <div>
          <Label>Plano de contas</Label>
          <Select value={form.plano_conta_id ?? ""} onValueChange={(v) => setForm({ ...form, plano_conta_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {planosFiltrados.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conta / caixa</Label>
          <Select value={form.conta_id ?? ""} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(contas ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {form.tipo === "despesa" && (
          <div>
            <Label>Fornecedor</Label>
            <Select value={form.fornecedor_id ?? ""} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {(fornecedores ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {form.tipo === "receita" && (
          <div>
            <Label>Tipo de serviço</Label>
            <Select value={form.tipo_servico_id ?? ""} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {(tipos ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Forma de pagamento</Label>
          <Input value={form.forma_pagamento ?? ""} placeholder="PIX, dinheiro, cartão..." onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">Salvar</Button>
      </DialogFooter>
    </>
  );
}
