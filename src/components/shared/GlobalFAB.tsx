import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, UserPlus, ListTodo, DollarSign, Users2, FlaskConical, FileText, Megaphone } from "lucide-react";
import { QuickLancamentoDialog } from "@/components/financeiro/QuickLancamentoDialog";

/**
 * Botão flutuante global — visível em todas as páginas autenticadas.
 * Encaminha o usuário para a página/ação correspondente. Onde já existem
 * drawers/dialogs específicos por contexto (ex.: nova sessão dentro do
 * paciente), o FAB apenas leva o usuário até o local correto.
 */
export function GlobalFAB() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lancamentoOpen, setLancamentoOpen] = useState(false);

  function go(to: string) {
    setOpen(false);
    navigate({ to } as any);
  }

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          aria-label="Ações rápidas"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg gradient-brand text-brand-foreground z-40 hover:scale-105 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-60 glass-strong">
        <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
          Criar
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => go("/cadastros")}>
          <UserPlus className="mr-2 h-4 w-4 text-brand" />Novo paciente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/tarefas")}>
          <ListTodo className="mr-2 h-4 w-4 text-brand" />Nova tarefa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/marketing")}>
          <Megaphone className="mr-2 h-4 w-4 text-brand" />Novo lead
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setOpen(false); setLancamentoOpen(true); }}>
          <DollarSign className="mr-2 h-4 w-4 text-brand" />Novo lançamento
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
          Atalhos clínicos
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => go("/pacientes")}>
          <FlaskConical className="mr-2 h-4 w-4" />Nova avaliação
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/pacientes")}>
          <FileText className="mr-2 h-4 w-4" />Novo registro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/pacientes")}>
          <Users2 className="mr-2 h-4 w-4" />Nova reunião
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <QuickLancamentoDialog open={lancamentoOpen} onOpenChange={setLancamentoOpen} />
    </>
  );
}
