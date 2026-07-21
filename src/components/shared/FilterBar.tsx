import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilterBar({
  search,
  onSearchChange,
  placeholder = "Buscar…",
  children,
  onClear,
  className,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("glass flex flex-wrap items-center gap-2 rounded-xl border border-border/40 p-2", className)}>
      {onSearchChange && (
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
      )}
      {children}
      {onClear && (
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="mr-1 h-3 w-3" />
          Limpar
        </Button>
      )}
    </div>
  );
}
