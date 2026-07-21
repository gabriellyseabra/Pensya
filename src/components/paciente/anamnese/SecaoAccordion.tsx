import { useState } from "react";
import { ChevronDown, Check, NotebookPen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SecaoDef, percentualSecao, campoVisivel } from "@/lib/anamnese-schema";
import { CampoAnamnese } from "./CampoAnamnese";

interface Props {
  def: SecaoDef;
  dados: Record<string, any>;
  importados: string[];
  resumo?: string;
  onChange: (campo: string, value: any) => void;
  onResumo: (resumo: string) => void;
}

export function SecaoAccordion({ def, dados, importados, resumo, onChange, onResumo }: Props) {
  const [open, setOpen] = useState(false);
  const pct = percentualSecao(def, dados);
  const completo = pct === 100;

  return (
    <Card className="glass overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <div
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full text-xs shrink-0",
            completo ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {completo ? <Check className="h-3.5 w-3.5" /> : pct + "%"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{def.titulo}</h3>
          </div>
          <Progress value={pct} className="h-1 mt-1" />
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border/40 p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {def.campos.filter((c) => campoVisivel(c, dados)).map((c) => (
              <CampoAnamnese
                key={c.key}
                campo={c}
                value={dados?.[c.key]}
                onChange={(v) => onChange(c.key, v)}
                importado={importados.includes(c.key)}
              />
            ))}
          </div>

          <div className="rounded-md border border-border/40 bg-muted/30 p-3 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <NotebookPen className="h-3 w-3 text-brand" /> Observações complementares
            </span>
            <Textarea
              value={resumo ?? ""}
              onChange={(e) => onResumo(e.target.value)}
              placeholder="Anote aqui qualquer observação clínica adicional sobre esta seção."
              className="min-h-[60px] text-xs bg-background"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
