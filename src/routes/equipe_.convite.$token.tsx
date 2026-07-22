import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LogIn, UserPlus, Camera, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { equipeConviteInfo, equipeAceitarConvite } from "@/lib/equipe.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/equipe_/convite/$token")({
  ssr: false,
  component: ConviteEquipePage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  profissional: "Terapeuta",
  secretaria: "Secretaria",
};

async function uploadFoto(file: File): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

function ConviteEquipePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    // Guarda o convite pendente: se o cadastro passar por confirmação de e-mail
    // e o usuário voltar pela raiz do app, o roteamento o traz de volta para cá
    // (em vez de mandá-lo criar uma clínica no onboarding).
    if (typeof window !== "undefined" && token) {
      localStorage.setItem("pensya-convite-pendente", token);
    }
  }, [token]);

  const { data: info, isLoading } = useQuery({
    queryKey: ["equipe-convite", token],
    queryFn: () => equipeConviteInfo(token),
  });

  // Convite inválido/expirado/usado não deve prender o usuário: limpa o
  // marcador para que ele possa seguir o fluxo normal (login/onboarding).
  useEffect(() => {
    if (info && !info.valido && typeof window !== "undefined") {
      localStorage.removeItem("pensya-convite-pendente");
    }
  }, [info]);

  function escolherFoto(f?: File | null) {
    if (!f) return;
    setFoto(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  // Finaliza: sobe a foto, atualiza o perfil e aceita o convite
  const finalizar = useMutation({
    mutationFn: async () => {
      if (foto) {
        const url = await uploadFoto(foto);
        if (url) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
        }
      }
      await equipeAceitarConvite(token);
    },
    onSuccess: () => {
      if (typeof window !== "undefined") localStorage.removeItem("pensya-convite-pendente");
      toast.success("Acesso liberado! Bem-vindo(a) à equipe.");
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    finalizar.mutate();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/equipe/convite/${token}`,
        data: { nome },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) finalizar.mutate();
    else setAguardandoConfirmacao(true);
  }

  async function trocarConta() {
    await supabase.auth.signOut();
    setSessionEmail(null);
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="soft-card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <img src="/pensya-logo.svg" alt="Pensya" className="mx-auto h-16 w-auto object-contain" />
          <h1 className="mt-3 font-display text-xl font-semibold">Acesso da equipe</h1>
        </div>
        {children}
      </div>
    </div>
  );

  if (isLoading)
    return shell(<p className="text-center text-sm text-muted-foreground">Verificando convite…</p>);

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
        Conta criada! Confirme seu e-mail e depois abra este mesmo link novamente para liberar o
        acesso.
      </p>,
    );
  }

  const fotoField = (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted"
      >
        {fotoPreview ? (
          <img src={fotoPreview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </button>
      <span className="text-xs text-muted-foreground">Sua foto de perfil</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => escolherFoto(e.target.files?.[0])}
      />
    </div>
  );

  return shell(
    <div className="space-y-5">
      <div className="rounded-2xl bg-accent/60 p-4 text-center">
        <ShieldCheck className="mx-auto h-7 w-7 text-brand" />
        <p className="mt-2 text-sm">
          {info.nome ? <strong>{info.nome}</strong> : "Você"} foi convidado(a) para a equipe como{" "}
          <strong>{ROLE_LABEL[info.role ?? ""] ?? info.role}</strong>.
        </p>
      </div>

      {sessionEmail ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Você está logado como <strong>{sessionEmail}</strong>.
          </p>
          {fotoField}
          <Button
            className="w-full"
            disabled={finalizar.isPending}
            onClick={() => finalizar.mutate()}
          >
            {finalizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Concluir e acessar
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
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Criar acesso
            </TabsTrigger>
            <TabsTrigger value="login">
              <LogIn className="mr-1.5 h-3.5 w-3.5" /> Já tenho conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-3 pt-3">
              {fotoField}
              <div className="space-y-1.5">
                <Label htmlFor="nome">Seu nome</Label>
                <Input
                  id="nome"
                  required
                  value={nome || info.nome || ""}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-s">E-mail</Label>
                <Input
                  id="email-s"
                  type="email"
                  required
                  value={email || info.email || ""}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-s">Crie uma senha</Label>
                <Input
                  id="password-s"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || finalizar.isPending}>
                {(loading || finalizar.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar acesso
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3 pt-3">
              {fotoField}
              <div className="space-y-1.5">
                <Label htmlFor="email-l">E-mail</Label>
                <Input
                  id="email-l"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-l">Senha</Label>
                <Input
                  id="password-l"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || finalizar.isPending}>
                {(loading || finalizar.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Entrar e acessar
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </div>,
  );
}
