import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export type Lanc = {
  id: string; tipo: string; status: string; descricao: string; valor: number;
  vencimento: string; pago_em: string | null; competencia: string;
  conta_id: string | null; plano_conta_id: string | null;
  tipo_servico_id: string | null; centro_custo_id: string | null;
  fornecedor_id: string | null; paciente_id: string | null;
  forma_pagamento: string | null; observacoes: string | null;
  forma_recebimento_id?: string | null; taxa?: number | null; valor_liquido?: number | null;
};

/** Campos + lógica de salvar de um lançamento (receita/despesa) em `lancamentos_financeiros`. */
export function LancamentoForm({
  editing, onSaved, onCancel,
}: {
  editing: Lanc | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Lanc>>(editing ?? { tipo: "despesa", status: "previsto", vencimento: new Date().toISOString().slice(0, 10), competencia: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  // Criação inline de centro de custo (para não precisar ir às configurações).
  const [novoCentroAberto, setNovoCentroAberto] = useState(false);
  const [novoCentroNome, setNovoCentroNome] = useState("");
  const [criandoCentro, setCriandoCentro] = useState(false);
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
  const { data: formas } = useQuery({
    queryKey: ["sel-formas-recebimento"],
    queryFn: async () =>
      (await supabase.from("formas_recebimento").select("id, nome, taxa_percentual, taxa_fixa, conta_padrao_id").eq("ativo", true).order("ordem")).data ?? [],
  });
  const { data: centros } = useQuery({
    queryKey: ["sel-centros"],
    queryFn: async () => (await supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  async function criarCentro() {
    const nome = novoCentroNome.trim();
    if (!nome) return;
    setCriandoCentro(true);
    try {
      const { data, error } = await supabase.from("centros_custo").insert({ nome }).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["sel-centros"] });
      setForm((f) => ({ ...f, centro_custo_id: data.id }));
      setNovoCentroNome("");
      setNovoCentroAberto(false);
      toast.success("Centro de custo criado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar centro de custo");
    } finally {
      setCriandoCentro(false);
    }
  }

  const planosFiltrados = (planos ?? []).filter((p: any) => p.tipo === form.tipo && p.parent_id);

  // Calcula taxa e líquido a partir da forma escolhida e do valor.
  const formaSel = (formas ?? []).find((f: any) => f.id === form.forma_recebimento_id);
  const valorNum = Number(form.valor || 0);
  const taxaCalc = formaSel ? valorNum * (Number(formaSel.taxa_percentual || 0) / 100) + Number(formaSel.taxa_fixa || 0) : 0;
  const liquidoCalc = valorNum - taxaCalc;

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
        forma_recebimento_id: form.forma_recebimento_id || null,
        // Mantém o texto de forma_pagamento em sincronia (retrocompatibilidade/telas antigas).
        forma_pagamento: formaSel?.nome ?? form.forma_pagamento ?? null,
        taxa: formaSel ? Number(taxaCalc.toFixed(2)) : 0,
        valor_liquido: formaSel ? Number(liquidoCalc.toFixed(2)) : null,
        observacoes: form.observacoes || null,
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
          <Label>Forma de recebimento</Label>
          <Select
            value={form.forma_recebimento_id ?? ""}
            onValueChange={(v) => {
              const f = (formas ?? []).find((x: any) => x.id === v);
              setForm((prev) => ({
                ...prev,
                forma_recebimento_id: v,
                // Se a forma tem conta padrão e ainda não escolhemos conta, sugere.
                conta_id: prev.conta_id || f?.conta_padrao_id || null,
              }));
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(formas ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {formaSel && taxaCalc > 0 && valorNum > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Taxa: R$ {taxaCalc.toFixed(2)} · Líquido: <span className="font-medium text-foreground">R$ {liquidoCalc.toFixed(2)}</span>
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Centro de custo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            {!novoCentroAberto && (
              <button
                type="button"
                onClick={() => setNovoCentroAberto(true)}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Plus className="h-3 w-3" /> Novo
              </button>
            )}
          </div>
          {novoCentroAberto ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={novoCentroNome}
                placeholder="Nome do centro de custo"
                onChange={(e) => setNovoCentroNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criarCentro(); } }}
              />
              <Button type="button" size="icon" className="h-9 w-9 shrink-0 gradient-brand text-white" disabled={criandoCentro} onClick={criarCentro}>
                <Check className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setNovoCentroAberto(false); setNovoCentroNome(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select value={form.centro_custo_id ?? "__none"} onValueChange={(v) => setForm({ ...form, centro_custo_id: v === "__none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {(centros ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
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
