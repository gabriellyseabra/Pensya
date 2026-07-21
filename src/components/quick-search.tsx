import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type Paciente = { id: string; nome: string; data_nascimento: string | null };

export function QuickSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paciente[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, data_nascimento")
        .ilike("nome", `%${query}%`)
        .order("nome")
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente..."
            className="glass pl-9 border-border/60"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              navigate({ to: "/pacientes/$id", params: { id: p.id } });
              setQuery("");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <span className="font-medium">{p.nome}</span>
            {p.data_nascimento && (
              <span className="text-xs text-muted-foreground">
                {new Date(p.data_nascimento).toLocaleDateString("pt-BR")}
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
