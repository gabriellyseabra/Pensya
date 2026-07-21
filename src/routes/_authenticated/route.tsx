import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Usuários sem papel de equipe (família/paciente) usam o portal
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (!roles || roles.length === 0) throw redirect({ to: "/portal" });
    return { user: data.user };
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
