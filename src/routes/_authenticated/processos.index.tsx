import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { PageHero } from "@/components/shared/PageHero";
import { LayoutGrid, List, Plus, Settings2, Workflow, Minimize2, Maximize2 } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { ProcessosKanban } from "@/components/processos/ProcessosKanban";
import { ProcessosTabela } from "@/components/processos/ProcessosTabela";
import { NovoProcessoDialog } from "@/components/processos/NovoProcessoDialog";
import { DepartamentosConfigDialog } from "@/components/processos/DepartamentosConfigDialog";
import type { Departamento, Processo } from "@/components/processos/types";
import { CATEGORIAS } from "@/components/processos/types";

export const Route = createFileRoute("/_authenticated/processos/")({
  component: ProcessosPage,
});

const TODOS = "__todos__";

function ProcessosPage() {
  const navigate = useNavigate();
  const { isAdmin } = useRoles();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState("");
  const [catFiltro, setCatFiltro] = useState(TODOS);
  const [novoOpen, setNovoOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [compacto, setCompacto] = useState(() => typeof window !== "undefined" && localStorage.getItem("processos:compacto") === "1");
  const toggleCompacto = () => setCompacto((v) => {
    const novo = !v;
    if (typeof window !== "undefined") localStorage.setItem("processos:compacto", novo ? "1" : "0");
    return novo;
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const { data } = await supabase.from("departamentos").select("*").eq("ativo", true).order("ordem");
      return (data ?? []) as Departamento[];
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ["processos"],
    queryFn: async () => {
      const { data } = await supabase.from("processos").select("*").order("ordem").order("created_at");
      return (data ?? []) as unknown as Processo[];
    },
  });

  const { data: equipe = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string | null }[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return processos.filter((p) => {
      if (termo && !p.titulo.toLowerCase().includes(termo)) return false;
      if (catFiltro !== TODOS && p.categoria !== catFiltro) return false;
      return true;
    });
  }, [processos, search, catFiltro]);

  const abrir = (p: Processo) => navigate({ to: "/processos/$id", params: { id: p.id } });

  return (
    <div className="space-y-4">
      <PageHero
        icon={Workflow}
        title="Gestão de Processos"
        description="Departamentos, processos (POPs) e o passo a passo de cada operação."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />Quadro</TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5"><List className="w-3.5 h-3.5" />Tabela</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {view === "kanban" && (
            <Button size="sm" variant="outline" onClick={toggleCompacto}>
              {compacto ? <Maximize2 className="w-3.5 h-3.5 mr-1" /> : <Minimize2 className="w-3.5 h-3.5 mr-1" />}
              {compacto ? "Expandir" : "Minimizar"}
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings2 className="w-3.5 h-3.5 mr-1" />Departamentos
            </Button>
          )}
          <Button size="sm" className="gradient-brand text-white" onClick={() => setNovoOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Novo processo
          </Button>
        </div>
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Buscar processo...">
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {view === "kanban" ? (
        <ProcessosKanban departamentos={departamentos} processos={filtrados} equipe={equipe} onSelect={abrir} compacto={compacto} />
      ) : (
        <ProcessosTabela departamentos={departamentos} processos={filtrados} equipe={equipe} onSelect={abrir} />
      )}

      <NovoProcessoDialog open={novoOpen} onOpenChange={setNovoOpen} departamentos={departamentos} />
      <DepartamentosConfigDialog open={configOpen} onOpenChange={setConfigOpen} departamentos={departamentos} />
    </div>
  );
}
