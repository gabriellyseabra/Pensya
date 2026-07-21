import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Globe, Users, Lock, Plus, Trash2 } from "lucide-react";
import type { Processo, Visibilidade } from "./types";

const db = supabase;

export function CompartilharProcessoDialog({
  open, onOpenChange, processo, equipe, onChanged,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  processo: Processo;
  equipe: { id: string; nome: string | null }[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [vis, setVis] = useState<Visibilidade>(processo.visibilidade);
  const [novoUser, setNovoUser] = useState("");

  useEffect(() => { if (open) setVis(processo.visibilidade); }, [open, processo.visibilidade]);

  const { data: acessos = [] } = useQuery({
    queryKey: ["processo-acessos", processo.id],
    queryFn: async () => (await db.from("processo_acessos").select("*").eq("processo_id", processo.id)).data ?? [],
    enabled: open,
  });

  const linkPublico = typeof window !== "undefined" ? `${window.location.origin}/processo-publico/${processo.share_token}` : "";

  async function mudarVisibilidade(v: Visibilidade) {
    setVis(v);
    const { error } = await db.from("processos").update({ visibilidade: v }).eq("id", processo.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  async function adicionarAcesso() {
    if (!novoUser) return;
    const { error } = await db.from("processo_acessos").insert({ processo_id: processo.id, user_id: novoUser, papel: "leitor" });
    if (error) { toast.error(error.message); return; }
    setNovoUser("");
    qc.invalidateQueries({ queryKey: ["processo-acessos", processo.id] });
  }
  async function mudarPapel(id: string, papel: string) {
    await db.from("processo_acessos").update({ papel }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["processo-acessos", processo.id] });
  }
  async function removerAcesso(id: string) {
    await db.from("processo_acessos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["processo-acessos", processo.id] });
  }

  const nomePorId = (id: string) => equipe.find((e) => e.id === id)?.nome ?? "Membro";
  const jaComAcesso = new Set((acessos as any[]).map((a) => a.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Compartilhar processo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium mb-1.5">Quem pode ver</p>
            <Select value={vis} onValueChange={(v) => mudarVisibilidade(v as Visibilidade)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equipe"><span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />Toda a equipe</span></SelectItem>
                <SelectItem value="restrito"><span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" />Restrito a pessoas específicas</span></SelectItem>
                <SelectItem value="publico"><span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" />Qualquer pessoa com o link</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {vis === "restrito" && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Pessoas com acesso</p>
              {(acessos as any[]).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{nomePorId(a.user_id)}</span>
                  <Select value={a.papel} onValueChange={(v) => mudarPapel(a.id, v)}>
                    <SelectTrigger className="h-7 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="leitor">Leitor</SelectItem><SelectItem value="editor">Editor</SelectItem></SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removerAcesso(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Select value={novoUser} onValueChange={setNovoUser}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Adicionar membro…" /></SelectTrigger>
                  <SelectContent>
                    {equipe.filter((e) => !jaComAcesso.has(e.id)).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome ?? "—"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={adicionarAcesso} disabled={!novoUser}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {vis === "publico" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-brand" />Link público (somente leitura)</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={linkPublico} className="h-8 text-xs" />
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success("Link copiado"); }}>
                  <Copy className="w-3.5 h-3.5 mr-1" />Copiar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Qualquer pessoa com este link vê o processo, sem precisar de login.</p>
            </div>
          )}

          <Badge variant="secondary" className="text-[10px]">
            {vis === "equipe" ? "Visível para toda a equipe" : vis === "restrito" ? "Acesso restrito" : "Compartilhado por link"}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
