import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { Plus, Upload, Settings2, LayoutGrid, List } from "lucide-react";
import { PipelineKanban } from "./PipelineKanban";
import { PipelineLista } from "./PipelineLista";
import { LeadDrawer } from "./LeadDrawer";
import { LeadFormDialog } from "./LeadFormDialog";
import { EtapasCanaisConfigDialog } from "./EtapasCanaisConfigDialog";
import { ImportarLeadsDialog } from "./ImportarLeadsDialog";
import type { Lead } from "./types";

const TODOS = "__todos__";

export function Pipeline() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [search, setSearch] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState(TODOS);
  const [canalFiltro, setCanalFiltro] = useState(TODOS);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: etapas } = useQuery({
    queryKey: ["etapas-mini"],
    queryFn: async () => (await supabase.from("pipeline_etapas").select("*").eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, canal:canais_marketing(id, nome), campanha:campanhas(id, nome), responsavel:profiles(id, nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  const { data: equipe } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome").order("nome")).data ?? [],
  });

  const { data: canais } = useQuery({
    queryKey: ["canais-marketing-mini"],
    queryFn: async () => (await supabase.from("canais_marketing").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const leadsFiltrados = useMemo(() => {
    return (leads ?? []).filter((l) => {
      const termo = search.trim().toLowerCase();
      if (termo && !l.nome.toLowerCase().includes(termo) && !l.nome_paciente?.toLowerCase().includes(termo)) return false;
      if (responsavelFiltro !== TODOS && l.responsavel_id !== responsavelFiltro) return false;
      if (canalFiltro !== TODOS && l.canal_id !== canalFiltro) return false;
      return true;
    });
  }, [leads, search, responsavelFiltro, canalFiltro]);

  function onChanged() {
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />Kanban</TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5"><List className="w-3.5 h-3.5" />Lista</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}><Settings2 className="w-3.5 h-3.5 mr-1" />Configurar</Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-3.5 h-3.5 mr-1" />Importar leads</Button>
          <Button size="sm" className="gradient-brand text-white" onClick={() => setNovoOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Novo lead</Button>
        </div>
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Buscar lead...">
        <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
            {equipe?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={canalFiltro} onValueChange={setCanalFiltro}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os canais</SelectItem>
            {canais?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {view === "kanban" ? (
        <PipelineKanban etapas={etapas ?? []} leads={leadsFiltrados} onSelect={setSelected} />
      ) : (
        <PipelineLista etapas={etapas ?? []} leads={leadsFiltrados} onSelect={setSelected} />
      )}

      <LeadDrawer lead={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
      <LeadFormDialog open={novoOpen} onOpenChange={setNovoOpen} editing={null} onSaved={onChanged} />
      <EtapasCanaisConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
      <ImportarLeadsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
