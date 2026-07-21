import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/shared/FilterBar";
import { Copy, Plus, Star, Pencil, Trash2, FileText, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { invalidarMarketing } from "@/lib/marketing-cache";
import { CATEGORIAS_SCRIPT, labelCategoriaScript, type Script } from "./types";

export function Scripts() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [waScript, setWaScript] = useState<Script | null>(null);

  const { data: scripts } = useQuery({
    queryKey: ["scripts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scripts").select("*").order("favorito", { ascending: false }).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Script removido"); qc.invalidateQueries({ queryKey: ["scripts"] }); },
  });

  const favoritar = useMutation({
    mutationFn: async ({ id, favorito }: { id: string; favorito: boolean }) => {
      const { error } = await supabase.from("scripts").update({ favorito }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripts"] }),
  });

  const filtrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return (scripts ?? []).filter((s) => {
      if (categoria !== "todas" && s.categoria !== categoria) return false;
      if (termo && !s.titulo.toLowerCase().includes(termo) && !s.tags?.some((t) => t.toLowerCase().includes(termo))) return false;
      return true;
    });
  }, [scripts, categoria, search]);

  function copiar(conteudo: string) {
    navigator.clipboard?.writeText(conteudo);
    toast.success("Copiado para a área de transferência");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar search={search} onSearchChange={setSearch} placeholder="Buscar script ou tag..." className="flex-1" />
        <Button className="gradient-brand text-white" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Novo script
        </Button>
      </div>

      <Tabs value={categoria} onValueChange={setCategoria}>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <TabsList className="glass flex h-auto w-full flex-row flex-wrap justify-start gap-1 md:flex-col md:items-stretch">
            <TabsTrigger value="todas" className="w-full justify-start">Todas</TabsTrigger>
            {CATEGORIAS_SCRIPT.map((c) => (
              <TabsTrigger key={c.value} value={c.value} className="w-full justify-start">{c.label}</TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0">
            <TabsContent value={categoria} className="mt-0">
              <div className="grid gap-3 md:grid-cols-2">
                {filtrados.map((s, i) => (
                  <Card
                    key={s.id}
                    className="glass card-lift animate-fade-up"
                    style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base truncate">{s.titulo}</CardTitle>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => favoritar.mutate({ id: s.id, favorito: !s.favorito })}>
                          <Star className={`w-4 h-4 ${s.favorito ? "fill-brand-yellow text-brand-yellow" : ""}`} />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{labelCategoriaScript(s.categoria)}</Badge>
                        {s.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{s.conteudo}</p>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          className="bg-[#25D366] text-white hover:bg-[#1fb958]"
                          onClick={() => setWaScript(s)}
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copiar(s.conteudo)}><Copy className="w-3.5 h-3.5 mr-1" />Copiar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover script?")) del.mutate(s.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filtrados.length === 0 && (
                  <Card className="glass p-10 text-center text-muted-foreground md:col-span-2">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    Nenhum script encontrado.
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      <ScriptFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => invalidarMarketing(qc)}
      />

      <EnviarWhatsAppDialog script={waScript} onClose={() => setWaScript(null)} />
    </div>
  );
}

function ScriptFormDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Script | null; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(editing?.titulo ?? "");
  const [cat, setCat] = useState(editing?.categoria ?? "abordagem_inicial");
  const [conteudo, setConteudo] = useState(editing?.conteudo ?? "");
  const [tags, setTags] = useState((editing?.tags ?? []).join(", "));

  useMemo(() => {
    if (open) {
      setTitulo(editing?.titulo ?? "");
      setCat(editing?.categoria ?? "abordagem_inicial");
      setConteudo(editing?.conteudo ?? "");
      setTags((editing?.tags ?? []).join(", "));
    }
  }, [open, editing]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: titulo.trim(),
        categoria: cat,
        conteudo: conteudo.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (editing) {
        const { error } = await supabase.from("scripts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("scripts").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Script atualizado" : "Script criado"); onOpenChange(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Editar script" : "Novo script"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SCRIPT.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="preço, primeira ligação" />
            </div>
          </div>
          <div>
            <Label>Conteúdo *</Label>
            <Textarea rows={8} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="gradient-brand text-white" disabled={!titulo.trim() || !conteudo.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
            {editing ? "Salvar" : "Criar script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Normaliza telefone BR para o formato do wa.me (DDI 55 + DDD + número). */
function telefoneParaWa(tel: string): string | null {
  const digitos = tel.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

function EnviarWhatsAppDialog({ script, onClose }: { script: Script | null; onClose: () => void }) {
  const [busca, setBusca] = useState("");

  const { data: leads } = useQuery({
    queryKey: ["scripts-leads-whatsapp"],
    enabled: !!script,
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone")
        .not("telefone", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);
      return (data ?? []).filter((l) => l.telefone && telefoneParaWa(l.telefone));
    },
  });

  const termo = busca.trim().toLowerCase();
  const filtrados = (leads ?? []).filter(
    (l) => !termo || l.nome.toLowerCase().includes(termo) || (l.telefone ?? "").includes(termo),
  );

  function abrir(telefone: string) {
    if (!script) return;
    const numero = telefoneParaWa(telefone);
    if (!numero) { toast.error("Telefone inválido"); return; }
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(script.conteudo)}`, "_blank");
    onClose();
  }

  return (
    <Dialog open={!!script} onOpenChange={(o) => { if (!o) { setBusca(""); onClose(); } }}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar "{script?.titulo}" no WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Buscar lead por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {filtrados.map((l) => (
              <button
                key={l.id}
                onClick={() => abrir(l.telefone!)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="truncate font-medium">{l.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{l.telefone}</span>
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum lead com telefone encontrado.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
