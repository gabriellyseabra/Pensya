import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "info" | "success" | "warning" | "danger";

const severityClasses: Record<Severity, string> = {
  info: "border-l-brand",
  success: "border-l-emerald-500",
  warning: "border-l-brand-yellow",
  danger: "border-l-destructive",
};

export interface SmartCardProps {
  title: string;
  icon?: LucideIcon;
  severity?: Severity;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SmartCard({ title, icon: Icon = Sparkles, severity = "info", children, action, className }: SmartCardProps) {
  return (
    <Card className={cn("glass border-l-4", severityClasses[severity], className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-brand" />
            {title}
          </span>
          {action}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}
