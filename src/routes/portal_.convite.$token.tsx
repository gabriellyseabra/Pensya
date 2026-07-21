import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HeartHandshake, LogIn, TriangleAlert, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { portalAceitarConvite, portalConviteInfo } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/portal_/convite/$token")({
  ssr: false,
  component: ConvitePage,
});

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
  }, []);

  const { data: info, isLoading } = useQuery({
    queryKey: ["portal-convite", token],
    queryFn: () => portalConviteInfo(token),
  });

  const { data: contaEquipe } = useQuery({
    queryKey: ["portal-convite-conta-equipe", sessionEmail],
    enabled: !!sessionEmail,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).length > 0;
    },
  });

  const aceitar = useMutation({
    mutationFn: () => portalAceitarConvite(token),
    onSuccess: () => {
      toast.success("Acesso liberado! Bem-vindo(a) ao portal.");
      navigate({ to: "/portal", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    aceitar.mutate();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal/convite/${token}`,
        data: { nome },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      aceitar.mutate();
    } else {
      setAguardandoConfirmacao(true);
    }
  }

  async function trocarConta() {
    await supabase.auth.signOut();
    setSessionEmail(null);
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-soft">
        <div className="mb-6 text-center">
          <img src="/logo-nave.png" alt="Nave" className="mx-auto h-12 w-auto object-contain" />
          <h1 className="mt-3 font-display text-xl font-semibold">Portal da Família</h1>
        </div>
        {children}
      </div>
    </div>
  );

  if (isLoading) return shell(<p className="text-center text-sm text-muted-foreground">Verificando convite…</p>);

  if (!info || !info.valido) {
    return shell(
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {info?.usado
            ? "Este convite já foi utilizado. Se você já criou sua conta, entre pelo login normal."
            : info?.expirado
              ? "Este convite expirou. Peça um novo link para a clínica."
              : "Convite inválido. Confira o link ou peça um novo para a clínica."}
        </p>
        <Button className="mt-5" variant="outline" onClick={() => navigate({ to: "/auth" })}>
          Ir para o login
        </Button>
      </div>,
    );
  }

  if (aguardandoConfirmacao) {
    return shell(
      <p className="text-center text-sm text-muted-foreground">
        Conta criada! Confirme seu email e depois abra este mesmo link de convite
        novamente para liberar o acesso.
      </p>,
    );
  }

  return shell(
    <div className="space-y-5">
      <div className="rounded-2xl bg-accent/60 p-4 text-center">
        <HeartHandshake className="mx-auto h-7 w-7 text-brand" />
        <p className="mt-2 text-sm">
          {info.nome_convidado ? <strong>{info.nome_convidado}</strong> : "Você"} foi
          convidado(a) para acompanhar a evolução de{" "}
          <strong>{info.paciente_nome}</strong> no portal da clínica.
        </p>
      </div>

      {sessionEmail ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            Você está logado como <strong>{sessionEmail}</strong>.
          </p>
          {contaEquipe && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-left text-xs text-amber-800 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Esta é uma conta da <strong>equipe da clínica</strong>. Se aceitar, ela também passará a
                acessar o portal da família deste paciente. Para testar como uma família de verdade,
                use "Usar outra conta" e crie um acesso separado.
              </p>
            </div>
          )}
          <Button
            className="w-full gradient-brand text-brand-foreground"
            disabled={aceitar.isPending}
            onClick={() => aceitar.mutate()}
          >
            Aceitar convite com esta conta
          </Button>
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={trocarConta}
          >
            Usar outra conta
          </button>
        </div>
      ) : (
        <Tabs defaultValue="signup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Criar conta
            </TabsTrigger>
            <TabsTrigger value="login">
              <LogIn className="mr-1.5 h-3.5 w-3.5" /> Já tenho conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Seu nome</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-s">Email</Label>
                <Input id="email-s" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-s">Senha</Label>
                <Input id="password-s" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading || aceitar.isPending}>
                Criar conta e acessar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-l">Email</Label>
                <Input id="email-l" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-l">Senha</Label>
                <Input id="password-l" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-brand text-brand-foreground" disabled={loading || aceitar.isPending}>
                Entrar e acessar
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </div>,
  );
}
