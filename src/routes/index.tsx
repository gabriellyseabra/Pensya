import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
    return () => { mounted = false; };
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground text-sm">Carregando…</div>
    </div>
  );
}
