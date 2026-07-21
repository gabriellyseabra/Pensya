import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "secondary" | "warning" | "accent" | "success" | "danger";

const toneClasses: Record<Tone, string> = {
  brand: "gradient-brand text-white",
  secondary: "bg-secondary text-foreground",
  warning: "bg-brand-yellow/40 text-foreground",
  accent: "bg-accent-soft/50 text-foreground",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  danger: "bg-destructive/15 text-destructive",
};

export interface KPIDelta {
  /** Variação vs período anterior. Ex: 12 → "+12%", -5 → "−5%". */
  value: number;
  /** Sufixo do número (padrão "%"). Use "pp" para pontos percentuais, "" para absoluto. */
  suffix?: string;
  /** Nome do período de comparação. Ex: "vs semana anterior". */
  label: string;
  /** Se subir é bom (padrão true). Para inadimplência/atrasos, use false. */
  upIsGood?: boolean;
}

export interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Formata o número durante a animação de contagem (ex: moeda, "%"). */
  format?: (n: number) => string;
  hint?: React.ReactNode;
  delta?: KPIDelta;
  /** Série curta (ex: últimos 6 meses) desenhada como sparkline. */
  spark?: number[];
  tone?: Tone;
  onClick?: () => void;
  className?: string;
  /** Atraso da animação de entrada, em ms (stagger). */
  delay?: number;
}

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVal(target);
      return;
    }
    // Anima na primeira renderização; depois acompanha o alvo sem reanimar do zero
    if (started.current) {
      setVal(target);
      return;
    }
    started.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function AnimatedValue({ value, format }: { value: number; format?: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format ? format(v) : Math.round(v).toLocaleString("pt-BR")}</>;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 76,
    h = 30,
    pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map(
    (v, i) =>
      [
        pad + (i * (w - pad * 2)) / (data.length - 1),
        h - pad - ((v - min) / range) * (h - pad * 2),
      ] as const,
  );
  const dLine = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const dArea = `${dLine} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <path d={dArea} fill="var(--brand)" opacity={0.1} />
      <path
        d={dLine}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}

function DeltaChip({ delta }: { delta: KPIDelta }) {
  const dir = delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat";
  const good = delta.upIsGood === false ? delta.value <= 0 : delta.value >= 0;
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const suffix = delta.suffix ?? "%";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
        dir === "flat"
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-destructive/10 text-destructive",
      )}
      title={delta.label}
    >
      <Icon className="h-3 w-3" />
      {delta.value > 0 ? "+" : ""}
      {delta.value}
      {suffix}
      <span className="font-normal opacity-70 hidden sm:inline">{delta.label}</span>
    </span>
  );
}

export function KPICard({
  icon: Icon,
  label,
  value,
  format,
  hint,
  delta,
  spark,
  tone = "brand",
  onClick,
  className,
  delay,
}: KPICardProps) {
  return (
    <Card
      className={cn("glass card-lift animate-fade-up", onClick && "cursor-pointer", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shadow-soft shrink-0",
              toneClasses[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold leading-none">
            {typeof value === "number" ? <AnimatedValue value={value} format={format} /> : value}
          </p>
          {spark && spark.length > 1 && <Sparkline data={spark} />}
        </div>
        {(delta || hint) && (
          <div className="flex items-center gap-2 text-[11px] min-h-4">
            {delta && <DeltaChip delta={delta} />}
            {hint && <span className="text-muted-foreground truncate">{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
