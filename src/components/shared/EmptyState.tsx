import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

/**
 * Estado vazio orientador: diz o que é a tela, por que importa e qual o
 * próximo passo — nunca um vazio mudo.
 */
export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  ctaLabel,
  ctaTo,
  onCta,
  children,
}: {
  icon?: LucideIcon;
  titulo: string;
  descricao: string;
  ctaLabel?: string;
  /** Rota de destino (Link) — alternativa a onCta. */
  ctaTo?: string;
  onCta?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card className="glass flex flex-col items-center gap-3 px-6 py-10 text-center">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="max-w-md space-y-1">
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      {ctaLabel && ctaTo && (
        <Button asChild size="sm" className="gradient-brand text-brand-foreground">
          <Link to={ctaTo}>{ctaLabel}</Link>
        </Button>
      )}
      {ctaLabel && onCta && !ctaTo && (
        <Button size="sm" className="gradient-brand text-brand-foreground" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
      {children}
    </Card>
  );
}
