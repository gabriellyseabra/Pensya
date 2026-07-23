import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PensyaClinicaLogo } from "@/components/shared/BrandLogos";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Convidado para uma clínica existente não deve criar uma nova.
    const convite =
      typeof window !== "undefined" ? localStorage.getItem("pensya-convite-pendente") : null;
    if (convite) throw redirect({ to: "/equipe/convite/$token", params: { token: convite } });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("criar_organizacao", { _nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clínica criada com agenda e financeiro pré-configurados!", {
        description: "Siga os primeiros passos no painel para personalizar.",
      });
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-soft">
        <div className="mb-6 text-center">
          <PensyaClinicaLogo className="h-14 mx-auto" />
        </div>
        <div className="mb-6 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Vamos criar sua clínica</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            É o espaço onde ficam seus pacientes, agenda e dados — só sua equipe tem acesso.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) criar.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nome-clinica">Nome da clínica</Label>
            <Input
              id="nome-clinica"
              autoFocus
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como sua clínica é chamada"
            />
          </div>
          <Button type="submit" className="w-full" disabled={criar.isPending || !nome.trim()}>
            {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar minha clínica
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Sua clínica já vem com agenda, salas e financeiro pré-configurados —
          o painel mostra os primeiros passos para personalizar tudo.
        </p>
      </div>
    </div>
  );
}
