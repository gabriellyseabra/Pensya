import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Departamento } from "./types";

export function DepartamentosConfigDialog({
  open, onOpenChange, departamentos,
}: { open: boolean; onOpenChange: (b: boolean) => void; departamentos: Departamento[] }) {
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [saving, setSaving] = useState(false);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["departamentos"] });

  async function adicionar() {
    if (!novoNome.trim()) return;
    setSaving(true);
    const ordem = Math.max(0, ...departamentos.map((d) => d.ordem)) + 1;
    const { error } = await supabase.from("departamentos").insert({ nome: novoNome.trim(), ordem });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNovoNome("");
    invalidar();
  }

  async function atualizar(id: string, patch: Partial<Departamento>) {
    const { error } = await supabase.from("departamentos").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este departamento? Os processos dele ficarão sem departamento.")) return;
    const { error } = await supabase.from("departamentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidar();
  }

  async function mover(dep: Departamento, dir: -1 | 1) {
    const ordenados = [...departamentos].sort((a, b) => a.ordem - b.ordem);
    const idx = ordenados.findIndex((d) => d.id === dep.id);
    const alvo = ordenados[idx + dir];
    if (!alvo) return;
    await atualizar(dep.id, { ordem: alvo.ordem });
    await atualizar(alvo.id, { ordem: dep.ordem });
  }

  const ordenados = [...departamentos].sort((a, b) => a.ordem - b.ordem);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Departamentos</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {ordenados.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg border p-2">
              <input
                type="color" value={d.cor}
                onChange={(e) => atualizar(d.id, { cor: e.target.value })}
                className="h-7 w-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                title="Cor"
              />
              <Input
                defaultValue={d.nome}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== d.nome) atualizar(d.id, { nome: e.target.value.trim() }); }}
                className="h-8"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => mover(d, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === ordenados.length - 1} onClick={() => mover(d, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir(d.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Novo departamento" onKeyDown={(e) => e.key === "Enter" && adicionar()} className="h-9" />
          <Button size="sm" onClick={adicionar} disabled={saving || !novoNome.trim()}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Apenas administradores conseguem gerenciar departamentos.</p>
      </DialogContent>
    </Dialog>
  );
}
