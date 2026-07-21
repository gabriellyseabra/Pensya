import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "lilac" | "brand" | "dark";

const variantSurface: Record<Variant, string> = {
  lilac: "gradient-lilac text-lilac-foreground",
  brand: "gradient-brand text-brand-foreground",
  dark: "bg-rail text-rail-foreground dark:bg-[oklch(0.26_0.03_285)]",
};

const variantMuted: Record<Variant, string> = {
  lilac: "text-lilac-foreground/80",
  brand: "text-brand-foreground/80",
  dark: "text-white/70",
};

const variantChip: Record<Variant, string> = {
  lilac: "bg-white/60 text-lilac-foreground",
  brand: "bg-white/20 text-brand-foreground",
  dark: "bg-white/10 text-white",
};

export interface HeroStat {
  label: string;
  value: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  stats,
  variant = "lilac",
  visual,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  stats?: HeroStat[];
  variant?: Variant;
  /** Elemento decorativo à direita (avatares, ilustração). */
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-up relative overflow-hidden rounded-[var(--radius)] p-6 shadow-[var(--shadow-card)] sm:p-7",
        variantSurface[variant],
        className,
      )}
    >
      {/* Orbs decorativos — linguagem liquid glass do painel */}
      <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/25 ring-1 ring-white/40 backdrop-blur">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.18em]",
                    variantMuted[variant],
                  )}
                >
                  {eyebrow}
                </p>
              )}
              <h1 className="truncate text-2xl font-display leading-tight sm:text-3xl">{title}</h1>
            </div>
          </div>
          {description && (
            <p className={cn("mt-2.5 text-sm leading-relaxed", variantMuted[variant])}>
              {description}
            </p>
          )}
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {visual}

        {!visual && stats && stats.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2.5">
            {stats.map((s, i) => {
              const SIcon = s.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    "animate-fade-up min-w-[104px] rounded-2xl px-4 py-3 ring-1 ring-white/30 backdrop-blur",
                    variantChip[variant],
                  )}
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <div className="flex items-center gap-1.5 opacity-80">
                    {SIcon && <SIcon className="h-3.5 w-3.5" />}
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold leading-none">{s.value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
