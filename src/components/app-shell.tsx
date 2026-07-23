import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, ShieldCheck, LifeBuoy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { QuickSearch } from "@/components/quick-search";
import { GlobalFAB } from "@/components/shared/GlobalFAB";
import { TourProvider } from "@/components/shared/TourGuiado";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRoles, setPreviewRole } from "@/hooks/use-role";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getVisaoAdmin,
  getMinhaOrganizacao,
  aplicarCorTema,
  clinicaLogoUrl,
  CORES_TEMA,
} from "@/lib/clinica-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  return org;
}

/** Troca rápida da cor do sistema, no topo — só para admins da clínica. */
function CorTemaSwitcher({ org }: { org: { id: string; cor_tema: string } | null | undefined }) {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();

  const trocar = useMutation({
    mutationFn: async (cor: string) => {
      if (!org?.id) throw new Error("Organização não encontrada");
      aplicarCorTema(cor);
      const { error } = await supabase
        .from("organizacoes")
        .update({ cor_tema: cor })
        .eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["minha-organizacao"] }),
    onError: (e: Error) => {
      aplicarCorTema(org?.cor_tema);
      toast.error(e.message);
    },
  });

  if (!isAdmin || !org) return null;
  const atual = CORES_TEMA.find((c) => c.valor === org.cor_tema) ?? CORES_TEMA[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
          title="Cor do sistema"
        >
          <span className="relative">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background"
              style={{ backgroundColor: atual.amostra }}
            />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Cor do sistema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CORES_TEMA.map((c) => (
          <DropdownMenuItem
            key={c.valor}
            onClick={() => trocar.mutate(c.valor)}
            className={cn("gap-2", org.cor_tema === c.valor && "font-medium")}
          >
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ backgroundColor: c.amostra }}
            />
            {c.nome}
            {org.cor_tema === c.valor && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const org = useCorTemaClinica();
  const clinicaLogoHeader = clinicaLogoUrl(org?.logo_path);
  return (
    <TooltipProvider delayDuration={200}>
      <TourProvider>
        <div className="flex min-h-screen w-full gap-4 p-3 md:p-4">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 mb-4 flex h-16 items-center gap-3 rounded-full bg-card/80 px-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <MobileNav />
              <Link to="/dashboard" className="flex shrink-0 items-center gap-3 pl-1">
                <img
                  src="/pensya-logo-horizontal.svg"
                  alt="Pensya"
                  className="h-8 w-auto object-contain"
                />
                {clinicaLogoHeader && (
                  <>
                    <span className="hidden h-7 w-px bg-border/80 sm:block" />
                    <img
                      src={clinicaLogoHeader}
                      alt="Logo da clínica"
                      className="hidden h-9 w-auto max-w-[8rem] object-contain sm:block"
                    />
                  </>
                )}
              </Link>
              <div className="mx-1 hidden h-6 w-px bg-border md:block" />
              <div className="min-w-0 flex-1 max-w-md">
                <QuickSearch />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Link
                  to="/central-de-ajuda"
                  title="Central de ajuda"
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
                >
                  <LifeBuoy className="h-5 w-5 text-muted-foreground" />
                </Link>
                <CorTemaSwitcher org={org} />
                <UserMenu />
              </div>
            </header>
            <AdminVisaoBanner />
            <PreviewBanner />
            <main className="flex-1">{children}</main>
          </div>
          <GlobalFAB />
        </div>
      </TourProvider>
    </TooltipProvider>
  );
}
