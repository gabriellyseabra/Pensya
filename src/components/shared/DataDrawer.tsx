import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface DataDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Quando definido, exibe um cabeçalho com faixa em gradiente lilás e este ícone. */
  icon?: React.ReactNode;
  /** Ativa o cabeçalho estilizado (faixa gradiente). Default: false (mantém o cabeçalho simples). */
  accent?: boolean;
}

const widthClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

/**
 * Painel lateral padrão da Nave — usado para detalhes de qualquer entidade
 * (atendimento, tarefa, paciente, pagamento, recurso, etc.).
 */
export function DataDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  width = "lg",
  children,
  footer,
  icon,
  accent = false,
}: DataDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col w-full overflow-hidden",
          widthClasses[width],
          accent && "p-0 gap-0",
        )}
      >
        {accent ? (
          <SheetHeader className="shrink-0 space-y-0 gradient-lilac px-6 py-5 text-left">
            <div className="flex items-center gap-3">
              {icon && (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lilac-foreground shadow-sm backdrop-blur">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <SheetTitle className="text-lg text-lilac-foreground">{title}</SheetTitle>
                {description && (
                  <SheetDescription className="text-lilac-foreground/70">
                    {description}
                  </SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>
        ) : (
          <SheetHeader className="shrink-0">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div
          className={cn(
            "flex-1 overflow-y-auto space-y-4",
            accent ? "px-6 py-4" : "-mx-6 px-6 py-4",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className={cn("shrink-0 border-t pt-3", accent && "px-6 pb-4")}>{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
