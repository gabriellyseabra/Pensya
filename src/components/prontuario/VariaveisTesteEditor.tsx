import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Trash2 } from "lucide-react";

export type VariavelDef = {
  key: string;
  label: string;
  tipo: "numero" | "texto";
  unidade?: string | null;
};

// Cada variável agora carrega um resultado completo (como na planilha clínica)
export type VariavelResultado = {
  bruto?: number | string | null;
  padrao?: number | null;
  percentil?: number | null;
  impressoes?: string | null;
};

export type VariaveisValores = Record<string, VariavelResultado | string | number>;

export function slugifyKey(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `var_${Date.now()}`;
}

// Compat: aceita formato antigo (primitivo) e novo (objeto)
export function normalizarResultado(v: VariavelResultado | string | number | null | undefined): VariavelResultado {
  if (v == null) return {};
  if (typeof v === "object") return v;
  return { bruto: v };
}

// Bandas alinhadas à tabela clínica padrão (escore-padrão M=100, DP=15)
export function classificarPorPercentil(p: number | null | undefined): string | null {
  if (p == null || isNaN(Number(p))) return null;
  const n = Number(p);
  if (n < 2) return "Extremamente inferior";
  if (n <= 8) return "Inferior à média";
  if (n <= 24) return "Média Inferior";
  if (n <= 74) return "Média";
  if (n <= 90) return "Média Superior";
  if (n <= 97) return "Superior à média";
  return "Extremamente superior";
}

export function classificarPorPadrao(s: number | null | undefined): string | null {
  if (s == null || isNaN(Number(s))) return null;
  const n = Number(s);
  if (n < 70) return "Extremamente inferior";
  if (n <= 79) return "Inferior à média";
  if (n <= 89) return "Média Inferior";
  if (n <= 109) return "Média";
  if (n <= 119) return "Média Superior";
  if (n <= 129) return "Superior à média";
  return "Extremamente superior";
}

// Regra clínica: classifica pelo percentil; se ausente, usa escore-padrão
export function classificarResultado(
  percentil: number | null | undefined,
  padrao: number | null | undefined,
): string | null {
  return classificarPorPercentil(percentil) ?? classificarPorPadrao(padrao);
}

export function corClassificacaoBg(c: string | null | undefined): string {
  switch (c) {
    case "Extremamente superior": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "Superior à média":      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "Média Superior":        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "Média":                 return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "Média Inferior":        return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "Inferior à média":      return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "Extremamente inferior": return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "Qualitativo":           return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    default:                      return "bg-muted/40 text-muted-foreground";
  }
}

export function VariaveisTesteEditor({
  schema,
  valores,
  onChangeValores,
  onAddSchema,
  onRemoveSchema,
}: {
  schema: VariavelDef[];
  valores: VariaveisValores;
  onChangeValores: (v: VariaveisValores) => void;
  onAddSchema: (v: VariavelDef) => void;
  onRemoveSchema?: (key: string) => void;
}) {
  const [novaLabel, setNovaLabel] = useState("");

  function addNova() {
    const label = novaLabel.trim();
    if (!label) return;
    const key = slugifyKey(label);
    if (schema.some((s) => s.key === key)) return;
    onAddSchema({ key, label, tipo: "numero", unidade: null });
    setNovaLabel("");
  }

  function setCampo(key: string, campo: keyof VariavelResultado, v: string) {
    const atual = normalizarResultado(valores[key]);
    const novo: VariavelResultado = { ...atual };
    if (campo === "impressoes") {
      novo.impressoes = v || null;
    } else if (campo === "bruto") {
      novo.bruto = v === "" ? null : v;
    } else {
      novo[campo] = v === "" ? null : Number(v);
    }
    onChangeValores({ ...valores, [key]: novo });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          Variáveis & resultados
          {schema.length > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="w-2.5 h-2.5" />memória ativa</Badge>}
        </Label>
        <span className="text-[10px] text-muted-foreground">novas variáveis ficam disponíveis em todos os pacientes</span>
      </div>

      {schema.length === 0 ? (
        <p className="text-xs text-muted-foreground/80">Nenhuma variável cadastrada. Adicione a primeira abaixo (ex: Total Desenhos, %C, Ordem direta...).</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60 bg-background/40">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-1.5 min-w-[140px]">Variável</th>
                <th className="px-1 py-1.5 w-[80px]">Bruto</th>
                <th className="px-1 py-1.5 w-[80px]">Padrão</th>
                <th className="px-1 py-1.5 w-[80px]">Percentil</th>
                <th className="px-1 py-1.5 w-[140px]">Classificação</th>
                <th className="px-1 py-1.5">Impressões</th>
                {onRemoveSchema && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {schema.map((v) => {
                const r = normalizarResultado(valores[v.key]);
                const classif = classificarResultado(r.percentil ?? null, r.padrao ?? null);
                return (
                  <tr key={v.key} className="border-t border-border/40">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{v.label}</div>
                      {v.unidade && <div className="text-[9px] text-muted-foreground">({v.unidade})</div>}
                    </td>
                    <td className="px-1 py-1">
                      <Input value={r.bruto ?? ""} onChange={(e) => setCampo(v.key, "bruto", e.target.value)} className="h-7 text-xs" />
                    </td>
                    <td className="px-1 py-1">
                      <Input type="number" value={r.padrao ?? ""} onChange={(e) => setCampo(v.key, "padrao", e.target.value)} className="h-7 text-xs" />
                    </td>
                    <td className="px-1 py-1">
                      <Input type="number" min="0" max="100" step="0.01" value={r.percentil ?? ""} onChange={(e) => setCampo(v.key, "percentil", e.target.value)} className="h-7 text-xs" />
                    </td>
                    <td className="px-1 py-1">
                      {classif ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${corClassificacaoBg(classif)}`}>{classif}</span>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-1 py-1">
                      <Input value={r.impressoes ?? ""} onChange={(e) => setCampo(v.key, "impressoes", e.target.value)} placeholder="Ex: P:25, déficit leve" className="h-7 text-xs" />
                    </td>
                    {onRemoveSchema && (
                      <td className="px-1 py-1">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemoveSchema(v.key)}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 border-t border-border/60 pt-3">
        <Input
          className="flex-1 h-9"
          placeholder="Nome da variável (ex: Total Desenhos, %C, Ordem direta…)"
          value={novaLabel}
          onChange={(e) => setNovaLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNova(); } }}
        />
        <Button type="button" size="sm" variant="secondary" onClick={addNova} disabled={!novaLabel.trim()}>
          <Plus className="w-4 h-4 mr-1" />Adicionar variável
        </Button>
      </div>
    </div>
  );
}
