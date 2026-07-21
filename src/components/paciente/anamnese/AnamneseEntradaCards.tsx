import { Card } from "@/components/ui/card";
import { PencilLine, FileUp, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Modo = "manual" | "pre-preenchida" | "importada";

interface Props {
  onSelect: (modo: Modo) => void;
  temPrePreenchida: boolean;
}

const OPCOES: { key: Modo; titulo: string; descricao: string; Icon: any }[] = [
  { key: "manual", titulo: "Preenchimento dentro do sistema", descricao: "A entrevista é feita aqui. A IA acompanha em tempo real e gera insights.", Icon: PencilLine },
  { key: "pre-preenchida", titulo: "Anamnese pré-preenchida pela família", descricao: "Usa as respostas do formulário público enviado aos responsáveis.", Icon: Sparkles },
  { key: "importada", titulo: "Importar documento (PDF / Word / Excel)", descricao: "A IA lê o documento e preenche os campos compatíveis para sua revisão.", Icon: FileUp },
];

export function AnamneseEntradaCards({ onSelect, temPrePreenchida }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {OPCOES.map(({ key, titulo, descricao, Icon }) => {
        const desabilitado = key === "pre-preenchida" && !temPrePreenchida;
        return (
          <button
            key={key}
            type="button"
            disabled={desabilitado}
            onClick={() => onSelect(key)}
            className={cn(
              "text-left disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-transform hover:-translate-y-0.5"
            )}
          >
            <Card className="glass h-full p-4 hover:border-brand/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center h-9 w-9 rounded-lg gradient-brand text-brand-foreground shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold leading-tight">{titulo}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{descricao}</p>
                  {desabilitado && (
                    <p className="text-[11px] text-amber-600 mt-2">Nenhum cadastro público preenchido encontrado.</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
