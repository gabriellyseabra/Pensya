import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Library, Search } from "lucide-react";

/**
 * Seletor do Banco de Recursos: busca recursos ativos e adiciona o nome
 * escolhido ao campo de recursos (texto). Prioriza os que combinam com as
 * tags sugeridas (componentes/habilidades da meta trabalhada).
 */
export function RecursoPicker({ onAdd, sugestaoTags = [] }: { onAdd: (nome: string) => void; sugestaoTags?: string[] }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: recursos = [] } = useQuery({
    queryKey: ["recursos-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("recursos").select("id, nome, tipo, tags, dominio").eq("ativo", true).order("nome");
      return (data ?? []) as any[];
    },
  });

  const sugSet = useMemo(() => new Set(sugestaoTags.map((t) => t.toLowerCase())), [sugestaoTags]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = recursos.filter((r) =>
      !q || r.nome.toLowerCase().includes(q) || (r.dominio ?? "").toLowerCase().includes(q) || (r.tags ?? []).some((t: string) => t.toLowerCase().includes(q)),
    );
    // relevantes (que casam com componentes da meta) primeiro
    const rel = (r: any) => (r.tags ?? []).some((t: string) => sugSet.has(t.toLowerCase())) ? 0 : 1;
    return filtrados.sort((a, b) => rel(a) - rel(b) || a.nome.localeCompare(b.nome));
  }, [recursos, busca, sugSet]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0"><Library className="mr-1.5 h-3.5 w-3.5" />Do banco</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 pl-7 text-xs" placeholder="Buscar recurso…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        </div>
        <div className="max-h-64 space-y-1 overflow-auto">
          {lista.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Nenhum recurso. Cadastre em Configurações → Banco de Recursos.</p>
          ) : lista.map((r) => {
            const casa = (r.tags ?? []).some((t: string) => sugSet.has(t.toLowerCase()));
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { onAdd(r.nome); setOpen(false); setBusca(""); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.nome}</span>
                  {(r.tags ?? []).length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">· {r.tags.slice(0, 3).join(", ")}</span>}
                </span>
                {casa && <Badge className="shrink-0 bg-brand/15 text-brand text-[9px]">relevante</Badge>}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
