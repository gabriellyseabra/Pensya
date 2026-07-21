import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, User as UserIcon, ChevronDown, Camera, Loader2, Eye, Undo2 } from "lucide-react";
import { useRoles, setPreviewRole } from "@/hooks/use-role";

function iniciais(nome: string, email: string) {
  return (nome || email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu() {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const { realIsAdmin, previewing } = useRoles();

  const { data: me } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return { id: user.id, email: user.email ?? "", nome: data?.nome ?? "", avatar_url: data?.avatar_url ?? null };
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nome = me?.nome || "Usuário";
  const email = me?.email ?? "";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-accent">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt={nome} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center gradient-brand text-sm font-semibold text-brand-foreground">
                  {iniciais(nome, email)}
                </span>
              )}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">{nome}</span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{nome}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <UserIcon className="mr-2 h-4 w-4" />
            Meu perfil
          </DropdownMenuItem>
          {realIsAdmin &&
            (previewing ? (
              <DropdownMenuItem
                onClick={() => {
                  setPreviewRole(null);
                  navigate({ to: "/dashboard" });
                }}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Voltar para visão de admin
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setPreviewRole("profissional");
                  navigate({ to: "/agenda" });
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver como terapeuta
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {me && (
        <MeuPerfilDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          userId={me.id}
          nomeInicial={me.nome}
          avatarInicial={me.avatar_url}
        />
      )}
    </>
  );
}

function MeuPerfilDialog({
  open, onOpenChange, userId, nomeInicial, avatarInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  nomeInicial: string;
  avatarInicial: string | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(nomeInicial);
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarInicial);
  const [saving, setSaving] = useState(false);

  function escolher(f?: File | null) {
    if (!f) return;
    setFoto(f);
    setPreview(URL.createObjectURL(f));
  }

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe seu nome");
    setSaving(true);
    try {
      const patch: { nome: string; avatar_url?: string } = { nome: nome.trim() };
      if (foto) {
        const ext = foto.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, foto, { upsert: true });
        if (upErr) throw upErr;
        patch.avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["meu-perfil"] });
      await qc.invalidateQueries({ queryKey: ["equipe"] });
      toast.success("Perfil atualizado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-7 w-7" />
            )}
            <span className="absolute bottom-0 w-full bg-black/40 py-0.5 text-center text-[10px] text-white">
              Alterar
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <div className="w-full space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
