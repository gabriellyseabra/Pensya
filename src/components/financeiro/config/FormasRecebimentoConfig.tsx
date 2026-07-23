import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Forma = {
  id: string;
  nome: string;
  tipo: string;
  taxa_percentual: number;
  taxa_fixa: number;
  prazo_dias: number;
  conta_padrao_id: string | null;
  ativo: boolean;
};

export const TIPOS_FORMA = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência / TED" },
  { value: "outro", label: "Outro" },
];

/** Formas comuns pré-configuradas para a clínica começar em 1 clique. */
const PADROES: Omit<Forma, "id" | "conta_padrao_id" | "ativo">[] = [
  { nome: "Dinheiro", tipo: "dinheiro", taxa_percentual: 0, taxa_fixa: 0, prazo_dias: 0 },
  { nome: "Pix", tipo: "pix", taxa_percentual: 0, taxa_fixa: 0, prazo_dias: 0 },
  { nome: "Cartão de débito", tipo: "debito", taxa_percentual: 1.99, taxa_fixa: 0, prazo_dias: 1 },
  { nome: "Cartão de crédito", tipo: "credito", taxa_percentual: 3.99, taxa_fixa: 0, prazo_dias: 30 },
  { nome: "Boleto", tipo: "boleto", taxa_percentual: 0, taxa_fixa: 2.5, prazo_dias: 3 },
];

function resumoTaxa(f: Pick<Forma, "taxa_percentual" | "taxa_fixa" | "prazo_dias">): string {
  const partes: string[] = [];
  if (Number(f.taxa_percentual) > 0) partes.push(`${f.taxa_percentual}%`);
  if (Number(f.taxa_fixa) > 0) partes.push(`R$ ${Number(f.taxa_fixa).toFixed(2)}`);
  const taxa = partes.length ? partes.join(" + ") : "sem taxa";
  return f.prazo_dias > 0 ? `${taxa} · ${f.prazo_dias}d` : taxa;
}

export function FormasRecebimentoConfig() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Forma | null>(null);
  const [open, setOpen] = useState(false);
  const queryKey = ["config", "formas_recebimento"];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_recebimento")
        .select("id, nome, tipo, taxa_percentual, taxa_fixa, prazo_dias, conta_padrao_id, ativo")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Forma[];
    },
  });

  const { data: contas } = useQuery({
    queryKey: ["sel-contas-simple"],
    queryFn: async () => (await supabase.from("contas_financeiras").select("id, nome").eq("ativo", true).order("ordem")).data ?? [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("formas_recebimento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("formas_recebimento").insert(
        PADROES.map((p, i) => ({ ...p, ordem: i })),
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Formas padrão criadas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Formas de recebimento</h3>
          <p className="text-xs text-muted-foreground">Dinheiro, Pix, cartão… com a taxa de cada um — o sistema calcula o valor líquido.</p>
        </div>
        <div className="flex gap-1.5">
          {rows?.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
              <Sparkles className="mr-1.5 h-4 w-4" />Criar padrão
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-brand-foreground">
            <Plus className="mr-2 h-4 w-4" />Nova
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {rows?.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma forma cadastrada.</p>}
        {rows?.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {f.nome} <span className="text-xs font-normal text-muted-foreground">· {TIPOS_FORMA.find((t) => t.value === f.tipo)?.label ?? f.tipo}</span>
              </p>
              <span className="text-xs text-muted-foreground">{resumoTaxa(f)}</span>
            </div>
            <div className="flex items-center gap-1">
              {!f.ativo && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
              <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{editing ? "Editar forma" : "Nova forma de recebimento"}</DialogTitle></DialogHeader>
          <FormaForm
            editing={editing}
            contas={contas ?? []}
            onSaved={() => { qc.invalidateQueries({ queryKey }); setOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FormaForm({
  editing, contas, onSaved,
}: {
  editing: Forma | null;
  contas: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [tipo, setTipo] = useState(editing?.tipo ?? "pix");
  const [pct, setPct] = useState(editing?.taxa_percentual != null ? String(editing.taxa_percentual) : "0");
  const [fixa, setFixa] = useState(editing?.taxa_fixa != null ? String(editing.taxa_fixa) : "0");
  const [prazo, setPrazo] = useState(editing?.prazo_dias != null ? String(editing.prazo_dias) : "0");
  const [conta, setConta] = useState(editing?.conta_padrao_id ?? "");
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const payload = {
        nome: nome || "Forma",
        tipo,
        taxa_percentual: Number(pct) || 0,
        taxa_fixa: Number(fixa) || 0,
        prazo_dias: Number(prazo) || 0,
        conta_padrao_id: conta || null,
        ativo,
      };
      if (editing?.id) {
        const { error } = await supabase.from("formas_recebimento").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("formas_recebimento").insert(payload);
        if (error) throw error;
      }
      toast.success("Forma salva");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Crédito Stone" />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_FORMA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Taxa (%)</Label>
          <Input type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div>
          <Label>Taxa fixa (R$)</Label>
          <Input type="number" step="0.01" value={fixa} onChange={(e) => setFixa(e.target.value)} />
        </div>
        <div>
          <Label>Prazo (dias)</Label>
          <Input type="number" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Conta de destino padrão (opcional)</Label>
        <Select value={conta || "__none"} onValueChange={(v) => setConta(v === "__none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Nenhuma</SelectItem>
            {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Forma ativa
      </label>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}
