import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Compass } from "lucide-react";

export type Objetivo = {
  id: string;
  plano_id: string;
  titulo: string;
  dominio_funcional: string | null;
  descricao: string | null;
  status: string;
  ordem: number;
};

/**
 * Objetivos terapêuticos (ETAPA 5) — poucos, cada um um domínio funcional.
 * Cada card lista as metas vinculadas (renderizadas pelo pai via renderMetas).
 */
export function ObjetivosEditor({
  planoId, objetivos, metasSemObjetivo, renderMetas, novaMetaSlot,
}: {
  planoId: string;
  objetivos: Objetivo[];
  metasSemObjetivo: React.ReactNode;
  renderMetas: (objetivoId: string) => React.ReactNode;
  novaMetaSlot: (objetivoId: string | null) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plano-objetivos", planoId] });

  async function adicionar() {
    const { error } = await supabase.from("plano_objetivos").insert({
      plano_id: planoId, titulo: "Novo objetivo", ordem: objetivos.length, origem: "manual",
    });
    if (error) { toast.error(error.message); return; }
    invalidate();
  }

  return (
    <div className="space-y-3">
      {objetivos.map((o) => (
        <ObjetivoCard key={o.id} objetivo={o} onChanged={invalidate}>
          {renderMetas(o.id)}
          {novaMetaSlot(o.id)}
        </ObjetivoCard>
      ))}

      <Button variant="outline" size="sm" onClick={adicionar}>
        <Plus className="mr-2 h-4 w-4" />Adicionar objetivo
      </Button>

      {metasSemObjetivo}
    </div>
  );
}

function ObjetivoCard({ objetivo, onChanged, children }: { objetivo: Objetivo; onChanged: () => void; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...objetivo });

  async function salvar() {
    const { error } = await supabase.from("plano_objetivos").update({
      titulo: form.titulo, dominio_funcional: form.dominio_funcional, descricao: form.descricao,
    }).eq("id", objetivo.id);
    if (error) { toast.error(error.message); return; }
    setEditing(false);
    onChanged();
  }
  async function excluir() {
    if (!confirm("Excluir objetivo? As metas ficam sem objetivo (não são apagadas).")) return;
    await supabase.from("plano_objetivos").delete().eq("id", objetivo.id);
    onChanged();
  }

  return (
    <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Objetivo (domínio funcional)" />
              <Input value={form.dominio_funcional ?? ""} onChange={(e) => setForm({ ...form, dominio_funcional: e.target.value })} placeholder="Domínio funcional (ex.: Produção escrita escolar)" className="h-8 text-xs" />
              <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição (opcional)" className="text-xs" />
            </div>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Compass className="h-4 w-4 text-brand" />{objetivo.titulo}
              </p>
              {objetivo.dominio_funcional && <Badge variant="outline" className="mt-1 text-[10px]">{objetivo.dominio_funcional}</Badge>}
              {objetivo.descricao && <p className="mt-1 text-xs text-muted-foreground">{objetivo.descricao}</p>}
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {editing ? (
            <>
              <Button size="sm" onClick={salvar}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm({ ...objetivo }); }}>Cancelar</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
          )}
          <Button size="sm" variant="ghost" onClick={excluir}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
