import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Library, Plus, Trash2, Pencil, ExternalLink, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export const Route = createFileRoute("/_authenticated/configuracoes/recursos")({
  component: RecursosPage,
});

export const RECURSO_TIPOS = [
  { value: "jogo", label: "Jogo" },
  { value: "material", label: "Material" },
  { value: "estrategia", label: "Estratégia" },
  { value: "atividade", label: "Atividade" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "outro", label: "Outro" },
];
const TIPO_LABEL = Object.fromEntries(RECURSO_TIPOS.map((t) => [t.value, t.label]));

type Recurso = {
  id: string; nome: string; tipo: string; descricao: string | null; link: string | null;
  dominio: string | null; tags: string[]; ativo: boolean;
};

const vazio = { nome: "", tipo: "material", descricao: "", link: "", dominio: "", tags: "", ativo: true };

function RecursosPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [dialog, setDialog] = useState<null | { id?: string; form: typeof vazio }>(null);

  const { data: recursos = [] } = useQuery({
    queryKey: ["recursos-bank"],
    queryFn: async () => {
      const { data } = await supabase.from("recursos").select("*").order("nome");
      return (data ?? []) as Recurso[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return recursos.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (!q) return true;
      return r.nome.toLowerCase().includes(q)
        || (r.dominio ?? "").toLowerCase().includes(q)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(q));
    });
  }, [recursos, busca, filtroTipo]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recursos-bank"] });

  async function salvar() {
    if (!dialog) return;
    const f = dialog.form;
    if (!f.nome.trim()) { toast.error("Informe o nome do recurso"); return; }
    const payload = {
      nome: f.nome.trim(), tipo: f.tipo, descricao: f.descricao || null, link: f.link || null,
      dominio: f.dominio || null, ativo: f.ativo,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    if (dialog.id) {
      const { error } = await supabase.from("recursos").update(payload).eq("id", dialog.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("recursos").insert({ ...payload, created_by: u.user?.id ?? null });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Recurso salvo");
    setDialog(null);
    invalidate();
  }

  async function excluir(r: Recurso) {
    if (!confirm(`Excluir "${r.nome}"?`)) return;
    await supabase.from("recursos").delete().eq("id", r.id);
    invalidate();
  }
  async function toggleAtivo(r: Recurso) {
    await supabase.from("recursos").update({ ativo: !r.ativo }).eq("id", r.id);
    invalidate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Library}
        title="Banco de Recursos"
        description="Jogos, materiais, estratégias e tecnologias organizados por habilidades/domínios (tags) — para apoiar a escolha nas sessões."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, domínio ou tag…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {RECURSO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setDialog({ form: { ...vazio } })}><Plus className="mr-2 h-4 w-4" />Novo recurso</Button>
      </div>

      {filtrados.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {recursos.length === 0 ? "Nenhum recurso cadastrado. Comece adicionando jogos, materiais e estratégias do consultório." : "Nenhum recurso encontrado com esse filtro."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((r) => (
            <Card key={r.id} className={r.ativo ? "" : "opacity-60"}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{r.nome}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                    {r.dominio && <Badge variant="secondary" className="ml-1 mt-1 text-[10px]">{r.dominio}</Badge>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ id: r.id, form: {
                      nome: r.nome, tipo: r.tipo, descricao: r.descricao ?? "", link: r.link ?? "", dominio: r.dominio ?? "", tags: (r.tags ?? []).join(", "), ativo: r.ativo,
                    } })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir(r)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                  </div>
                </div>
                {r.descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{r.descricao}</p>}
                {(r.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">{r.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
                )}
                {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><ExternalLink className="h-3 w-3" />abrir link</a>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog?.id ? "Editar recurso" : "Novo recurso"}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome</Label>
                <Input value={dialog.form.nome} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, nome: e.target.value } })} placeholder="Ex.: Jogo da memória fonológica" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={dialog.form.tipo} onValueChange={(v) => setDialog({ ...dialog, form: { ...dialog.form, tipo: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECURSO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Domínio (opcional)</Label>
                <Input value={dialog.form.dominio} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, dominio: e.target.value } })} placeholder="Ex.: Linguagem" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Tags / habilidades (vírgula)</Label>
                <Input value={dialog.form.tags} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, tags: e.target.value } })} placeholder="Ex.: consciência fonológica, atenção, memória de trabalho" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrição / como usar</Label>
                <Textarea rows={3} value={dialog.form.descricao} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, descricao: e.target.value } })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Link (opcional)</Label>
                <Input value={dialog.form.link} onChange={(e) => setDialog({ ...dialog, form: { ...dialog.form, link: e.target.value } })} placeholder="https://…" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={dialog.form.ativo} onCheckedChange={(v) => setDialog({ ...dialog, form: { ...dialog.form, ativo: v } })} />
                <Label className="text-xs">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
