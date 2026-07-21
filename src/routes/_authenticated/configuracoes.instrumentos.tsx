import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TestTube, Plus, Trash2, Search, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FORMULAS_AGREGACAO } from "@/lib/baterias.functions";

export const Route = createFileRoute("/_authenticated/configuracoes/instrumentos")({
  component: InstrumentosPage,
});

// Gera uma chave estável a partir do rótulo da variável
function slugKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `var_${Date.now()}`;
}

function InstrumentosPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [openNovo, setOpenNovo] = useState(false);
  const [novo, setNovo] = useState({ nome: "", dominio_id: "" });

  const { data: instrumentos } = useQuery({
    queryKey: ["instrumentos-todos"],
    queryFn: async () => (await supabase
      .from("testes_catalogo")
      .select("id, nome, ativo, dominio:dominios_cognitivos(nome)")
      .order("nome")).data ?? [],
  });

  const { data: dominios } = useQuery({
    queryKey: ["dominios-cognitivos"],
    queryFn: async () => (await supabase
      .from("dominios_cognitivos")
      .select("id, nome")
      .order("nome")).data ?? [],
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!novo.nome.trim()) throw new Error("Informe o nome do instrumento");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("testes_catalogo").insert({
        nome: novo.nome.trim(),
        dominio_id: novo.dominio_id || null,
        ativo: true,
        created_by: u.user?.id ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success("Instrumento cadastrado");
      setOpenNovo(false);
      setNovo({ nome: "", dominio_id: "" });
      qc.invalidateQueries({ queryKey: ["instrumentos-todos"] });
      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
      setSelectedId(d.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return instrumentos ?? [];
    return (instrumentos ?? []).filter((i: any) =>
      i.nome.toLowerCase().includes(q) || (i.dominio?.nome ?? "").toLowerCase().includes(q));
  }, [instrumentos, busca]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TestTube}
        title="Instrumentos"
        description="Catálogo de testes e instrumentos usados nas avaliações. Cadastre, edite variáveis e configure a agregação de escores."
      />

      <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="space-y-2 pb-3">
            <div className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Instrumentos ({(instrumentos ?? []).length})</CardTitle>
              <Button size="sm" onClick={() => setOpenNovo(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />Novo
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="pl-7 h-8" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-auto">
            {filtrados.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum instrumento encontrado.</p>
            )}
            {filtrados.map((i: any) => (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 ${selectedId === i.id ? "bg-muted" : ""}`}
              >
                <div className="text-sm font-medium truncate">{i.nome}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {i.dominio?.nome && <Badge variant="outline" className="text-[9px]">{i.dominio.nome}</Badge>}
                  {!i.ativo && <Badge variant="outline" className="text-[9px]">inativo</Badge>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div>
          {selectedId ? (
            <InstrumentoDetalhe id={selectedId} dominios={dominios ?? []} onDeleted={() => setSelectedId(null)} />
          ) : (
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
              Selecione um instrumento à esquerda ou cadastre um novo.
            </CardContent></Card>
          )}
        </div>
      </div>

      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo instrumento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex: TDE II — Subteste de Leitura" /></div>
            <div>
              <Label>Domínio cognitivo (opcional)</Label>
              <Select value={novo.dominio_id} onValueChange={(v) => setNovo({ ...novo, dominio_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar domínio" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(dominios ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InstrumentoDetalhe({ id, dominios, onDeleted }: { id: string; dominios: any[]; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [novaVar, setNovaVar] = useState("");

  const { data: inst } = useQuery({
    queryKey: ["instrumento", id],
    queryFn: async () => (await supabase.from("testes_catalogo").select("*").eq("id", id).maybeSingle()).data,
  });

  const salvar = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("testes_catalogo").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instrumento", id] });
      qc.invalidateQueries({ queryKey: ["instrumentos-todos"] });
      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("testes_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Instrumento excluído");
      qc.invalidateQueries({ queryKey: ["instrumentos-todos"] });
      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
      onDeleted();
    },
    onError: (e: any) => toast.error("Não foi possível excluir. Pode haver resultados vinculados a este teste.", { description: e.message }),
  });

  if (!inst) return <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>;

  const variaveis: any[] = Array.isArray(inst.variaveis) ? inst.variaveis : [];

  function addVariavel() {
    const label = novaVar.trim();
    if (!label) return;
    const key = slugKey(label);
    if (variaveis.some((v) => v.key === key)) { toast.error("Já existe uma variável com esse nome"); return; }
    salvar.mutate({ variaveis: [...variaveis, { key, label, tipo: "numero", unidade: null }] });
    setNovaVar("");
  }

  function removeVariavel(key: string) {
    salvar.mutate({ variaveis: variaveis.filter((v) => v.key !== key) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">{inst.nome}</CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Ativo
                <Switch checked={!!inst.ativo} onCheckedChange={(v) => salvar.mutate({ ativo: v })} />
              </label>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir este instrumento?")) excluir.mutate(); }}>
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Nome</Label>
            <Input defaultValue={inst.nome ?? ""} onBlur={(e) => e.target.value.trim() && e.target.value !== inst.nome && salvar.mutate({ nome: e.target.value.trim() })} />
          </div>
          <div>
            <Label>Domínio cognitivo</Label>
            <Select value={inst.dominio_id ?? ""} onValueChange={(v) => salvar.mutate({ dominio_id: v || null })}>
              <SelectTrigger><SelectValue placeholder="Selecionar domínio" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {dominios.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Objetivo</Label>
            <Textarea rows={2} defaultValue={inst.objetivo ?? ""} onBlur={(e) => e.target.value !== (inst.objetivo ?? "") && salvar.mutate({ objetivo: e.target.value || null })} placeholder="O que este instrumento avalia?" />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} defaultValue={inst.observacoes ?? ""} onBlur={(e) => e.target.value !== (inst.observacoes ?? "") && salvar.mutate({ observacoes: e.target.value || null })} placeholder="Instruções de aplicação, materiais, faixa etária…" />
          </div>
          <div className="md:col-span-2">
            <Label>Impacto na CIF (descrição)</Label>
            <Textarea rows={2} defaultValue={inst.cif_descricao ?? ""} onBlur={(e) => e.target.value !== (inst.cif_descricao ?? "") && salvar.mutate({ cif_descricao: e.target.value || null })} placeholder="Como os resultados dialogam com funções/atividades da CIF." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Variáveis do instrumento</CardTitle>
          <p className="text-xs text-muted-foreground">
            Subcomponentes que recebem escore próprio (ex.: "Precisão", "Velocidade"). Deixe vazio se o teste tem apenas um escore global.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={novaVar}
              onChange={(e) => setNovaVar(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariavel(); } }}
              placeholder="Nome da variável (ex.: Atenção seletiva)"
            />
            <Button onClick={addVariavel} disabled={!novaVar.trim()}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
          </div>
          {variaveis.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {variaveis.map((v: any) => (
                <Badge key={v.key} variant="secondary" className="gap-1 pr-1">
                  {v.label}
                  <button type="button" onClick={() => removeVariavel(v.key)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma variável cadastrada — o teste usará apenas o escore global.</p>
          )}

          {variaveis.length > 0 && (
            <div className="pt-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fórmula de agregação das variáveis</Label>
              <Select value={(inst.formula_agregacao as string) ?? "nenhuma"} onValueChange={(v) => salvar.mutate({ formula_agregacao: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMULAS_AGREGACAO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Define como as variáveis se combinam num escore global do teste nas próximas aplicações.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
