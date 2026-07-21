import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

/** Equipe (admin/profissional/secretaria) vai para o sistema; sem papel, vai para o portal da família. */
async function destinoPosLogin(userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return roles && roles.length > 0 ? "/dashboard" : "/portal";
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) navigate({ to: await destinoPosLogin(data.session.user.id), replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: await destinoPosLogin(data.user.id), replace: true });
  }

  async function handleForgotPassword() {
    if (!email) return toast.error("Informe seu email no campo acima primeiro.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link para definir sua senha. Confira seu email.");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email para confirmar.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-soft">
        <div className="mb-8 text-center">
          <img src="/pensya-logo.svg" alt="Pensya" className="mx-auto h-24 w-auto object-contain" />
          <p className="mt-2 text-sm text-muted-foreground">Acesse o sistema do consultório</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading}>
                Entrar
              </Button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Esqueci minha senha / definir senha
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-s">Email</Label>
                <Input id="email-s" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-s">Senha</Label>
                <Input id="password-s" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading}>
                Criar conta
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Esta tela é para a equipe da clínica. Se você é família ou paciente,
                use o link de convite que a clínica te enviou.
              </p>
            </form>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
