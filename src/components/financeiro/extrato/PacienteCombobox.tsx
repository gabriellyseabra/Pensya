import { useState } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type PacienteOpcao = { id: string; nome: string };

export function PacienteCombobox({
  pacientes,
  value,
  onChange,
  placeholder = "Buscar paciente...",
}: {
  pacientes: PacienteOpcao[];
  value: string | null;
  onChange: (id: string | null, nome: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = pacientes.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{selecionado ? selecionado.nome : placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Digite o nome do paciente..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
            <CommandGroup>
              {pacientes.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nome}
                  onSelect={() => {
                    onChange(p.id === value ? null : p.id, p.id === value ? null : p.nome);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
