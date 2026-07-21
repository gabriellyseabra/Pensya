import { Sparkles, LucideIcon } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";

export function ComingSoon({
  title,
  description,
  icon: Icon = Sparkles,
  fase,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  fase?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHero icon={Icon} eyebrow="Em breve" title={title} description={description} />

      <div className="animate-fade-up soft-card card-lift relative overflow-hidden" style={{ animationDelay: "120ms" }}>
        <div className="gradient-lilac pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-30 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-white shadow-soft">
            <Icon className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-display">Em construção</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Este módulo faz parte da reestruturação Nave Clínica 2.0.
              {fase && ` Será entregue na ${fase}.`}
            </p>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-lilac"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
