import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Target, FileText, CalendarCheck, TrendingUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegação da ficha do paciente: 5 áreas em vez de 10 abas.
 * A área "Clínico" agrupa o fluxo terapêutico em subabas (capítulos).
 */
export const AREAS = [
  { key: "resumo", label: "Resumo" },
  { key: "cadastro", label: "Cadastro" },
  { key: "clinico", label: "Clínico" },
  { key: "administrativo", label: "Administrativo" },
  { key: "arquivos", label: "Arquivos" },
] as const;

export const SUBS_CLINICO = [
  { key: "avaliacao", label: "Avaliação", icon: ClipboardList, desc: "Anamnese, testagem e raciocínio clínico" },
  { key: "plano", label: "Plano", icon: Target, desc: "Plano terapêutico com metas SMART e GAS" },
  { key: "sessoes", label: "Sessões", icon: FileText, desc: "Registro de cada atendimento — o prontuário" },
  { key: "frequencia", label: "Frequência", icon: CalendarCheck, desc: "Presenças, faltas e reposições" },
  { key: "monitoramento", label: "Monitoramento", icon: TrendingUp, desc: "Evolução das metas e dos domínios cognitivos" },
  { key: "perfil", label: "Perfil", icon: Sparkles, desc: "Perfil clínico vivo: o que funciona com este paciente" },
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
        <div className="space-y-1.5">
          {/* Capítulos do fluxo clínico — destaque maior que pills */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SUBS_CLINICO.map((s) => {
              const Icone = s.icon;
              const ativo = sub === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onNavigate("clinico", s.key)}
                  className={cn(
                    "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-medium transition",
                    ativo
                      ? "border-transparent bg-foreground text-background shadow-sm"
                      : "bg-background/60 text-muted-foreground hover:border-brand/40 hover:text-foreground",
                  )}
                >
                  <Icone className="h-4 w-4" />
                  <span className="leading-none">{s.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {SUBS_CLINICO.find((s) => s.key === sub)?.desc}
          </p>
        </div>
      )}
    </div>
  );
}
