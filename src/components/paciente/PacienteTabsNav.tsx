import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Navegação da ficha do paciente: 5 áreas em vez de 10 abas.
 * A área "Clínico" agrupa o fluxo terapêutico em subabas.
 */
export const AREAS = [
  { key: "resumo", label: "Resumo" },
  { key: "cadastro", label: "Cadastro" },
  { key: "clinico", label: "Clínico" },
  { key: "administrativo", label: "Administrativo" },
  { key: "arquivos", label: "Arquivos" },
] as const;

export const SUBS_CLINICO = [
  { key: "avaliacao", label: "Avaliação" },
  { key: "plano", label: "Plano" },
  { key: "sessoes", label: "Sessões" },
  { key: "frequencia", label: "Frequência" },
  { key: "monitoramento", label: "Monitoramento" },
  { key: "perfil", label: "Perfil" },
] as const;

/** Converte valores antigos de aba (links/urls legados) para o novo par área+sub. */
export function resolverAba(aba?: string | null, sub?: string | null): { aba: string; sub?: string } {
  const legado: Record<string, { aba: string; sub?: string }> = {
    ficha: { aba: "cadastro" },
    "perfil-vivo": { aba: "clinico", sub: "perfil" },
    avaliacao: { aba: "clinico", sub: "avaliacao" },
    plano: { aba: "clinico", sub: "plano" },
    sessoes: { aba: "clinico", sub: "sessoes" },
    frequencia: { aba: "clinico", sub: "frequencia" },
    monitoramento: { aba: "clinico", sub: "monitoramento" },
  };
  if (aba && legado[aba]) return legado[aba];
  if (aba && AREAS.some((a) => a.key === aba)) {
    if (aba === "clinico") {
      const s = sub && SUBS_CLINICO.some((x) => x.key === sub) ? sub : "avaliacao";
      return { aba, sub: s };
    }
    return { aba };
  }
  return { aba: "resumo" };
}

export function PacienteTabsNav({
  aba,
  sub,
  onNavigate,
  hideAdministrativo,
}: {
  aba: string;
  sub?: string;
  onNavigate: (aba: string, sub?: string) => void;
  hideAdministrativo?: boolean;
}) {
  const areas = AREAS.filter((a) => !(hideAdministrativo && a.key === "administrativo"));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto no-scrollbar">
        <TabsList className="h-auto flex-nowrap gap-1 rounded-full bg-muted/70 p-1">
          {areas.map((a) => (
            <TabsTrigger
              key={a.key}
              value={a.key}
              onClick={() => onNavigate(a.key, a.key === "clinico" ? (sub ?? "avaliacao") : undefined)}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
            >
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {aba === "clinico" && (
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex w-fit flex-nowrap gap-1 rounded-full bg-muted/40 p-1">
            {SUBS_CLINICO.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onNavigate("clinico", s.key)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition",
                  sub === s.key
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
