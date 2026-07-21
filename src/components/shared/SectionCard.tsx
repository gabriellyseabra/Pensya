import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  defaultOpen = true,
  collapsible = true,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={cn("glass overflow-hidden", className)}>
      <header
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/40 px-4 py-3",
          collapsible && "cursor-pointer hover:bg-accent/30 transition-colors",
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-brand" />}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
          {collapsible && (
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          )}
        </div>
      </header>
      {open && <div className="p-4">{children}</div>}
    </Card>
  );
}
