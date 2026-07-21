import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Já pertence a uma clínica (papel dentro de organizacao_membros)? Segue normal.
    const { data: membro } = await supabase
      .from("organizacao_membros")
      .select("org_id")
      .eq("user_id", data.user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (membro) return { user: data.user };

    // Administradora da plataforma Pensya (sem clínica própria): vai pro painel dela.
    const { data: pensyaAdmin } = await supabase.rpc("is_pensya_admin");
    if (pensyaAdmin) throw redirect({ to: "/admin-pensya" });

    // Sem organização e sem papel de plataforma: família (portal) ou
    // cadastro novo que ainda não criou/entrou numa clínica.
    const { data: acessoPortal } = await supabase
      .from("portal_acessos")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1);
    if (acessoPortal && acessoPortal.length > 0) throw redirect({ to: "/portal" });

    throw redirect({ to: "/onboarding" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
