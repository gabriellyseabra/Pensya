import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { QuickSearch } from "@/components/quick-search";
import { GlobalFAB } from "@/components/shared/GlobalFAB";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRoles, setPreviewRole } from "@/hooks/use-role";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisaoAdmin, getMinhaOrganizacao, aplicarCorTema } from "@/lib/clinica-config";

function PreviewBanner() {
  const { previewing } = useRoles();
  const navigate = useNavigate();
  if (!previewing) return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-full bg-brand px-4 py-2 text-sm text-brand-foreground shadow-[var(--shadow-soft)]">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Você está vendo o sistema como <strong>Terapeuta</strong> (pré-visualização)
      </span>
      <button
        onClick={() => {
          setPreviewRole(null);
          navigate({ to: "/dashboard" });
        }}
        className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium hover:bg-white/30"
      >
        Sair da visualização
      </button>
    </div>
  );
}

function AdminVisaoBanner() {
  const { data: visao } = useQuery({
    queryKey: ["admin-visao-clinica"],
    queryFn: getVisaoAdmin,
    staleTime: 5 * 60_000,
  });
  if (!visao) return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-full bg-rail px-4 py-2 text-sm text-rail-foreground shadow-[var(--shadow-soft)]">
      <span className="flex min-w-0 items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Administração Pensya — você está dentro da clínica <strong>{visao.nome}</strong>
        </span>
      </span>
      <button
        onClick={async () => {
          await supabase.rpc("admin_sair_clinica");
          window.location.href = "/admin-pensya";
        }}
        className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
      >
        Voltar ao painel Pensya
      </button>
    </div>
  );
}

function useCorTemaClinica() {
  const { data: org } = useQuery({
    queryKey: ["minha-organizacao"],
    queryFn: getMinhaOrganizacao,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    aplicarCorTema(org?.cor_tema);
    return () => aplicarCorTema(null);
  }, [org?.cor_tema]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useCorTemaClinica();
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full gap-4 p-3 md:p-4">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 mb-4 flex h-16 items-center gap-3 rounded-full bg-card/80 px-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <MobileNav />
            <Link to="/dashboard" className="flex shrink-0 items-center pl-1">
              <img
                src="/pensya-logo-horizontal.svg"
                alt="Pensya"
                className="h-8 w-auto object-contain"
              />
            </Link>
            <div className="mx-1 hidden h-6 w-px bg-border md:block" />
            <div className="min-w-0 flex-1 max-w-md">
              <QuickSearch />
            </div>
            <div className="ml-auto">
              <UserMenu />
            </div>
          </header>
          <AdminVisaoBanner />
          <PreviewBanner />
          <main className="flex-1">{children}</main>
        </div>
        <GlobalFAB />
      </div>
    </TooltipProvider>
  );
}
