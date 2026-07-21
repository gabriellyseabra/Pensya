import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Archive, ArchiveRestore, Trash2, Activity, Check } from "lucide-react";
import { toast } from "sonner";
import { arquivarPaciente, restaurarPaciente, excluirPacienteDefinitivo } from "@/lib/cadastro.functions";
import { useIsAdmin } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { PACIENTE_STATUS, PACIENTE_STATUS_LABEL } from "@/lib/paciente-status";

type Props = {
  pacienteId: string;
  pacienteNome: string;
  arquivado?: boolean;
  status?: string;
  onAfter?: () => void;
  redirectAfterDelete?: boolean;
  variant?: "icon" | "button";
};

export function PacienteAcoesMenu({ pacienteId, pacienteNome, arquivado, status, onAfter, redirectAfterDelete, variant = "icon" }: Props) {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [nomeConfirm, setNomeConfirm] = useState("");

  const arquivar = useServerFn(arquivarPaciente);
  const restaurar = useServerFn(restaurarPaciente);
  const excluir = useServerFn(excluirPacienteDefinitivo);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pacientes"] });
    qc.invalidateQueries({ queryKey: ["paciente", pacienteId] });
    onAfter?.();
  };

  const arquivarMut = useMutation({
    mutationFn: () => arquivar({ data: { pacienteId } }),
    onSuccess: () => { toast.success("Paciente arquivado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restaurarMut = useMutation({
    mutationFn: () => restaurar({ data: { pacienteId } }),
    onSuccess: () => { toast.success("Paciente restaurado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const excluirMut = useMutation({
    mutationFn: () => excluir({ data: { pacienteId, confirmacaoNome: nomeConfirm } }),
    onSuccess: () => {
      toast.success("Paciente excluído");
      setConfirmaExcluir(false);
      invalidate();
      if (redirectAfterDelete) navigate({ to: "/pacientes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: async (novoStatus: string) => {
      const { error } = await supabase.from("pacientes").update({ status: novoStatus }).eq("id", pacienteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          {variant === "icon" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">Ações</Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {!arquivado && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Activity className="mr-2 h-4 w-4" /> Mudar status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PACIENTE_STATUS.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => statusMut.mutate(s)} disabled={status === s}>
                    {status === s && <Check className="mr-2 h-4 w-4" />}
                    <span className={status === s ? "" : "ml-6"}>{PACIENTE_STATUS_LABEL[s]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {arquivado ? (
            <DropdownMenuItem onSelect={() => restaurarMut.mutate()}>
              <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => arquivarMut.mutate()}>
              <Archive className="mr-2 h-4 w-4" /> Arquivar
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirmaExcluir(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir definitivamente
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmaExcluir} onOpenChange={setConfirmaExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. Todo o histórico de <strong>{pacienteNome}</strong>
              {" "}será apagado (sessões, avaliações, financeiro, documentos).
              <br /><br />
              Para confirmar, digite o nome do paciente:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs">Nome do paciente</Label>
            <Input
              value={nomeConfirm}
              onChange={(e) => setNomeConfirm(e.target.value)}
              placeholder={pacienteNome}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNomeConfirm("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={nomeConfirm.trim().toLowerCase() !== pacienteNome.trim().toLowerCase() || excluirMut.isPending}
              onClick={(e) => { e.preventDefault(); excluirMut.mutate(); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {excluirMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
