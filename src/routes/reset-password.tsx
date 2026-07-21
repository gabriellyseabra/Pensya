import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha definida com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-soft">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand text-brand-foreground shadow-soft">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Definir nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready ? "Escolha uma senha para acessar sua conta." : "Abrindo o link de recuperação..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
            />
          </div>
          <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={!ready || loading}>
            Salvar senha
          </Button>
        </form>
      </div>
    </div>
  );
}
