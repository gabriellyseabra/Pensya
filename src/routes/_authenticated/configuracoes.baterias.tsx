import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronUp, ChevronDown, ListChecks, Edit2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export const Route = createFileRoute("/_authenticated/configuracoes/baterias")({
  component: BateriasPage,
});

const DEMANDAS_SUGERIDAS = [
  "TDAH", "Dislexia", "Disgrafia", "Discalculia", "Autismo (TEA)",
  "Avaliação cognitiva geral", "Queixa escolar", "Altas habilidades",
  "Atraso de linguagem", "Transtorno de aprendizagem",
];

function BateriasPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openNova, setOpenNova] = useState(false);
  const [nova, setNova] = useState({ nome: "", demanda: "", descricao: "", faixa_etaria: "" });

  const { data: baterias } = useQuery({
    queryKey: ["baterias-modelo"],
    queryFn: async () => (await supabase
      .from("baterias_modelo")
      .select("*")
      .order("demanda").order("nome")).data ?? [],
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!nova.nome || !nova.demanda) throw new Error("Nome e demanda são obrigatórios");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("baterias_modelo").insert({
        nome: nova.nome,
        demanda: nova.demanda,
        descricao: nova.descricao || null,
        faixa_etaria: nova.faixa_etaria || null,
        created_by: u.user?.id ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success("Bateria criada");
      setOpenNova(false);
      setNova({ nome: "", demanda: "", descricao: "", faixa_etaria: "" });
      qc.invalidateQueries({ queryKey: ["baterias-modelo"] });
      setSelectedId(d.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Baterias por demanda"
        description="Modelos de baterias que podem ser aplicadas rapidamente a partir da demanda do paciente."
      />

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar de baterias */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm">Baterias modelo</CardTitle>
            <Button size="sm" onClick={() => setOpenNova(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />Nova
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-auto">
            {(baterias ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma bateria cadastrada.</p>
            )}
            {(baterias ?? []).map((b: any) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 ${selectedId === b.id ? "bg-muted" : ""}`}
              >
                <div className="text-sm font-medium truncate">{b.nome}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{b.demanda}</Badge>
                  {b.faixa_etaria && <span>· {b.faixa_etaria}</span>}
                  {!b.ativo && <Badge variant="outline" className="text-[9px]">inativo</Badge>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detalhe + itens */}
        <div>
          {selectedId ? (
            <BateriaDetalhe id={selectedId} onDeleted={() => setSelectedId(null)} />
          ) : (
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
              Selecione uma bateria à esquerda ou crie uma nova.
            </CardContent></Card>
          )}
        </div>
      </div>

      <Dialog open={openNova} onOpenChange={setOpenNova}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova bateria modelo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={nova.nome} onChange={e => setNova({ ...nova, nome: e.target.value })} placeholder="Ex: Bateria TDAH escolar" /></div>
            <div>
              <Label>Demanda</Label>
              <Input
                value={nova.demanda}
                onChange={e => setNova({ ...nova, demanda: e.target.value })}
                placeholder="TDAH, Dislexia, etc."
                list="demandas-sugeridas"
              />
              <datalist id="demandas-sugeridas">
                {DEMANDAS_SUGERIDAS.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div><Label>Faixa etária (opcional)</Label><Input value={nova.faixa_etaria} onChange={e => setNova({ ...nova, faixa_etaria: e.target.value })} placeholder="Ex: 6 a 12 anos" /></div>
            <div><Label>Descrição (opcional)</Label><Textarea rows={2} value={nova.descricao} onChange={e => setNova({ ...nova, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNova(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BateriaDetalhe({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [openEdit, setOpenEdit] = useState(false);
  const [novoTesteId, setNovoTesteId] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);

  const { data: bat } = useQuery({
    queryKey: ["baterias-modelo", id],
    queryFn: async () => (await supabase.from("baterias_modelo").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: itens } = useQuery({
    queryKey: ["bateria-modelo-itens", id],
    queryFn: async () => (await supabase
      .from("baterias_modelo_itens")
      .select("*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("bateria_id", id)
      .order("ordem")).data ?? [],
  });

  const { data: catalogo } = useQuery({
    queryKey: ["testes-catalogo-todos"],
    queryFn: async () => (await supabase
      .from("testes_catalogo")
      .select("id, nome, dominio:dominios_cognitivos(nome)")
      .eq("ativo", true)
      .order("nome")).data ?? [],
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!novoTesteId) throw new Error("Selecione um teste");
      const { error } = await supabase.from("baterias_modelo_itens").insert({
        bateria_id: id,
        teste_id: novoTesteId,
        ordem: (itens?.length ?? 0),
        obrigatorio,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovoTesteId(""); qc.invalidateQueries({ queryKey: ["bateria-modelo-itens", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("baterias_modelo_itens").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bateria-modelo-itens", id] }),
  });

  const toggleObr = useMutation({
    mutationFn: async ({ itemId, valor }: { itemId: string; valor: boolean }) => {
      const { error } = await supabase.from("baterias_modelo_itens").update({ obrigatorio: valor }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bateria-modelo-itens", id] }),
  });

  async function moverItem(idx: number, dir: -1 | 1) {
    const lista = itens ?? [];
    const novo = idx + dir;
    if (novo < 0 || novo >= lista.length) return;
    const a = lista[idx], b = lista[novo];
    await Promise.all([
      supabase.from("baterias_modelo_itens").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("baterias_modelo_itens").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    qc.invalidateQueries({ queryKey: ["bateria-modelo-itens", id] });
  }

  const atualizar = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("baterias_modelo").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["baterias-modelo"] }); qc.invalidateQueries({ queryKey: ["baterias-modelo", id] }); toast.success("Atualizado"); setOpenEdit(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      if (!confirm("Excluir esta bateria modelo?")) throw new Error("cancelado");
      const { error } = await supabase.from("baterias_modelo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["baterias-modelo"] }); onDeleted(); },
    onError: (e: any) => { if (e.message !== "cancelado") toast.error(e.message); },
  });

  if (!bat) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{bat.nome}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Badge variant="outline">{bat.demanda}</Badge>
                {bat.faixa_etaria && <span>{bat.faixa_etaria}</span>}
              </div>
              {bat.descricao && <p className="text-sm text-muted-foreground mt-2">{bat.descricao}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setOpenEdit(true)}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => excluir.mutate()}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testes da bateria ({itens?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Adicionar teste</Label>
              <Select value={novoTesteId} onValueChange={setNovoTesteId}>
                <SelectTrigger><SelectValue placeholder="Selecionar teste do catálogo" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {(catalogo ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}{t.dominio?.nome ? ` — ${t.dominio.nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs pb-2 cursor-pointer">
              <Checkbox checked={obrigatorio} onCheckedChange={(v) => setObrigatorio(!!v)} />
              Obrigatório
            </label>
            <Button onClick={() => addItem.mutate()} disabled={!novoTesteId}>
              <Plus className="w-4 h-4 mr-1" />Adicionar
            </Button>
          </div>

          {(itens ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum teste adicionado ainda.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {(itens ?? []).map((i: any, idx: number) => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.teste?.nome}</div>
                    <div className="text-xs text-muted-foreground">{i.teste?.dominio?.nome ?? "—"}</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={i.obrigatorio}
                      onCheckedChange={(v) => toggleObr.mutate({ itemId: i.id, valor: !!v })}
                    />
                    obrigatório
                  </label>
                  <div className="flex">
                    <Button size="icon" variant="ghost" onClick={() => moverItem(idx, -1)} disabled={idx === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => moverItem(idx, 1)} disabled={idx === (itens?.length ?? 0) - 1}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => delItem.mutate(i.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar bateria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input defaultValue={bat.nome ?? ""} onBlur={(e) => e.target.value !== bat.nome && atualizar.mutate({ nome: e.target.value })} /></div>
            <div><Label>Demanda</Label><Input defaultValue={bat.demanda ?? ""} list="demandas-sugeridas-edit" onBlur={(e) => e.target.value !== bat.demanda && atualizar.mutate({ demanda: e.target.value })} /></div>
            <datalist id="demandas-sugeridas-edit">
              {DEMANDAS_SUGERIDAS.map(d => <option key={d} value={d} />)}
            </datalist>
            <div><Label>Faixa etária</Label><Input defaultValue={bat.faixa_etaria ?? ""} onBlur={(e) => atualizar.mutate({ faixa_etaria: e.target.value || null })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} defaultValue={bat.descricao ?? ""} onBlur={(e) => atualizar.mutate({ descricao: e.target.value || null })} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={bat.ativo} onCheckedChange={(v) => atualizar.mutate({ ativo: !!v })} />
              <span className="text-sm">Bateria ativa</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenEdit(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
