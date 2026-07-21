import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

type Item = { id: string; tipo: string; descricao: string; valor: number; data: string };

export function EntradaRapida() {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tipo: "despesa" as "receita" | "despesa",
    data: hoje,
    descricao: "",
    valor: "",
    plano_conta_id: "",
    tipo_servico_id: "",
    status: "confirmado" as "previsto" | "confirmado",
  });
  const [sessao, setSessao] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: tipos } = useQuery({
    queryKey: ["er-tipos"],
    queryFn: async () => (await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: planos } = useQuery({
    queryKey: ["er-planos"],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome, tipo, parent_id").eq("ativo", true).order("codigo")).data ?? [],
  });
  const planosFiltrados = (planos ?? []).filter((p: any) => p.tipo === form.tipo && p.parent_id);

  async function adicionar() {
    if (!form.descricao.trim() || !Number(form.valor)) { toast.error("Descrição e valor são obrigatórios"); return; }
    setSaving(true);
    try {
      const payload: any = {
        tipo: form.tipo,
        status: form.status,
        descricao: form.descricao.trim(),
        valor: Number(form.valor),
        vencimento: form.data,
        competencia: form.data,
        pago_em: form.status === "confirmado" ? form.data : null,
        plano_conta_id: form.tipo === "despesa" ? (form.plano_conta_id || null) : null,
        tipo_servico_id: form.tipo === "receita" ? (form.tipo_servico_id || null) : null,
      };
      const { data, error } = await supabase.from("lancamentos_financeiros").insert(payload).select("id").single();
      if (error) throw error;
      setSessao([{ id: data.id, tipo: form.tipo, descricao: form.descricao, valor: Number(form.valor), data: form.data }, ...sessao]);
      setForm({ ...form, descricao: "", valor: "" });
      invalidarFinanceiro(qc);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally { setSaving(false); }
  }

  async function desfazer(id: string) {
    await supabase.from("lancamentos_financeiros").delete().eq("id", id);
    setSessao(sessao.filter(s => s.id !== id));
    invalidarFinanceiro(qc);
    toast.success("Desfeito");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v, plano_conta_id: "", tipo_servico_id: "" })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmado">Realizado</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="h-9" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="h-9" placeholder="Ex.: Aluguel sala 2" onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{form.tipo === "receita" ? "Tipo de serviço" : "Plano de contas"}</Label>
            {form.tipo === "receita" ? (
              <Select value={form.tipo_servico_id} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{(tipos ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Select value={form.plano_conta_id} onValueChange={(v) => setForm({ ...form, plano_conta_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{planosFiltrados.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </div>
        <Button onClick={adicionar} disabled={saving} className="gradient-brand text-white w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          Adicionar e continuar (Enter)
        </Button>
        <p className="text-[11px] text-muted-foreground">Dica: data, tipo, status e categoria são mantidos entre lançamentos para acelerar a digitação.</p>
      </div>

      <div className="border rounded p-3 bg-card/40 max-h-[420px] overflow-y-auto">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Adicionados nesta sessão ({sessao.length})</h4>
        {sessao.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum ainda.</p>
        ) : (
          <ul className="space-y-1">
            {sessao.map(s => (
              <li key={s.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/40">
                <Badge variant={s.tipo === "receita" ? "default" : "destructive"} className="text-[10px]">{s.tipo}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{s.descricao}</div>
                  <div className="text-muted-foreground text-[10px]">{s.data} · {s.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => desfazer(s.id)} title="Desfazer">
                  <Undo2 className="w-3 h-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
