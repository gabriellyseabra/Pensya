import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, Ruler, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/PageHero";
import { PALETA_SISTEMA, PRESETS, type Faixa, type Rubrica, type RubricaBase } from "@/lib/avaliacao-classificacao";

export const Route = createFileRoute("/_authenticated/configuracoes/rubricas")({
  component: RubricasPage,
});

const db = supabase as any;

function RubricasPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; edit: Rubrica | null }>({ open: false, edit: null });

  const { data: rubricas = [] } = useQuery({
    queryKey: ["rubricas-classificacao"],
    queryFn: async () => {
      const { data, error } = await db
        .from("rubricas_classificacao")
        .select("id, org_id, slug, nome, base, faixas, is_preset")
        .order("is_preset", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Rubrica[];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("rubricas_classificacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rubricas-classificacao"] }); toast.success("Rubrica removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const presets = rubricas.filter((r) => r.is_preset);
  const custom = rubricas.filter((r) => !r.is_preset);

  return (
    <div className="space-y-6">
      <PageHero
        icon={Ruler}
        eyebrow="Avaliação"
        title="Rubricas de classificação"
        description="As réguas de faixas que traduzem percentil ou escore-padrão em classificação. Cada teste aponta para uma rubrica — use os presets ou cadastre a régua do seu instrumento (ex.: TDE II, coleção Seabra/ANC)."
        variant="brand"
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        O Pensya <b>não distribui tabela de norma</b> de nenhum teste. O percentil/escore continua sendo inserido por
        você (do material que a clínica licenciou); a rubrica só define em que faixa aquele número cai.
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Suas rubricas</h2>
          <Button size="sm" onClick={() => setDialog({ open: true, edit: null })} className="gradient-brand text-brand-foreground">
            <Plus className="mr-1.5 h-4 w-4" />Nova rubrica
          </Button>
        </div>
        {custom.length === 0 && (
          <Card className="glass"><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma rubrica própria ainda. Crie a régua do instrumento que você usa.
          </CardContent></Card>
        )}
        {custom.map((r) => (
          <RubricaCard key={r.id} rubrica={r} onEdit={() => setDialog({ open: true, edit: r })}
            onRemove={() => { if (confirm("Excluir esta rubrica?")) remover.mutate(r.id!); }} />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Presets do sistema <span className="text-xs font-normal text-muted-foreground">(somente leitura)</span></h2>
        {(presets.length ? presets : PRESETS).map((r) => (
          <RubricaCard key={r.id ?? r.slug} rubrica={r} readOnly />
        ))}
      </section>

      <RubricaDialog
        state={dialog}
        onClose={() => setDialog({ open: false, edit: null })}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["rubricas-classificacao"] }); setDialog({ open: false, edit: null }); }}
      />
    </div>
  );
}

const DESCRICAO_PRESET: Record<string, string> = {
  guillmette: "Escala de 4 faixas por percentil (Guillmette et al., 2020), comum em neuropsicologia — usa 9, 16 e 25 como cortes.",
  clinica_7: "Escala clínica geral de 7 faixas por percentil (do extremamente inferior ao extremamente superior). Boa opção quando o teste reporta percentil e não tem régua própria.",
  escore_padrao: "Para testes que entregam escore-padrão (média 100, desvio 15) — classifica por faixas de 10 pontos em torno da média.",
};

function RubricaCard({ rubrica, onEdit, onRemove, readOnly }: {
  rubrica: Rubrica; onEdit?: () => void; onRemove?: () => void; readOnly?: boolean;
}) {
  const faixas = [...(rubrica.faixas ?? [])].sort((a, b) => b.min - a.min);
  const descricao = rubrica.slug ? DESCRICAO_PRESET[rubrica.slug] : null;
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{rubrica.nome}</p>
            <p className="text-xs text-muted-foreground">
              Base: {rubrica.base === "escore_padrao" ? "escore-padrão" : "percentil"}
            </p>
            {descricao && <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>}
          </div>
          {!readOnly && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={onEdit} title="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={onRemove} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {faixas.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${f.cor}26`, color: f.cor }}>
              ≥{f.min} · {f.rotulo}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CORES_SISTEMA = PALETA_SISTEMA.map((c) => c.cor);

function RubricaDialog({ state, onClose, onSaved }: {
  state: { open: boolean; edit: Rubrica | null }; onClose: () => void; onSaved: () => void;
}) {
  const edit = state.edit;
  const [nome, setNome] = useState("");
  const [base, setBase] = useState<RubricaBase>("percentil");
  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [saving, setSaving] = useState(false);

  // Reinicia os campos quando abre (novo ou edição).
  const key = state.open ? edit?.id ?? "novo" : "fechado";
  useEffect(() => {
    if (!state.open) return;
    setNome(edit?.nome ?? "");
    setBase((edit?.base as RubricaBase) ?? "percentil");
    setFaixas(edit?.faixas?.length
      ? [...edit.faixas].sort((a, b) => b.min - a.min)
      : [{ min: 0, rotulo: "", cor: "#22c55e" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function setFaixa(i: number, campo: keyof Faixa, v: string) {
    setFaixas((fs) => fs.map((f, idx) => idx === i
      ? { ...f, [campo]: campo === "min" ? (v === "" ? 0 : Number(v)) : v }
      : f));
  }
  function addFaixa() {
    setFaixas((fs) => [...fs, { min: 0, rotulo: "", cor: CORES_SISTEMA[fs.length % CORES_SISTEMA.length] }]);
  }
  function removeFaixa(i: number) {
    setFaixas((fs) => fs.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    if (!nome.trim()) { toast.error("Dê um nome à rubrica"); return; }
    const limpa = faixas.filter((f) => f.rotulo.trim());
    if (limpa.length === 0) { toast.error("Adicione ao menos uma faixa com rótulo"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        base,
        faixas: [...limpa].sort((a, b) => b.min - a.min),
        is_preset: false,
        updated_at: new Date().toISOString(),
      };
      const { error } = edit?.id
        ? await db.from("rubricas_classificacao").update(payload).eq("id", edit.id)
        : await db.from("rubricas_classificacao").insert(payload);
      if (error) throw error;
      toast.success(edit ? "Rubrica atualizada" : "Rubrica criada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Editar rubrica" : "Nova rubrica"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: TDE II — Escrita (2º ano)" />
          </div>
          <div>
            <Label>Classificar por</Label>
            <Select value={base} onValueChange={(v) => setBase(v as RubricaBase)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentil">Percentil (0–100)</SelectItem>
                <SelectItem value="escore_padrao">Escore-padrão (M=100 / DP=15)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Faixas</Label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addFaixa}>
                <Plus className="mr-1 h-3 w-3" />Faixa
              </Button>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Cada faixa vale a partir do valor mínimo (inclusivo) até a próxima. Ex.: mín. 25 = "do 25 pra cima".
            </p>
            <div className="space-y-2">
              {faixas.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <div className="w-20">
                    <Input type="number" step="0.01" value={f.min} onChange={(e) => setFaixa(i, "min", e.target.value)}
                      placeholder="mín." className="h-8 text-xs" />
                  </div>
                  <Input value={f.rotulo} onChange={(e) => setFaixa(i, "rotulo", e.target.value)}
                    placeholder="Rótulo (ex.: Médio)" className="h-8 flex-1 text-xs" />
                  {/* Cores fixas do sistema (do mais baixo ao mais alto) — sem seletor livre. */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    {PALETA_SISTEMA.map((c) => (
                      <button
                        key={c.cor}
                        type="button"
                        title={c.nome}
                        onClick={() => setFaixa(i, "cor", c.cor)}
                        className={`h-6 w-6 rounded-full border-2 transition ${f.cor === c.cor ? "border-foreground/70 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c.cor }}
                      />
                    ))}
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeFaixa(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Prévia */}
          {faixas.some((f) => f.rotulo.trim()) && (
            <div>
              <Label className="text-xs text-muted-foreground">Prévia</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[...faixas].filter((f) => f.rotulo.trim()).sort((a, b) => b.min - a.min).map((f, i) => (
                  <Badge key={i} className="border-transparent" style={{ backgroundColor: `${f.cor}26`, color: f.cor }}>
                    ≥{f.min} · {f.rotulo}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{edit ? "Salvar" : "Criar rubrica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
