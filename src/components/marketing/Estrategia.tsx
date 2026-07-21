import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ChevronRight, Sparkles, Quote } from "lucide-react";
import { toast } from "sonner";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { MktIcon, MKT_ICON_OPCOES } from "./mkt-icons";
import type { MktObjetivo, MktFunil, MktFunilAcao, MktPrincipio, MktEtapaChip } from "./types";

const PALETA = ["#ec4899", "#a855f7", "#5585b1", "#22c55e", "#f9ca0a", "#06b6d4", "#f59e0b", "#ef4444"];

export function Estrategia() {
  const qc = useQueryClient();
  const invalidar = () => invalidarMarketing(qc);

  const { data: objetivos } = useQuery({
    queryKey: ["mkt-objetivos"],
    queryFn: async () =>
      ((await supabase.from("marketing_objetivos").select("*").eq("ativo", true).order("ordem")).data ?? []) as MktObjetivo[],
  });
  const { data: funis } = useQuery({
    queryKey: ["mkt-funis"],
    queryFn: async () =>
      ((await supabase.from("marketing_funis").select("*").eq("ativo", true).order("ordem")).data ?? []) as unknown as MktFunil[],
  });
  const { data: acoes } = useQuery({
    queryKey: ["mkt-funil-acoes"],
    queryFn: async () =>
      ((await supabase.from("marketing_funil_acoes").select("*").eq("ativo", true).order("ordem")).data ?? []) as MktFunilAcao[],
  });
  const { data: principios } = useQuery({
    queryKey: ["mkt-principios"],
    queryFn: async () =>
      ((await supabase.from("marketing_principios").select("*").eq("ativo", true).order("ordem")).data ?? []) as MktPrincipio[],
  });

  return (
    <div className="space-y-8">
      <ObjetivosSecao objetivos={objetivos ?? []} onChange={invalidar} />
      <FunisSecao funis={funis ?? []} acoes={acoes ?? []} onChange={invalidar} />
      <PrincipiosSecao principios={principios ?? []} onChange={invalidar} />
    </div>
  );
}

/* ============ OBJETIVOS ============ */

function ObjetivosSecao({ objetivos, onChange }: { objetivos: MktObjetivo[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<MktObjetivo> | null>(null);

  const salvar = useMutation({
    mutationFn: async (o: Partial<MktObjetivo>) => {
      if (o.id) {
        const { error } = await supabase.from("marketing_objetivos").update({ nome: o.nome, icone: o.icone }).eq("id", o.id);
        if (error) throw error;
      } else {
        const ordem = Math.max(0, ...objetivos.map((x) => x.ordem)) + 1;
        const { error } = await supabase.from("marketing_objetivos").insert({ nome: o.nome ?? "", icone: o.icone ?? "target", ordem });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Objetivo salvo"); setEditing(null); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_objetivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Objetivo removido"); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <SecaoHeader
        titulo="Objetivos estratégicos"
        subtitulo="Aonde o marketing e o comercial querem chegar"
        onAdicionar={() => setEditing({ nome: "", icone: "target" })}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {objetivos.map((o) => (
          <Card key={o.id} className="group glass card-lift relative">
            <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <MktIcon nome={o.icone} className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium leading-snug">{o.nome}</p>
              <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => setEditing(o)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <ConfirmaRemover onConfirm={() => remover.mutate(o.id)} />
              </div>
            </CardContent>
          </Card>
        ))}
        {objetivos.length === 0 && <VazioHint texto="Nenhum objetivo ainda. Adicione o primeiro." />}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar objetivo" : "Novo objetivo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Ícone</Label>
                <IconePicker value={editing.icone ?? "target"} onChange={(v) => setEditing({ ...editing, icone: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={salvar.isPending || !editing?.nome?.trim()} onClick={() => editing && salvar.mutate(editing)} className="gradient-brand text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ============ FUNIS ============ */

function FunisSecao({ funis, acoes, onChange }: { funis: MktFunil[]; acoes: MktFunilAcao[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<MktFunil> | null>(null);

  const salvar = useMutation({
    mutationFn: async (f: Partial<MktFunil>) => {
      const payload: any = {
        numero: f.numero, nome: f.nome, descricao: f.descricao, cor: f.cor,
        etapas: f.etapas ?? [],
      };
      if (f.id) {
        const { error } = await supabase.from("marketing_funis").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.ordem = Math.max(0, ...funis.map((x) => x.ordem)) + 1;
        payload.numero = f.numero ?? funis.length + 1;
        const { error } = await supabase.from("marketing_funis").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Funil salvo"); setEditing(null); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_funis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Funil removido"); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <SecaoHeader
        titulo="Funis estratégicos"
        subtitulo="Como cada fonte de leads vira paciente"
        onAdicionar={() => setEditing({ nome: "", descricao: "", cor: PALETA[0], etapas: [] })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {funis.map((f) => (
          <FunilCard
            key={f.id}
            funil={f}
            acoes={acoes.filter((a) => a.funil_id === f.id)}
            onEdit={() => setEditing(f)}
            onDelete={() => remover.mutate(f.id)}
            onChange={onChange}
          />
        ))}
        {funis.length === 0 && <VazioHint texto="Nenhum funil ainda." />}
      </div>

      <FunilEditDialog editing={editing} setEditing={setEditing} onSalvar={(f) => salvar.mutate(f)} pending={salvar.isPending} />
    </section>
  );
}

function FunilCard({
  funil, acoes, onEdit, onDelete, onChange,
}: { funil: MktFunil; acoes: MktFunilAcao[]; onEdit: () => void; onDelete: () => void; onChange: () => void }) {
  const [novaAcao, setNovaAcao] = useState("");
  const etapas: MktEtapaChip[] = Array.isArray(funil.etapas) ? funil.etapas : [];

  const addAcao = useMutation({
    mutationFn: async (texto: string) => {
      const ordem = Math.max(0, ...acoes.map((a) => a.ordem)) + 1;
      const { error } = await supabase.from("marketing_funil_acoes").insert({ funil_id: funil.id, texto, ordem });
      if (error) throw error;
    },
    onSuccess: () => { setNovaAcao(""); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_funil_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass card-lift">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: funil.cor }}
          >
            {funil.numero}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{funil.nome}</p>
            {funil.descricao && <p className="text-xs text-muted-foreground">{funil.descricao}</p>}
          </div>
          <div className="flex gap-0.5">
            <button className="rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></button>
            <ConfirmaRemover onConfirm={onDelete} />
          </div>
        </div>

        {etapas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {etapas.map((e, i) => (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: e.cor }}
                >
                  {e.label}
                </span>
                {i < etapas.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        )}

        <ul className="space-y-1.5">
          {acoes.map((a) => (
            <li key={a.id} className="group/acao flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              <span className="flex-1 leading-snug">{a.texto}</span>
              <button
                className="mt-0.5 opacity-0 transition-opacity group-hover/acao:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => delAcao.mutate(a.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 pt-1">
          <Input
            value={novaAcao}
            onChange={(e) => setNovaAcao(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && novaAcao.trim()) addAcao.mutate(novaAcao.trim()); }}
            placeholder="Adicionar ação…"
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={!novaAcao.trim() || addAcao.isPending} onClick={() => addAcao.mutate(novaAcao.trim())}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FunilEditDialog({
  editing, setEditing, onSalvar, pending,
}: {
  editing: Partial<MktFunil> | null;
  setEditing: (v: Partial<MktFunil> | null) => void;
  onSalvar: (f: Partial<MktFunil>) => void;
  pending: boolean;
}) {
  const etapasStr = (editing?.etapas ?? []).map((e) => e.label).join(", ");
  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing?.id ? "Editar funil" : "Novo funil"}</DialogTitle></DialogHeader>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <Label className="text-xs">Número</Label>
                <Input type="number" value={editing.numero ?? ""} onChange={(e) => setEditing({ ...editing, numero: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {PALETA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing({ ...editing, cor: c })}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition ${editing.cor === c ? "ring-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Etapas (separe por vírgula)</Label>
              <Input
                value={etapasStr}
                onChange={(e) => {
                  const etapas: MktEtapaChip[] = e.target.value.split(",").map((s, i) => ({
                    label: s.trim(),
                    cor: PALETA[i % PALETA.length],
                  })).filter((x) => x.label);
                  setEditing({ ...editing, etapas });
                }}
                placeholder="Instagram, Conteúdo, WhatsApp, Paciente"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button disabled={pending || !editing?.nome?.trim()} onClick={() => editing && onSalvar(editing)} className="gradient-brand text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ PRINCÍPIOS ============ */

function PrincipiosSecao({ principios, onChange }: { principios: MktPrincipio[]; onChange: () => void }) {
  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");

  const add = useMutation({
    mutationFn: async (texto: string) => {
      const ordem = Math.max(0, ...principios.map((p) => p.ordem)) + 1;
      const { error } = await supabase.from("marketing_principios").insert({ texto, ordem });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const salvar = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase.from("marketing_principios").update({ texto }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEditId(null); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_principios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-display">
          <Sparkles className="h-4 w-4 text-brand" /> Princípios
        </h2>
        <p className="text-sm text-muted-foreground">Valores que guiam a comunicação da Nave</p>
      </div>
      <div className="space-y-2">
        {principios.map((p) => (
          <Card key={p.id} className="glass">
            <CardContent className="flex items-start gap-3 p-3.5">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand/60" />
              {editId === p.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea rows={2} value={editTexto} onChange={(e) => setEditTexto(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!editTexto.trim()} onClick={() => salvar.mutate({ id: p.id, texto: editTexto.trim() })}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="flex-1 text-sm leading-snug">{p.texto}</p>
                  <div className="flex gap-0.5">
                    <button className="rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => { setEditId(p.id); setEditTexto(p.texto); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <ConfirmaRemover onConfirm={() => remover.mutate(p.id)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {principios.length === 0 && <VazioHint texto="Nenhum princípio cadastrado. Escreva o primeiro abaixo." />}
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea
          rows={1}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Ex.: Comunicar com acolhimento, sem prometer resultados…"
          className="min-h-9"
        />
        <Button variant="outline" className="shrink-0" disabled={!novo.trim() || add.isPending} onClick={() => add.mutate(novo.trim())}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
    </section>
  );
}

/* ============ AUXILIARES ============ */

function SecaoHeader({ titulo, subtitulo, onAdicionar }: { titulo: string; subtitulo: string; onAdicionar: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-display">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onAdicionar}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar
      </Button>
    </div>
  );
}

function IconePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MKT_ICON_OPCOES.map((nome) => (
          <SelectItem key={nome} value={nome}>
            <span className="flex items-center gap-2">
              <MktIcon nome={nome} className="h-4 w-4" /> {nome}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConfirmaRemover({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VazioHint({ texto }: { texto: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
