import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, Pencil, ArrowLeft, GripVertical, ArrowUp, ArrowDown, LayoutTemplate, Star,
} from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/PageHero";
import { useIsAdmin } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/cadastros_/modelos")({
  component: ModelosPage,
});

// ============================================================
// Tipos
// ============================================================
export type TipoPergunta =
  | "texto" | "textarea" | "numero" | "data" | "select" | "multi" | "sim_nao";

export type Pergunta = {
  id: string;
  label: string;
  tipo: TipoPergunta;
  opcoes?: string[];
  obrigatoria?: boolean;
  ajuda?: string;
};

type Modelo = {
  id: string;
  nome: string;
  faixa: string | null;
  idade_min: number | null;
  idade_max: number | null;
  perguntas: Pergunta[];
  ativo: boolean;
  padrao: boolean;
  ordem: number;
};

const TIPO_LABEL: Record<TipoPergunta, string> = {
  texto: "Texto curto",
  textarea: "Texto longo",
  numero: "Número",
  data: "Data",
  select: "Escolha única",
  multi: "Múltipla escolha",
  sim_nao: "Sim / Não",
};

const FAIXA_PRESETS: { faixa: string; idade_min: number | null; idade_max: number | null }[] = [
  { faixa: "Pré-escolar", idade_min: 0, idade_max: 5 },
  { faixa: "Escolar", idade_min: 6, idade_max: 17 },
  { faixa: "Adulto", idade_min: 18, idade_max: 59 },
  { faixa: "Idoso", idade_min: 60, idade_max: null },
];

function novaPergunta(): Pergunta {
  return { id: crypto.randomUUID(), label: "", tipo: "texto", obrigatoria: false };
}

function faixaResumo(m: { idade_min: number | null; idade_max: number | null }): string {
  const { idade_min, idade_max } = m;
  if (idade_min == null && idade_max == null) return "Todas as idades";
  if (idade_min != null && idade_max != null) return `${idade_min}–${idade_max} anos`;
  if (idade_min != null) return `${idade_min}+ anos`;
  return `até ${idade_max} anos`;
}

// ============================================================
// Página
// ============================================================
function ModelosPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Modelo | null>(null);

  const { data: modelos } = useQuery({
    queryKey: ["cadastro-modelos"],
    queryFn: async (): Promise<Modelo[]> => {
      const { data } = await supabase
        .from("cadastro_modelos")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []).map((m) => ({
        ...m,
        perguntas: Array.isArray(m.perguntas) ? (m.perguntas as unknown as Pergunta[]) : [],
      })) as Modelo[];
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cadastro_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Modelo excluído"); qc.invalidateQueries({ queryKey: ["cadastro-modelos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (m: Modelo) => {
      const { error } = await supabase.from("cadastro_modelos").update({ ativo: !m.ativo }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastro-modelos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function novoModelo() {
    setEditing({
      id: "",
      nome: "",
      faixa: null,
      idade_min: null,
      idade_max: null,
      perguntas: [],
      ativo: true,
      padrao: false,
      ordem: (modelos?.length ?? 0),
    });
  }

  if (!isAdmin) {
    return (
      <Card className="glass-strong p-8 max-w-md mx-auto mt-10 text-center">
        <h1 className="text-xl font-display mb-2">Acesso restrito</h1>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar os modelos de cadastro.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={LayoutTemplate}
        eyebrow="Recepção · Cadastro público"
        title="Modelos de cadastro"
        description="Crie conjuntos de perguntas extras por faixa de idade (pré-escolar, escolar, adulto, idoso). Elas são anexadas automaticamente ao formulário público conforme a idade do paciente."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/cadastros"><ArrowLeft className="w-4 h-4 mr-1.5" />Voltar</Link>
            </Button>
            <Button className="gradient-brand text-white" onClick={novoModelo}>
              <Plus className="w-4 h-4 mr-1.5" />Novo modelo
            </Button>
          </div>
        }
      />

      <div className="grid gap-3">
        {(modelos ?? []).length === 0 && (
          <Card className="glass p-8 text-center text-muted-foreground">
            Nenhum modelo criado ainda. Clique em <strong>Novo modelo</strong> para começar.
          </Card>
        )}
        {(modelos ?? []).map((m) => (
          <Card key={m.id} className="glass card-lift p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold truncate">{m.nome || "Sem nome"}</p>
                  {m.faixa && <Badge className="bg-brand/15 text-brand">{m.faixa}</Badge>}
                  {m.padrao && (
                    <Badge className="bg-amber-100 text-amber-700 gap-1"><Star className="w-3 h-3" />Padrão</Badge>
                  )}
                  {!m.ativo && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {faixaResumo(m)} · {m.perguntas.length} pergunta{m.perguntas.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-1">
                  <Switch checked={m.ativo} onCheckedChange={() => toggleAtivo.mutate(m)} />
                  <span className="text-xs text-muted-foreground">Ativo</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                  <Pencil className="w-4 h-4 mr-1.5" />Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O modelo "{m.nome}" será removido. Links já gerados que usavam este modelo deixarão
                        de mostrar as perguntas extras. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir.mutate(m.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <EditorModelo
          modelo={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["cadastro-modelos"] }); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Editor de modelo
// ============================================================
function EditorModelo({
  modelo, onClose, onSaved,
}: { modelo: Modelo; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(modelo.nome);
  const [faixa, setFaixa] = useState(modelo.faixa ?? "");
  const [idadeMin, setIdadeMin] = useState<string>(modelo.idade_min?.toString() ?? "");
  const [idadeMax, setIdadeMax] = useState<string>(modelo.idade_max?.toString() ?? "");
  const [padrao, setPadrao] = useState(modelo.padrao);
  const [ativo, setAtivo] = useState(modelo.ativo);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(modelo.perguntas);

  function aplicarPreset(p: (typeof FAIXA_PRESETS)[number]) {
    setFaixa(p.faixa);
    setIdadeMin(p.idade_min?.toString() ?? "");
    setIdadeMax(p.idade_max?.toString() ?? "");
  }

  function addPergunta() { setPerguntas((ps) => [...ps, novaPergunta()]); }
  function updatePergunta(id: string, patch: Partial<Pergunta>) {
    setPerguntas((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removePergunta(id: string) { setPerguntas((ps) => ps.filter((p) => p.id !== id)); }
  function move(id: string, dir: -1 | 1) {
    setPerguntas((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const copy = [...ps];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Dê um nome ao modelo");
      const limpo = perguntas
        .map((p) => ({ ...p, label: p.label.trim() }))
        .filter((p) => p.label);
      const payload = {
        nome: nome.trim(),
        faixa: faixa.trim() || null,
        idade_min: idadeMin === "" ? null : Number(idadeMin),
        idade_max: idadeMax === "" ? null : Number(idadeMax),
        padrao,
        ativo,
        perguntas: limpo as unknown as never,
      };
      if (modelo.id) {
        const { error } = await supabase.from("cadastro_modelos").update(payload).eq("id", modelo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cadastro_modelos").insert({ ...payload, ordem: modelo.ordem });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Modelo salvo"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>
            Defina a faixa de idade e as perguntas extras que a família responderá no cadastro público.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Nome do modelo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cadastro escolar" />
          </div>

          <div>
            <Label className="mb-1.5 block">Faixa de idade</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {FAIXA_PRESETS.map((p) => (
                <Button
                  key={p.faixa}
                  type="button"
                  size="sm"
                  variant={faixa === p.faixa ? "default" : "outline"}
                  className={faixa === p.faixa ? "gradient-brand text-white" : ""}
                  onClick={() => aplicarPreset(p)}
                >
                  {p.faixa}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Rótulo</Label>
                <Input value={faixa} onChange={(e) => setFaixa(e.target.value)} placeholder="Ex.: Escolar" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Idade mín.</Label>
                  <Input type="number" min={0} value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} placeholder="—" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Idade máx.</Label>
                  <Input type="number" min={0} value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} placeholder="—" />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deixe as idades em branco para "sem limite". O modelo é aplicado automaticamente quando a idade do
              paciente cai nesta faixa.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={padrao} onCheckedChange={setPadrao} />
              <span className="text-sm">Usar como padrão (quando nenhuma faixa casa)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <span className="text-sm">Ativo</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Perguntas ({perguntas.length})</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPergunta}>
                <Plus className="w-4 h-4 mr-1.5" />Adicionar pergunta
              </Button>
            </div>
            <div className="space-y-3">
              {perguntas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma pergunta ainda. Adicione a primeira.
                </p>
              )}
              {perguntas.map((p, idx) => (
                <PerguntaEditor
                  key={p.id}
                  pergunta={p}
                  index={idx}
                  total={perguntas.length}
                  onChange={(patch) => updatePergunta(p.id, patch)}
                  onRemove={() => removePergunta(p.id)}
                  onMove={(dir) => move(p.id, dir)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="gradient-brand text-white"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Editor de uma pergunta
// ============================================================
function PerguntaEditor({
  pergunta, index, total, onChange, onRemove, onMove,
}: {
  pergunta: Pergunta;
  index: number;
  total: number;
  onChange: (patch: Partial<Pergunta>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const temOpcoes = pergunta.tipo === "select" || pergunta.tipo === "multi";
  return (
    <Card className="p-3 border-border/60">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center pt-2 text-muted-foreground">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={pergunta.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Texto da pergunta"
            />
            <Select value={pergunta.tipo} onValueChange={(v) => onChange({ tipo: v as TipoPergunta })}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as TipoPergunta[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {temOpcoes && (
            <div>
              <Label className="text-xs text-muted-foreground">Opções (uma por linha)</Label>
              <Textarea
                rows={3}
                value={(pergunta.opcoes ?? []).join("\n")}
                onChange={(e) =>
                  onChange({ opcoes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                }
                placeholder={"Opção A\nOpção B"}
              />
            </div>
          )}

          <Input
            value={pergunta.ajuda ?? ""}
            onChange={(e) => onChange({ ajuda: e.target.value })}
            placeholder="Texto de ajuda (opcional)"
            className="text-sm"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={!!pergunta.obrigatoria} onCheckedChange={(v) => onChange({ obrigatoria: v })} />
              <span className="text-xs text-muted-foreground">Obrigatória</span>
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
