import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { listarFaltasPendentes } from "@/lib/frequencia";

/**
 * Escolhe qual falta justificada pendente está sendo reposta. Se não houver
 * faltas pendentes, apenas registra a reposição (onConfirm(null)).
 */
export function ReporFaltaDialog({
  pacienteId,
  open,
  onOpenChange,
  onConfirm,
}: {
  pacienteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (faltaId: string | null) => void;
}) {
  const { data: pendentes } = useQuery({
    queryKey: ["faltas-pendentes", pacienteId],
    enabled: open,
    queryFn: () => listarFaltasPendentes(pacienteId),
  });
  const [sel, setSel] = useState<string>("");

  useEffect(() => {
    if (pendentes && pendentes.length > 0) setSel(pendentes[0].id); // mais antiga por padrão
  }, [pendentes]);

  const lista = pendentes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Qual falta está sendo reposta?</DialogTitle></DialogHeader>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há falta justificada pendente para este paciente. A reposição será apenas registrada.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lista.map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
              >
                <input type="radio" name="falta" checked={sel === f.id} onChange={() => setSel(f.id)} />
                <span className="font-medium">{format(parseISO(f.data_referencia), "dd/MM/yyyy")}</span>
                {f.motivo && <span className="truncate text-muted-foreground">— {f.motivo}</span>}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="gradient-brand text-white"
            onClick={() => {
              onConfirm(lista.length > 0 ? sel || lista[0].id : null);
              onOpenChange(false);
            }}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />Registrar reposição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
