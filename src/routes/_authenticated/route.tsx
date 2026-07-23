import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Já pertence a uma clínica (papel dentro de organizacao_membros)? Segue normal.
    const { data: membro } = await supabase
      .from("organizacao_membros")
      .select("org_id, papel")
      .eq("user_id", data.user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (membro) {
      // Terapeuta (papel "profissional") tem acesso restrito: só dashboard,
      // agenda, pacientes e tarefas. Bloqueia o resto (financeiro, gestão,
      // configurações, equipe) mesmo por URL direta.
      if (membro.papel === "profissional") {
        const permitidos = [
          "/dashboard",
          "/agenda",
          "/pacientes",
          "/tarefas",
          "/meu-financeiro",
          "/central-de-ajuda",
        ];
        const liberado = permitidos.some(
          (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
        );
        if (!liberado) throw redirect({ to: "/dashboard" });
      }
      return { user: data.user };
    }

    // Administradora da plataforma Pensya: com visão de clínica ativa navega
    // o sistema escopado àquela clínica; sem visão, vai pro painel de gestão.
    const { data: pensyaAdmin } = await supabase.rpc("is_pensya_admin");
    if (pensyaAdmin) {
      const { data: visaoOrg } = await supabase.rpc("my_org_id");
      if (visaoOrg) return { user: data.user };
      throw redirect({ to: "/admin-pensya" });
    }

    // Sem organização e sem papel de plataforma: família (portal) ou
    // cadastro novo que ainda não criou/entrou numa clínica.
    const { data: acessoPortal } = await supabase
      .from("portal_acessos")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1);
    if (acessoPortal && acessoPortal.length > 0) throw redirect({ to: "/portal" });

    // Tem um convite de equipe pendente? Volta para a aceitação (a pessoa foi
    // convidada para uma clínica existente, não deve criar uma nova).
    const convitePendente =
      typeof window !== "undefined" ? localStorage.getItem("pensya-convite-pendente") : null;
    if (convitePendente) {
      throw redirect({ to: "/equipe/convite/$token", params: { token: convitePendente } });
    }

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
