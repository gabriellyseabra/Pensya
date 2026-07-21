import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  date?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "muted" | "success" | "warning" | "danger";
  onClick?: () => void;
  right?: ReactNode;
};

const toneMap: Record<NonNullable<TimelineItem["tone"]>, string> = {
  brand: "bg-brand/15 text-brand",
  muted: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-600",
  warning: "bg-amber-500/15 text-amber-600",
  danger: "bg-destructive/15 text-destructive",
};

export function TimelineList({
  items,
  empty = "Nenhum registro.",
  className,
}: {
  items: TimelineItem[];
  empty?: ReactNode;
  className?: string;
}) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className={cn("relative space-y-3 border-l border-border/50 pl-5", className)}>
      {items.map((it) => {
        const Icon = it.icon;
        const tone = it.tone ?? "brand";
        return (
          <li key={it.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full",
                toneMap[tone],
              )}
            >
              {Icon ? <Icon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div
              onClick={it.onClick}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2",
                it.onClick && "cursor-pointer hover:bg-accent/40 transition-colors",
              )}
            >
              <div className="min-w-0">
                {it.date && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.date}</p>}
                <div className="truncate text-sm font-medium">{it.title}</div>
                {it.description && (
                  <div className="text-xs text-muted-foreground">{it.description}</div>
                )}
              </div>
              {it.right && <div className="shrink-0">{it.right}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
