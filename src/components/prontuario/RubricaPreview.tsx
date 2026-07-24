import { type Rubrica } from "@/lib/avaliacao-classificacao";

/**
 * Prévia de uma rubrica: explica por qual valor ela classifica e mostra as
 * faixas (rótulo + cor), para a profissional identificar se bate com o teste.
 */
export function RubricaPreview({ rubrica }: { rubrica: Rubrica | null | undefined }) {
  if (!rubrica) return null;
  const faixas = [...(rubrica.faixas ?? [])].sort((a, b) => b.min - a.min);
  const base = rubrica.base === "escore_padrao" ? "escore-padrão (M=100 / DP=15)" : "percentil (0–100)";
  return (
    <div className="mt-1.5 rounded-md border border-border/40 bg-muted/20 p-2">
      <p className="mb-1 text-[10px] text-muted-foreground">
        Classifica pelo <b>{base}</b> — cada faixa vale do valor mínimo (inclusivo) para cima.
      </p>
      <div className="flex flex-wrap gap-1">
        {faixas.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${f.cor}26`, color: f.cor }}
          >
            ≥{f.min} · {f.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
