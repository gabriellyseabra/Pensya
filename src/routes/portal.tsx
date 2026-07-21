import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, LineChart, NotebookPen, Wallet, LogOut, FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { portalMeusPacientes, portalRelatoriosDisponiveis, relatorioVisto } from "@/lib/portal.functions";
import { PortalProvider, usePortal, primeiroNome } from "@/components/portal/portal-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PensyaClinicaLogo, PensyaClinicaBadge } from "@/components/shared/BrandLogos";

export const Route = createFileRoute("/portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: PortalLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/portal", label: "Início", icon: Home, exact: true },
  { to: "/portal/evolucao", label: "Evolução", icon: LineChart },
  { to: "/portal/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/portal/diario", label: "Diário", icon: NotebookPen },
  { to: "/portal/financeiro", label: "Financeiro", icon: Wallet },
];

function PortalLayout() {
  const navigate = useNavigate();

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ["portal-meus-pacientes"],
    queryFn: portalMeusPacientes,
  });

  const { data: contaInfo } = useQuery({
    queryKey: ["portal-conta-info"],
    enabled: !isLoading && (pacientes ?? []).length === 0,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { isEquipe: false, email: null as string | null };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { isEquipe: (data ?? []).length > 0, email: u.user.email ?? null };
    },
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!pacientes || pacientes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center shadow-soft">
          <PensyaClinicaLogo className="h-16" />
          <h1 className="mt-4 font-display text-xl font-semibold">Portal da Família</h1>
          {contaInfo?.isEquipe ? (
            <p className="mt-3 text-sm text-muted-foreground">
              A conta <strong>{contaInfo.email}</strong> é da equipe da clínica e não está
              vinculada a nenhum paciente no portal da família. Se você quer testar o
              portal, gere um convite (Paciente → Administrativo → Portal) e abra o
              link com uma conta diferente — ou clique abaixo para ir ao sistema.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Sua conta ainda não está vinculada a nenhum paciente. Peça à clínica um
              link de convite e abra-o com esta conta para liberar o acesso.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {contaInfo?.isEquipe && (
              <Button className="gradient-brand text-brand-foreground" onClick={() => navigate({ to: "/dashboard", replace: true })}>
                Ir para o sistema
              </Button>
            )}
            <Button variant="outline" onClick={sair}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PortalProvider pacientes={pacientes}>
      <PortalChrome onSair={sair}>
        <Outlet />
      </PortalChrome>
    </PortalProvider>
  );
}

function PortalChrome({ children, onSair }: { children: React.ReactNode; onSair: () => void }) {
  const { pacientes, paciente, setPacienteId } = usePortal();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Aviso de novo relatório mensal disponível
  const { data: mesesRelatorio } = useQuery({
    queryKey: ["portal-relatorios-meses", paciente.paciente_id],
    queryFn: () => portalRelatoriosDisponiveis(paciente.paciente_id),
    staleTime: 10 * 60_000,
  });
  const ultimoRelatorio = mesesRelatorio?.[0] ?? null;
  const relatorioNovo = !!ultimoRelatorio && relatorioVisto(paciente.paciente_id) !== ultimoRelatorio
    && pathname !== "/portal/relatorios";

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <PensyaClinicaBadge />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Portal da Família</p>
            {pacientes.length > 1 ? (
              <Select value={paciente.paciente_id} onValueChange={setPacienteId}>
                <SelectTrigger className="h-8 w-full max-w-[220px] border-none bg-transparent px-0 font-display text-base font-semibold shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((p) => (
                    <SelectItem key={p.paciente_id} value={p.paciente_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate font-display text-base font-semibold">{paciente.nome}</p>
            )}
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                {...item}
                pathname={pathname}
                dot={item.to === "/portal/relatorios" && relatorioNovo}
              />
            ))}
          </nav>
          <Button variant="ghost" size="icon" onClick={onSair} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      {/* Navegação inferior no celular */}
      <nav className="glass-strong fixed inset-x-0 bottom-0 z-30 border-t border-border/60 md:hidden">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                  active ? "text-brand font-medium" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.to === "/portal/relatorios" && relatorioNovo && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-yellow" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavLink({ to, label, exact, pathname, dot }: { to: string; label: string; exact?: boolean; pathname: string; dot?: boolean }) {
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "relative rounded-full px-3 py-1.5 text-sm transition-colors",
        active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {dot && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-yellow" />}
    </Link>
  );
}
