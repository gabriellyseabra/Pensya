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
  // Mesma lógica do guard de /_authenticated, para o login levar cada perfil
  // ao lugar certo: membro de clínica → sistema; admin da plataforma → sistema;
  // família com acesso ao portal → portal; senão (conta nova sem clínica) →
  // onboarding para criar a própria clínica.
  const { data: membro } = await supabase
    .from("organizacao_membros")
    .select("org_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (membro) return "/dashboard";

  const { data: pensyaAdmin } = await supabase.rpc("is_pensya_admin");
  if (pensyaAdmin) return "/dashboard";

  const { data: acessoPortal } = await supabase
    .from("portal_acessos")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (acessoPortal && acessoPortal.length > 0) return "/portal";

  return "/onboarding";
}

// Navega após login respeitando um convite de equipe pendente (quem foi
// convidado para uma clínica existente volta para a aceitação, não vai criar
// uma nova clínica no onboarding).
async function irParaDestino(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const dest = await destinoPosLogin(userId);
  const convite =
    typeof window !== "undefined" ? localStorage.getItem("pensya-convite-pendente") : null;
  if (dest === "/onboarding" && convite) {
    navigate({ to: "/equipe/convite/$token", params: { token: convite }, replace: true });
    return;
  }
  navigate({ to: dest, replace: true });
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await irParaDestino(navigate, data.session.user.id);
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    await irParaDestino(navigate, data.user.id);
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
