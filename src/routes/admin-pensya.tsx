import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, LogOut, ShieldCheck, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatTile } from "@/components/shared/panels";

export const Route = createFileRoute("/admin-pensya")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("is_pensya_admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPensyaPage,
});

type OrgRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  plano: string;
  status: string;
  created_at: string | null;
  membros: number;
};

async function fetchOrganizacoes(): Promise<OrgRow[]> {
  const [{ data: orgs, error }, { data: membros }] = await Promise.all([
    supabase
      .from("organizacoes")
      .select("id, nome, cnpj, plano, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("organizacao_membros").select("org_id").eq("ativo", true),
  ]);
  if (error) throw error;
  return (orgs ?? []).map((o) => ({
    ...o,
    membros: (membros ?? []).filter((m) => m.org_id === o.id).length,
  }));
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativa",
  trial: "Trial",
  suspenso: "Suspensa",
  cancelado: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ativo: "default",
  trial: "secondary",
  suspenso: "destructive",
  cancelado: "outline",
};

function AdminPensyaPage() {
  const navigate = useNavigate();

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["admin-pensya-organizacoes"],
    queryFn: fetchOrganizacoes,
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const total = orgs?.length ?? 0;
  const ativas = (orgs ?? []).filter((o) => o.status === "ativo").length;
  const totalMembros = (orgs ?? []).reduce((acc, o) => acc + o.membros, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/pensya-logo.svg" alt="Pensya" className="h-8 w-auto object-contain" />
            <span className="flex items-center gap-1 rounded-full bg-lilac-soft px-2.5 py-1 text-xs font-medium text-lilac-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Administração do sistema
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clínicas no Pensya</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão geral de todas as clínicas cadastradas na plataforma.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile icon={Building2} value={total} label="Clínicas" />
          <StatTile icon={CircleDot} value={ativas} label="Ativas" />
          <StatTile icon={Users} value={totalMembros} label="Membros de equipe" />
        </div>

        <div className="soft-card overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clínica</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && total === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhuma clínica cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {(orgs ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{o.cnpj || "—"}</TableCell>
                  <TableCell className="capitalize">{o.plano}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.membros}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
