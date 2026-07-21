import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Blocos de composição inspirados no painel de referência
 * (avatares em linha, número grande, mini-barras, tiles,
 * lista estilo notificações, destaque escuro, duas colunas).
 * Reutilizam a paleta e as utilities do Design System Nave.
 * ============================================================ */

/** Layout de duas colunas: conteúdo principal + painel lateral (340px). */
export function TwoColumn({
  children,
  side,
}: {
  children: ReactNode;
  side: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">{children}</div>
      <div className="space-y-4">{side}</div>
    </div>
  );
}

/** Card branco arredondado com cabeçalho (título + ícone + ação). */
export function PanelCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  delay,
}: {
  title?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn("animate-fade-up soft-card p-5", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-base font-medium">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-lilac" />}
            <span className="truncate">{title}</span>
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Mini gráfico de barras (estilo "Data"/"Impact" do mockup). */
export function MiniBars({
  data,
  className,
  height = 48,
}: {
  data: { label?: string; value: number; active?: boolean }[];
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn("w-full rounded-t-md", d.active ? "bg-lilac" : "bg-lilac-soft")}
            style={{ height: `${Math.max(6, (d.value / max) * (height - 14))}px` }}
          />
          {d.label && (
            <span className="text-[9px] capitalize text-muted-foreground">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Card de número grande com mini-barras opcionais. */
export function BigStatCard({
  label,
  value,
  hint,
  bars,
  icon: Icon,
  className,
  delay,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  bars?: { label?: string; value: number; active?: boolean }[];
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn("animate-fade-up card-lift soft-card space-y-2 p-5", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-lilac" />}
      </div>
      <p className="text-3xl font-semibold leading-none">{value}</p>
      {bars && bars.length > 0 && <MiniBars data={bars} />}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Tile pequeno de estatística (estilo "Project complete/in progress"). */
export function StatTile({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-2xl border border-border/50 bg-background/40 p-4 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 grid h-9 w-9 place-items-center rounded-xl bg-lilac-soft text-lilac-foreground">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Linha estilo "notificação": ícone/avatar + duas linhas + acessório à direita. */
export function NotifRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-2 transition-colors",
        onClick && "cursor-pointer hover:bg-accent",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}

/** Card de destaque escuro (estilo "Breakthrough Brainstorm"). */
export function DarkHighlightCard({
  eyebrow,
  icon: Icon,
  children,
  className,
  delay,
}: {
  eyebrow?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "animate-fade-up card-lift rounded-[var(--radius)] border border-white/10 bg-rail p-5 text-rail-foreground shadow-[var(--shadow-card)] dark:bg-[oklch(0.26_0.03_285)]",
        className,
      )}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {eyebrow && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          {Icon && <Icon className="h-3.5 w-3.5" />} {eyebrow}
        </div>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}
