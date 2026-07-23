import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Stethoscope, Search } from "lucide-react";
import { toast } from "sonner";
import { buscarCid11 } from "@/lib/cid11-catalogo";

type DiagLink = {
  diagnostico_id: string;
  data_diagnostico: string | null;
  diagnostico: { id: string; codigo: string | null; nome: string } | null;
};

/**
 * Diagnósticos do paciente com catálogo CID-11 (códigos públicos da OMS).
 * Reaproveita as tabelas existentes: cada diagnóstico vira uma linha em
 * `diagnosticos` (catálogo da clínica) e o vínculo fica em `paciente_diagnosticos`.
 */
export function DiagnosticosManager({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = ["paciente-diagnosticos", pacienteId];

  const { data: atuais } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paciente_diagnosticos")
        .select("diagnostico_id, data_diagnostico, diagnostico:diagnosticos(id, codigo, nome)")
        .eq("paciente_id", pacienteId);
      if (error) throw error;
      return (data ?? []) as unknown as DiagLink[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["paciente", pacienteId] });
    qc.invalidateQueries({ queryKey: ["paciente"] });
  };

  const adicionar = useMutation({
    mutationFn: async ({ codigo, nome }: { codigo: string | null; nome: string }) => {
      // 1. Garante o diagnóstico no catálogo da clínica (por código, senão por nome).
      let diagId: string | null = null;
      if (codigo) {
        const { data } = await supabase.from("diagnosticos").select("id").eq("codigo", codigo).limit(1).maybeSingle();
        diagId = data?.id ?? null;
      }
      if (!diagId) {
        const { data } = await supabase.from("diagnosticos").select("id").eq("nome", nome).limit(1).maybeSingle();
        diagId = data?.id ?? null;
      }
      if (!diagId) {
        const { data, error } = await supabase
          .from("diagnosticos")
          .insert({ codigo: codigo || null, nome, ativo: true })
          .select("id")
          .single();
        if (error) throw error;
        diagId = data.id;
      }
      // 2. Vincula ao paciente (ignora se já existir).
      const { error: linkErr } = await supabase
        .from("paciente_diagnosticos")
        .upsert(
          { paciente_id: pacienteId, diagnostico_id: diagId, data_diagnostico: new Date().toISOString().slice(0, 10) },
          { onConflict: "paciente_id,diagnostico_id", ignoreDuplicates: true },
        );
      if (linkErr) throw linkErr;
    },
    onSuccess: () => { invalidar(); toast.success("Diagnóstico adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (diagnosticoId: string) => {
      const { error } = await supabase
        .from("paciente_diagnosticos")
        .delete()
        .eq("paciente_id", pacienteId)
        .eq("diagnostico_id", diagnosticoId);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Stethoscope className="h-4 w-4 text-brand" /> Diagnósticos (CID-11)
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(atuais ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum diagnóstico registrado.</p>
        )}
        {(atuais ?? []).map((d) => (
          <Badge key={d.diagnostico_id} variant="secondary" className="gap-1.5 py-1">
            {d.diagnostico?.codigo && <span className="font-mono text-[10px] opacity-70">{d.diagnostico.codigo}</span>}
            <span className="max-w-[16rem] truncate">{d.diagnostico?.nome}</span>
            <button onClick={() => remover.mutate(d.diagnostico_id)} className="opacity-60 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Códigos CID-11 (OMS). Para diagnóstico já fechado — a hipótese em investigação continua no campo acima.
      </p>

      <AddDialog
        open={open}
        onOpenChange={setOpen}
        onAdd={(codigo, nome) => adicionar.mutate({ codigo, nome })}
        adding={adicionar.isPending}
      />
    </div>
  );
}

function AddDialog({
  open, onOpenChange, onAdd, adding,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (codigo: string | null, nome: string) => void;
  adding: boolean;
}) {
  const [busca, setBusca] = useState("");
  const resultados = buscarCid11(busca).slice(0, 40);
  const buscaLimpa = busca.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Adicionar diagnóstico</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-8"
            placeholder="Buscar por código ou nome (ex.: TDAH, 6A05, dislexia)…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {resultados.map((c) => (
            <button
              key={c.codigo}
              disabled={adding}
              onClick={() => { onAdd(c.codigo, c.nome); onOpenChange(false); }}
              className="flex w-full items-start gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-left hover:border-brand/50"
            >
              <span className="mt-0.5 rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] text-brand">{c.codigo ?? "—"}</span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug">{c.nome}</span>
                <span className="text-[11px] text-muted-foreground">{c.grupo}</span>
              </span>
            </button>
          ))}
          {resultados.length === 0 && buscaLimpa && (
            <button
              disabled={adding}
              onClick={() => { onAdd(null, buscaLimpa); onOpenChange(false); }}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm hover:border-brand/50"
            >
              <Plus className="h-4 w-4" /> Adicionar “{buscaLimpa}” (sem código)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
