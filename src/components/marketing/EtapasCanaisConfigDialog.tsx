import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export function EtapasCanaisConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-xl">
        <DialogHeader><DialogTitle>Configurar funil e canais</DialogTitle></DialogHeader>
        <Tabs defaultValue="etapas">
          <TabsList>
            <TabsTrigger value="etapas">Etapas do funil</TabsTrigger>
            <TabsTrigger value="canais">Canais de origem</TabsTrigger>
          </TabsList>
          <TabsContent value="etapas" className="mt-3"><EtapasConfig /></TabsContent>
          <TabsContent value="canais" className="mt-3"><CanaisConfig /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EtapasConfig() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#064570");
  const [tipo, setTipo] = useState("ativo");

  const { data: etapas } = useQuery({
    queryKey: ["etapas-config"],
    queryFn: async () => (await supabase.from("pipeline_etapas").select("*").order("ordem")).data ?? [],
  });

  const criar = useMutation({
    mutationFn: async () => {
      const maxOrdem = Math.max(0, ...(etapas ?? []).map((e) => e.ordem));
      const { error } = await supabase.from("pipeline_etapas").insert({ nome: nome.trim(), cor, tipo, ordem: maxOrdem + 1 });
      if (error) throw error;
    },
    onSuccess: () => { setNome(""); qc.invalidateQueries({ queryKey: ["etapas-config"] }); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_etapas").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etapas-config"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const lista = [...(etapas ?? [])];
      const idx = lista.findIndex((e) => e.id === id);
      const alvo = idx + delta;
      if (alvo < 0 || alvo >= lista.length) return;
      const a = lista[idx], b = lista[alvo];
      await supabase.from("pipeline_etapas").update({ ordem: b.ordem }).eq("id", a.id);
      await supabase.from("pipeline_etapas").update({ ordem: a.ordem }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etapas-config"] }),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {etapas?.filter((e) => e.ativo).map((e, i, arr) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-1.5">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
            <span className="flex-1 text-sm truncate">{e.nome}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{e.tipo}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => mover.mutate({ id: e.id, delta: -1 })}>↑</Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === arr.length - 1} onClick={() => mover.mutate({ id: e.id, delta: 1 })}>↓</Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => remover.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Input placeholder="Nova etapa" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" />
        <Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="w-12 p-1" />
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="ganho">Ganho</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!nome.trim() || criar.isPending} onClick={() => criar.mutate()}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

const TIPOS_ORIGEM_INDICADORES = [
  { value: "sem_indicador", label: "Sem indicador automático" },
  { value: "indicacao", label: "Indicações recebidas" },
  { value: "escola", label: "Encaminhamentos das escolas" },
];

function CanaisConfig() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [tipoOrigem, setTipoOrigem] = useState("sem_indicador");

  const { data: canais } = useQuery({
    queryKey: ["canais-config"],
    queryFn: async () => (await supabase.from("canais_marketing").select("*").order("nome")).data ?? [],
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("canais_marketing")
        .insert({ nome: nome.trim(), tipo_origem: tipoOrigem === "sem_indicador" ? null : tipoOrigem });
      if (error) throw error;
    },
    onSuccess: () => { setNome(""); setTipoOrigem("sem_indicador"); qc.invalidateQueries({ queryKey: ["canais-config"] }); qc.invalidateQueries({ queryKey: ["canais-marketing-mini"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarTipoOrigem = useMutation({
    mutationFn: async ({ id, tipoOrigem }: { id: string; tipoOrigem: string }) => {
      const { error } = await supabase
        .from("canais_marketing")
        .update({ tipo_origem: tipoOrigem === "sem_indicador" ? null : tipoOrigem })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canais-config"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("canais_marketing").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canais-config"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <p>
          Os indicadores automáticos usam o tipo de origem, não o nome do canal. Marque o canal que alimenta
          “Indicações recebidas” ou “Encaminhamentos das escolas” para manter os cartões funcionando mesmo se o nome mudar.
        </p>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {canais?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-1.5">
            <span className={`flex-1 text-sm ${!c.ativo ? "text-muted-foreground line-through" : ""}`}>{c.nome}</span>
            <Select value={c.tipo_origem ?? "sem_indicador"} onValueChange={(value) => atualizarTipoOrigem.mutate({ id: c.id, tipoOrigem: value })}>
              <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_ORIGEM_INDICADORES.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => alternar.mutate({ id: c.id, ativo: !c.ativo })}>
              {c.ativo ? "Desativar" : "Ativar"}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Input placeholder="Novo canal" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" />
        <Select value={tipoOrigem} onValueChange={setTipoOrigem}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_ORIGEM_INDICADORES.map((tipo) => (
              <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!nome.trim() || criar.isPending} onClick={() => criar.mutate()}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
