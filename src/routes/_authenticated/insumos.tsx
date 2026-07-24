import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package, Plus, Minus, Trash2, Pencil, Loader2, FlaskConical, AlertTriangle, CalendarClock,
} from "lucide-react";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/insumos")({
  component: InsumosPage,
});

// Tabelas novas (insumos, licencas_teste) ainda não estão no types.ts gerado.
const db = supabase as any;

type Insumo = {
  id: string;
  nome: string;
  categoria: string | null;
  quantidade: number;
  unidade: string | null;
  estoque_minimo: number;
  observacoes: string | null;
};

type Licenca = {
  id: string;
  nome_teste: string;
  fornecedor: string | null;
  aplicacoes_restantes: number;
  alerta_minimo: number;
  validade: string | null;
  observacoes: string | null;
};

/** Insumo precisa de reposição quando há um mínimo definido e o estoque chegou nele. */
function precisaRepor(i: Insumo): boolean {
  return Number(i.estoque_minimo) > 0 && Number(i.quantidade) <= Number(i.estoque_minimo);
}

/** Licença em alerta: poucas aplicações restantes ou validade vencida/próxima. */
function licencaEmAlerta(l: Licenca): boolean {
  const poucas = Number(l.alerta_minimo) > 0 && Number(l.aplicacoes_restantes) <= Number(l.alerta_minimo);
  const semAplicacoes = Number(l.aplicacoes_restantes) <= 0;
  let venceu = false;
  if (l.validade) {
    const dias = differenceInCalendarDays(parseISO(l.validade), new Date());
    venceu = dias <= 30;
  }
  return poucas || semAplicacoes || venceu;
}

function InsumosPage() {
  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos"],
    queryFn: async () => {
      const { data, error } = await db
        .from("insumos")
        .select("id, nome, categoria, quantidade, unidade, estoque_minimo, observacoes")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Insumo[];
    },
  });

  const { data: licencas = [] } = useQuery({
    queryKey: ["licencas-teste"],
    queryFn: async () => {
      const { data, error } = await db
        .from("licencas_teste")
        .select("id, nome_teste, fornecedor, aplicacoes_restantes, alerta_minimo, validade, observacoes")
        .order("nome_teste");
      if (error) throw error;
      return (data ?? []) as Licenca[];
    },
  });

  const insumosARepor = useMemo(() => insumos.filter(precisaRepor).length, [insumos]);
  const licencasAlerta = useMemo(() => licencas.filter(licencaEmAlerta).length, [licencas]);

  return (
    <div className="space-y-6">
      <PageHero
        icon={Package}
        eyebrow="Gestão"
        title="Insumos e testes"
        description="Controle simples de materiais do consultório e das licenças/créditos de testes — com alerta de reposição e de validade."
        variant="brand"
        stats={[
          { label: "Insumos p/ repor", value: insumosARepor, icon: AlertTriangle },
          { label: "Licenças em alerta", value: licencasAlerta, icon: CalendarClock },
        ]}
      />

      <Tabs defaultValue="insumos">
        <TabsList>
          <TabsTrigger value="insumos"><Package className="mr-1.5 h-4 w-4" />Insumos do consultório</TabsTrigger>
          <TabsTrigger value="licencas"><FlaskConical className="mr-1.5 h-4 w-4" />Licenças de testes</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos" className="mt-4">
          <InsumosTab insumos={insumos} />
        </TabsContent>
        <TabsContent value="licencas" className="mt-4">
          <LicencasTab licencas={licencas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Insumos ============================== */

function InsumosTab({ insumos }: { insumos: Insumo[] }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; edit: Insumo | null }>({ open: false, edit: null });

  const ajustar = useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) => {
      const { error } = await db
        .from("insumos")
        .update({ quantidade: Math.max(0, quantidade), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insumos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("insumos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["insumos"] }); toast.success("Insumo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, edit: null })} className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Novo insumo
        </Button>
      </div>

      {insumos.length === 0 && (
        <Card className="glass"><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum insumo cadastrado. Adicione os materiais que você quer acompanhar (papel, jogos, materiais de teste, etc.).
        </CardContent></Card>
      )}

      {insumos.map((i) => {
        const repor = precisaRepor(i);
        return (
          <Card key={i.id} className={`glass card-lift ${repor ? "border-amber-500/50" : ""}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{i.nome}</p>
                  {i.categoria && <Badge variant="outline" className="text-[10px]">{i.categoria}</Badge>}
                  {repor && (
                    <Badge className="bg-amber-500 text-white text-[10px]">
                      <AlertTriangle className="mr-1 h-3 w-3" />Repor
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Estoque mínimo: {Number(i.estoque_minimo)}{i.unidade ? ` ${i.unidade}` : ""}</span>
                  {i.observacoes && <span className="truncate">· {i.observacoes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-background/40 px-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="-1"
                    onClick={() => ajustar.mutate({ id: i.id, quantidade: Number(i.quantidade) - 1 })}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
                    {Number(i.quantidade)}<span className="text-xs text-muted-foreground">{i.unidade ? ` ${i.unidade}` : ""}</span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="+1"
                    onClick={() => ajustar.mutate({ id: i.id, quantidade: Number(i.quantidade) + 1 })}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost" title="Editar" onClick={() => setDialog({ open: true, edit: i })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Excluir"
                  onClick={() => { if (confirm("Excluir este insumo?")) remover.mutate(i.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <InsumoDialog
        state={dialog}
        onClose={() => setDialog({ open: false, edit: null })}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["insumos"] }); setDialog({ open: false, edit: null }); }}
      />
    </div>
  );
}

function InsumoDialog({
  state, onClose, onSaved,
}: {
  state: { open: boolean; edit: Insumo | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = state.edit;
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [quantidade, setQuantidade] = useState("0");
  const [unidade, setUnidade] = useState("un");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reinicia os campos quando abre (novo ou edição).
  const key = state.open ? edit?.id ?? "novo" : "fechado";
  useEffect(() => {
    setNome(edit?.nome ?? "");
    setCategoria(edit?.categoria ?? "");
    setQuantidade(String(edit?.quantidade ?? 0));
    setUnidade(edit?.unidade ?? "un");
    setEstoqueMinimo(String(edit?.estoque_minimo ?? 0));
    setObservacoes(edit?.observacoes ?? "");
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome do insumo"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        categoria: categoria.trim() || null,
        quantidade: Number(quantidade) || 0,
        unidade: unidade.trim() || "un",
        estoque_minimo: Number(estoqueMinimo) || 0,
        observacoes: observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = edit
        ? await db.from("insumos").update(payload).eq("id", edit.id)
        : await db.from("insumos").insert(payload);
      if (error) throw error;
      toast.success(edit ? "Insumo atualizado" : "Insumo adicionado");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Editar insumo" : "Novo insumo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Papel sulfite A4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria (opcional)</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Papelaria" />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, folhas, caixa…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade atual</Label>
              <Input type="number" step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label>Estoque mínimo (alerta)</Label>
              <Input type="number" step="1" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{edit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Licenças ============================ */

function statusValidade(validade: string | null): { texto: string; alerta: boolean } | null {
  if (!validade) return null;
  const dias = differenceInCalendarDays(parseISO(validade), new Date());
  if (dias < 0) return { texto: "Vencida", alerta: true };
  if (dias === 0) return { texto: "Vence hoje", alerta: true };
  if (dias <= 30) return { texto: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, alerta: true };
  return { texto: `Válida até ${format(parseISO(validade), "dd/MM/yyyy")}`, alerta: false };
}

function LicencasTab({ licencas }: { licencas: Licenca[] }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; edit: Licenca | null }>({ open: false, edit: null });

  const registrarUso = useMutation({
    mutationFn: async ({ id, restantes }: { id: string; restantes: number }) => {
      const { error } = await db
        .from("licencas_teste")
        .update({ aplicacoes_restantes: Math.max(0, restantes), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licencas-teste"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("licencas_teste").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["licencas-teste"] }); toast.success("Licença removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, edit: null })} className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Nova licença
        </Button>
      </div>

      {licencas.length === 0 && (
        <Card className="glass"><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma licença cadastrada. Controle os créditos/folhas restantes e a validade dos seus testes (ex.: VOL, Vetor).
        </CardContent></Card>
      )}

      {licencas.map((l) => {
        const val = statusValidade(l.validade);
        const poucas = Number(l.alerta_minimo) > 0 && Number(l.aplicacoes_restantes) <= Number(l.alerta_minimo);
        const zerada = Number(l.aplicacoes_restantes) <= 0;
        return (
          <Card key={l.id} className={`glass card-lift ${licencaEmAlerta(l) ? "border-amber-500/50" : ""}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{l.nome_teste}</p>
                  {l.fornecedor && <Badge variant="outline" className="text-[10px]">{l.fornecedor}</Badge>}
                  {(poucas || zerada) && (
                    <Badge className="bg-amber-500 text-white text-[10px]">
                      <AlertTriangle className="mr-1 h-3 w-3" />{zerada ? "Sem aplicações" : "Poucas aplicações"}
                    </Badge>
                  )}
                  {val && (
                    <Badge className={`text-[10px] ${val.alerta ? "bg-destructive text-destructive-foreground" : ""}`}
                      variant={val.alerta ? "default" : "outline"}>
                      <CalendarClock className="mr-1 h-3 w-3" />{val.texto}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Alerta em: {Number(l.alerta_minimo)} aplicações</span>
                  {l.observacoes && <span className="truncate">· {l.observacoes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-background/40 px-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Registrar aplicação (-1)"
                    disabled={Number(l.aplicacoes_restantes) <= 0}
                    onClick={() => registrarUso.mutate({ id: l.id, restantes: Number(l.aplicacoes_restantes) - 1 })}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[4.5rem] text-center text-sm font-medium tabular-nums">
                    {Number(l.aplicacoes_restantes)}<span className="text-xs text-muted-foreground"> apl.</span>
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Repor crédito (+1)"
                    onClick={() => registrarUso.mutate({ id: l.id, restantes: Number(l.aplicacoes_restantes) + 1 })}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost" title="Editar" onClick={() => setDialog({ open: true, edit: l })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Excluir"
                  onClick={() => { if (confirm("Excluir esta licença?")) remover.mutate(l.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <LicencaDialog
        state={dialog}
        onClose={() => setDialog({ open: false, edit: null })}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["licencas-teste"] }); setDialog({ open: false, edit: null }); }}
      />
    </div>
  );
}

function LicencaDialog({
  state, onClose, onSaved,
}: {
  state: { open: boolean; edit: Licenca | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = state.edit;
  const [nomeTeste, setNomeTeste] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [restantes, setRestantes] = useState("0");
  const [alertaMinimo, setAlertaMinimo] = useState("0");
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const key = state.open ? edit?.id ?? "novo" : "fechado";
  useEffect(() => {
    setNomeTeste(edit?.nome_teste ?? "");
    setFornecedor(edit?.fornecedor ?? "");
    setRestantes(String(edit?.aplicacoes_restantes ?? 0));
    setAlertaMinimo(String(edit?.alerta_minimo ?? 0));
    setValidade(edit?.validade ?? "");
    setObservacoes(edit?.observacoes ?? "");
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!nomeTeste.trim()) { toast.error("Informe o nome do teste"); return; }
    setSaving(true);
    try {
      const payload = {
        nome_teste: nomeTeste.trim(),
        fornecedor: fornecedor.trim() || null,
        aplicacoes_restantes: Number(restantes) || 0,
        alerta_minimo: Number(alertaMinimo) || 0,
        validade: validade || null,
        observacoes: observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = edit
        ? await db.from("licencas_teste").update(payload).eq("id", edit.id)
        : await db.from("licencas_teste").insert(payload);
      if (error) throw error;
      toast.success(edit ? "Licença atualizada" : "Licença adicionada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Editar licença" : "Nova licença de teste"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teste</Label>
              <Input value={nomeTeste} onChange={(e) => setNomeTeste(e.target.value)} placeholder="Ex.: VOL, Vetor…" />
            </div>
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Editora / distribuidor" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Aplicações/folhas restantes</Label>
              <Input type="number" step="1" value={restantes} onChange={(e) => setRestantes(e.target.value)} />
            </div>
            <div>
              <Label>Alerta quando restar</Label>
              <Input type="number" step="1" value={alertaMinimo} onChange={(e) => setAlertaMinimo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Validade da licença (opcional)</Label>
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{edit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
