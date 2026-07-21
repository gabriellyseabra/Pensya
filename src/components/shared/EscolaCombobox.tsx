import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { criarEscolaRapida } from "@/lib/cadastro.functions";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (id: string | null, nome?: string) => void;
  placeholder?: string;
};

export function EscolaCombobox({ value, onChange, placeholder = "Selecione ou cadastre uma escola" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const criar = useServerFn(criarEscolaRapida);

  const { data: escolas = [] } = useQuery({
    queryKey: ["escolas-combo"],
    queryFn: async () =>
      (await supabase.from("escolas").select("id, nome").order("nome")).data ?? [],
  });

  const selected = escolas.find((e: any) => e.id === value);

  const criarMut = useMutation({
    mutationFn: async (nome: string) => criar({ data: { nome } }),
    onSuccess: (row: any) => {
      toast.success("Escola cadastrada!");
      qc.invalidateQueries({ queryKey: ["escolas-combo"] });
      qc.invalidateQueries({ queryKey: ["escolas"] });
      onChange(row.id, row.nome);
      setOpen(false);
      setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = (escolas as any[]).filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase()),
  );
  const podeCadastrar = search.trim().length >= 2 &&
    !filtradas.some((e) => e.nome.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-10 w-full justify-between border-input px-4 font-normal">
          {selected ? selected.nome : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar escola..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhuma escola encontrada.</CommandEmpty>
            <CommandGroup>
              {filtradas.map((e: any) => (
                <CommandItem
                  key={e.id}
                  value={e.id}
                  onSelect={() => { onChange(e.id, e.nome); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === e.id ? "opacity-100" : "opacity-0"}`} />
                  {e.nome}
                </CommandItem>
              ))}
              {podeCadastrar && (
                <CommandItem
                  value={`__new__${search}`}
                  onSelect={() => criarMut.mutate(search.trim())}
                  className="text-brand"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
