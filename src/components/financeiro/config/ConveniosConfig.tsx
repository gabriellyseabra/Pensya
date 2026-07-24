import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, Tags, DollarSign } from "lucide-react";
import { toast } from "sonner";

type Convenio = {
  id: string;
  nome: string;
  ativo: boolean;
};

type TipoServico = { id: string; nome: string };

export function ConveniosConfig() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Convenio | null>(null);
  const [open, setOpen] = useState(false);
  const [valoresDe, setValoresDe] = useState<Convenio | null>(null);
  const queryKey = ["config", "convenios"];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenios")
        .select("id, nome, ativo")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Convenio[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convenios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Convênios</h3>
          <p className="text-xs text-muted-foreground">Planos e convênios atendidos pela clínica — defina o valor que cada um paga por procedimento.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Novo convênio
        </Button>
      </div>

      <div className="space-y-1">
        {rows?.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum convênio cadastrado.</p>}
        {rows?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md gradient-brand text-brand-foreground">
                <Tags className="h-4 w-4" />
              </span>
              <p className="text-sm font-medium truncate">{c.nome}</p>
              {!c.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setValoresDe(c)}>
                <DollarSign className="mr-1 h-4 w-4" />Valores
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{editing ? "Editar convênio" : "Novo convênio"}</DialogTitle></DialogHeader>
          <ConvenioForm
            editing={editing}
            onSaved={() => { qc.invalidateQueries({ queryKey }); setOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!valoresDe} onOpenChange={(o) => !o && setValoresDe(null)}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Valores por procedimento{valoresDe ? ` — ${valoresDe.nome}` : ""}</DialogTitle></DialogHeader>
          {valoresDe && <ValoresForm convenio={valoresDe} onSaved={() => setValoresDe(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ConvenioForm({ editing, onSaved }: { editing: Convenio | null; onSaved: () => void }) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const payload = { nome: nome || "Convênio", ativo };
      if (editing?.id) {
        const { error } = await supabase.from("convenios").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("convenios").insert(payload);
        if (error) throw error;
      }
      toast.success("Convênio salvo");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Unimed, Bradesco Saúde…" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Convênio ativo
      </label>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

function ValoresForm({ convenio, onSaved }: { convenio: Convenio; onSaved: () => void }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: tipos } = useQuery({
    queryKey: ["conv-tipos-servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as TipoServico[];
    },
  });

  const { data: existentes } = useQuery({
    queryKey: ["conv-valores", convenio.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenio_valores")
        .select("tipo_servico_id, valor")
        .eq("convenio_id", convenio.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!existentes) return;
    const map: Record<string, string> = {};
    for (const r of existentes as any[]) {
      if (r.tipo_servico_id) map[r.tipo_servico_id] = String(r.valor ?? "");
    }
    setValores(map);
  }, [existentes]);

  async function salvar() {
    setSaving(true);
    try {
      const linhas = (tipos ?? [])
        .filter((t) => valores[t.id] !== undefined && valores[t.id] !== "")
        .map((t) => ({
          convenio_id: convenio.id,
          tipo_servico_id: t.id,
          valor: Number(valores[t.id]) || 0,
        }));
      if (linhas.length > 0) {
        const { error } = await supabase
          .from("convenio_valores")
          .upsert(linhas, { onConflict: "convenio_id,tipo_servico_id" });
        if (error) throw error;
      }
      toast.success("Valores salvos");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Informe quanto este convênio paga por cada procedimento. Deixe em branco os que não se aplicam.</p>
      <div className="space-y-2">
        {(tipos?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground py-2">Nenhum tipo de serviço ativo. Cadastre em "Tipos de serviço".</p>
        )}
        {tipos?.map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <Label className="flex-1 truncate">{t.nome}</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                className="w-28"
                value={valores[t.id] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [t.id]: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar valores
        </Button>
      </DialogFooter>
    </div>
  );
}
