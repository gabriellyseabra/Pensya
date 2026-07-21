import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Departamento } from "./types";
import { conteudoModelo } from "./types";

export function NovoProcessoDialog({
  open, onOpenChange, departamentos, departamentoInicial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  departamentos: Departamento[];
  departamentoInicial?: string | null;
}) {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [emoji, setEmoji] = useState("");
  const [departamentoId, setDepartamentoId] = useState<string>(departamentoInicial ?? "");
  const [usarModelo, setUsarModelo] = useState(true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Informe um título"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from("processos")
        .insert({
          titulo: titulo.trim(),
          emoji: emoji.trim() || null,
          departamento_id: departamentoId || null,
          conteudo: usarModelo ? conteudoModelo() : {},
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Processo criado");
      onOpenChange(false);
      setTitulo(""); setEmoji(""); setUsarModelo(true);
      navigate({ to: "/processos/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo processo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <div>
              <Label className="text-xs">Ícone</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="⚙️" maxLength={2} className="text-center" />
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Onboarding de novo cliente" autoFocus />
            </div>
          </div>
          <div>
            <Label className="text-xs">Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Começar do modelo POP</p>
              <p className="text-xs text-muted-foreground">Cria as seções do template já estruturadas.</p>
            </div>
            <Switch checked={usarModelo} onCheckedChange={setUsarModelo} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Criando…" : "Criar processo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
