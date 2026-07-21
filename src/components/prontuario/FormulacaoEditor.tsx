import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

/**
 * Formulação Clínica estruturada (ETAPA 2 + 4).
 * Cinco categorias CIF em listas priorizáveis. Substitui o antigo CIF texto-livre
 * como camada principal. As restrições de participação carregam os 4 escores 1-5
 * que alimentam a priorização automática.
 */

type Item = {
  id: string;
  plano_id: string;
  categoria: string;
  descricao: string;
  impacto: string | null;
  confianca: string | null;
  impacto_funcional: number | null;
  urgencia: number | null;
  potencial_mudanca: number | null;
  frequencia: number | null;
  prioridade: number | null;
  ordem: number;
};

const CATEGORIAS = [
  { key: "restricao_participacao", label: "🌍 Restrições de participação", hint: "Atividades da vida real prejudicadas (copiar do quadro, produzir textos, fazer provas…)", modo: "restricao" as const },
  { key: "limitacao_atividade", label: "⚙️ Limitações de atividade", hint: "Atividades específicas comprometidas (leitura, escrita, cálculo, organização…)", modo: "impacto" as const },
  { key: "funcao_relacionada", label: "🧠 Funções relacionadas (hipóteses)", hint: "Funções que sustentam as dificuldades — hipóteses explicativas, NÃO metas", modo: "confianca" as const },
  { key: "fator_ambiental", label: "🏠 Fatores ambientais", hint: "Adaptações escolares, apoio familiar, rotina…", modo: "simples" as const },
  { key: "fator_pessoal", label: "⭐ Fatores pessoais", hint: "Motivação, autorregulação, autoestima, interesses…", modo: "simples" as const },
];

const IMPACTO = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
];
const CONFIANCA = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

export function FormulacaoEditor({ planoId }: { planoId: string }) {
  const qc = useQueryClient();
  const { data: itens = [] } = useQuery({
    queryKey: ["plano-formulacao", planoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plano_formulacao_itens")
        .select("*")
        .eq("plano_id", planoId)
        .order("categoria")
        .order("ordem");
      return (data ?? []) as Item[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["plano-formulacao", planoId] });

  async function adicionar(categoria: string) {
    const ordem = itens.filter((i) => i.categoria === categoria).length;
    const { error } = await supabase.from("plano_formulacao_itens").insert({
      plano_id: planoId, categoria, descricao: "", ordem, origem: "manual",
    });
    if (error) { toast.error(error.message); return; }
    invalidate();
  }

  return (
    <div className="space-y-4">
      {CATEGORIAS.map((cat) => {
        const doGrupo = itens.filter((i) => i.categoria === cat.key);
        const ordenados = cat.modo === "restricao"
          ? [...doGrupo].sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99))
          : doGrupo;
        return (
          <div key={cat.key} className="rounded-lg border border-border/60 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-[11px] text-muted-foreground">{cat.hint}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => adicionar(cat.key)}>
                <Plus className="mr-1 h-3.5 w-3.5" />Item
              </Button>
            </div>
            {ordenados.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground/70">Nenhum item.</p>
            ) : (
              <div className="space-y-2">
                {ordenados.map((item) => (
                  <ItemRow key={item.id} item={item} modo={cat.modo} onChanged={invalidate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({ item, modo, onChanged }: { item: Item; modo: "restricao" | "impacto" | "confianca" | "simples"; onChanged: () => void }) {
  const [descricao, setDescricao] = useState(item.descricao ?? "");

  async function patch(campos: Record<string, any>) {
    const { error } = await supabase.from("plano_formulacao_itens").update(campos as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }
  async function excluir() {
    await supabase.from("plano_formulacao_itens").delete().eq("id", item.id);
    onChanged();
  }

  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
      <div className="flex items-start gap-2">
        {modo === "restricao" && item.prioridade != null && (
          <Badge variant="outline" className="mt-1 shrink-0 text-[10px]">P{item.prioridade}</Badge>
        )}
        <Textarea
          rows={1}
          className="min-h-8 flex-1 bg-background text-xs"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => { if (descricao !== item.descricao) patch({ descricao }); }}
          placeholder="Descreva…"
        />
        <Button size="sm" variant="ghost" className="shrink-0" onClick={excluir}>
          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
        </Button>
      </div>

      {(modo === "impacto" || modo === "restricao") && (
        <div className="mt-2 flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Impacto</Label>
          <Select value={item.impacto ?? ""} onValueChange={(v) => patch({ impacto: v })}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{IMPACTO.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {modo === "confianca" && (
        <div className="mt-2 flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Confiança da hipótese</Label>
          <Select value={item.confianca ?? ""} onValueChange={(v) => patch({ confianca: v })}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{CONFIANCA.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {modo === "restricao" && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ScoreField label="Impacto func." value={item.impacto_funcional} onSave={(v) => patch({ impacto_funcional: v })} />
          <ScoreField label="Urgência" value={item.urgencia} onSave={(v) => patch({ urgencia: v })} />
          <ScoreField label="Potencial" value={item.potencial_mudanca} onSave={(v) => patch({ potencial_mudanca: v })} />
          <ScoreField label="Frequência" value={item.frequencia} onSave={(v) => patch({ frequencia: v })} />
        </div>
      )}
    </div>
  );
}

function ScoreField({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value != null ? String(value) : ""} onValueChange={(v) => onSave(v ? Number(v) : null)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
