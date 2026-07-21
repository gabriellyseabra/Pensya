import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  User,
  Users,
  GraduationCap,
  Stethoscope,
  Sparkles,
  LayoutGrid,
  List,
  Archive,
} from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import {
  TwoColumn,
  PanelCard,
  BigStatCard,
  StatTile,
  NotifRow,
} from "@/components/shared/panels";
import { UserPlus, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { EscolaCombobox } from "@/components/shared/EscolaCombobox";
import { PacienteAcoesMenu } from "@/components/paciente/PacienteAcoesMenu";
import { ImportarPacientesDialog } from "@/components/paciente/ImportarPacientesDialog";
import { criarPacienteRapido } from "@/lib/cadastro.functions";
import { PACIENTE_STATUS_LABEL } from "@/lib/paciente-status";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/pacientes/")({
  component: PacientesPage,
});

type Layout = "grid" | "lista";

function PacientesPage() {
  const [search, setSearch] = useState("");
  const [filterModalidade, setFilterModalidade] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("ativo");
  const [filterTerapeuta, setFilterTerapeuta] = useState<string>("all");
  const [filterDiagnostico, setFilterDiagnostico] = useState<string>("all");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [layout, setLayout] = useState<Layout>("grid");
  const qc = useQueryClient();
  const { isTerapeutaRestrito } = useRoles();

  // Terapeuta restrito só enxerga os próprios pacientes (profissional_responsavel = ele)
  const { data: meuProfId } = useQuery({
    queryKey: ["meu-prof-id"],
    enabled: isTerapeutaRestrito,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profissionais_consultorio")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data?.id ?? null;
    },
  });
  const restringirPorProf = isTerapeutaRestrito ? (meuProfId ?? "__none__") : null;

  const { data: pacIdsPorDiagnostico } = useQuery({
    queryKey: ["pac-por-diag", filterDiagnostico],
    queryFn: async () => {
      if (filterDiagnostico === "all") return null;
      const { data } = await supabase
        .from("paciente_diagnosticos")
        .select("paciente_id")
        .eq("diagnostico_id", filterDiagnostico);
      return (data ?? []).map((r: any) => r.paciente_id);
    },
    enabled: filterDiagnostico !== "all",
  });

  const { data: pacientes } = useQuery({
    queryKey: [
      "pacientes",
      search,
      filterModalidade,
      filterStatus,
      filterTerapeuta,
      filterDiagnostico,
      mostrarArquivados,
      pacIdsPorDiagnostico,
      restringirPorProf,
    ],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select(
          `
          id, nome, data_nascimento, status, foto_url, hipotese_diagnostica, queixa_principal, arquivado, created_at,
          modalidade:modalidades!pacientes_modalidade_id_fkey(nome, cor),
          escola:escolas!pacientes_escola_id_fkey(nome),
          profissional_responsavel:profissionais_consultorio!pacientes_profissional_responsavel_id_fkey(nome, cor),
          paciente_diagnosticos(diagnostico:diagnosticos(nome))
        `,
        )
        .order("nome");
      if (!mostrarArquivados) q = q.eq("arquivado", false);
      if (search) q = q.ilike("nome", `%${search}%`);
      if (filterModalidade !== "all") q = q.eq("modalidade_id", filterModalidade);
      if (filterStatus !== "all" && !mostrarArquivados) q = q.eq("status", filterStatus);
      if (filterTerapeuta !== "all") q = q.eq("profissional_responsavel_id", filterTerapeuta);
      if (restringirPorProf) q = q.eq("profissional_responsavel_id", restringirPorProf);
      if (filterDiagnostico !== "all") {
        const ids = pacIdsPorDiagnostico ?? [];
        if (ids.length === 0) return [];
        q = q.in("id", ids);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: filterDiagnostico === "all" || pacIdsPorDiagnostico !== undefined,
  });

  const { data: modalidades } = useQuery({
    queryKey: ["modalidades"],
    queryFn: async () =>
      (await supabase.from("modalidades").select("id, nome").eq("ativo", true)).data ?? [],
  });
  const { data: terapeutas } = useQuery({
    queryKey: ["terapeutas-mini"],
    queryFn: async () =>
      (
        await supabase
          .from("profissionais_consultorio")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome")
      ).data ?? [],
  });
  const { data: diagnosticos } = useQuery({
    queryKey: ["diagnosticos-mini"],
    queryFn: async () =>
      (await supabase.from("diagnosticos").select("id, nome").order("nome")).data ?? [],
  });

  const stats = useMemo(() => {
    const list = pacientes ?? [];
    const comHipoteseList = list.filter(
      (p) => p.hipotese_diagnostica && !p.paciente_diagnosticos?.length,
    );
    const recentes = [...list]
      .sort((a: any, b: any) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 8);
    const modMap = new Map<string, number>();
    for (const p of list) {
      const nome = (p as any).modalidade?.nome ?? "Sem modalidade";
      modMap.set(nome, (modMap.get(nome) ?? 0) + 1);
    }
    const porModalidade = Array.from(modMap.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
    return {
      total: list.length,
      ativos: list.filter((p) => p.status === "ativo" && !p.arquivado).length,
      comDiagnostico: list.filter((p) => (p.paciente_diagnosticos?.length ?? 0) > 0).length,
      comHipotese: comHipoteseList.length,
      comHipoteseList,
      arquivados: list.filter((p) => p.arquivado).length,
      recentes,
      porModalidade,
    };
  }, [pacientes]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pacientes"] });

  return (
    <div className="space-y-5">
      <PageHero
        icon={Users}
        eyebrow="Cuidado clínico"
        title="Pacientes"
        description="Acompanhe cada história, diagnóstico e evolução — tudo em um só lugar."
        actions={
          <>
            <ImportarPacientesDialog onDone={invalidate} />
            <NovoPacienteDialog onCreated={invalidate} />
          </>
        }
      />

      <TwoColumn side={<PacientesSidePanel stats={stats} />}>
        {/* Visão modular — avatares recentes · ativos · distribuição */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className="animate-fade-up card-lift soft-card p-5"
            style={{ animationDelay: "60ms" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Novos pacientes</span>
              <UserPlus className="h-4 w-4 text-lilac" />
            </div>
            {stats.recentes.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhum paciente ainda.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {stats.recentes.map((p: any) => (
                  <Link
                    key={p.id}
                    to="/pacientes/$id"
                    params={{ id: p.id }}
                    className="flex w-14 shrink-0 flex-col items-center gap-1.5"
                    title={p.nome}
                  >
                    <Avatar foto={p.foto_url} nome={p.nome} size={48} />
                    <span className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground">
                      {p.nome.split(" ")[0]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <BigStatCard
            label="Pacientes ativos"
            value={stats.ativos}
            icon={Users}
            bars={stats.porModalidade.slice(0, 6).map((m) => ({ value: m.valor }))}
            hint={`${stats.total} no total nesta visão`}
            delay={120}
          />

          <div
            className="animate-fade-up card-lift soft-card p-5"
            style={{ animationDelay: "180ms" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Clínico</span>
              <Stethoscope className="h-4 w-4 text-lilac" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Stethoscope} value={stats.comDiagnostico} label="Com diagnóstico" />
              <StatTile icon={Sparkles} value={stats.comHipotese} label="Em hipótese" />
            </div>
          </div>
        </div>

        <Card className="glass p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus} disabled={mostrarArquivados}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="pausado">Pausados</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="interrompido">Interrompidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterModalidade} onValueChange={setFilterModalidade}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas modalidades</SelectItem>
              {modalidades?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTerapeuta} onValueChange={setFilterTerapeuta}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Terapeuta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos terapeutas</SelectItem>
              {terapeutas?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDiagnostico} onValueChange={setFilterDiagnostico}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Diagnóstico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos diagnósticos</SelectItem>
              {diagnosticos?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={mostrarArquivados ? "default" : "outline"}
            size="sm"
            onClick={() => setMostrarArquivados((v) => !v)}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {mostrarArquivados ? "Ocultar arquivados" : "Ver arquivados"}
          </Button>
          {(filterModalidade !== "all" ||
            filterTerapeuta !== "all" ||
            filterDiagnostico !== "all" ||
            filterStatus !== "ativo" ||
            search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterModalidade("all");
                setFilterTerapeuta("all");
                setFilterDiagnostico("all");
                setFilterStatus("ativo");
              }}
            >
              Limpar
            </Button>
          )}
          <div className="flex rounded-lg border bg-background/40 p-0.5">
            <button
              onClick={() => setLayout("grid")}
              className={`p-1.5 rounded-md transition-all ${layout === "grid" ? "bg-brand text-white" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout("lista")}
              className={`p-1.5 rounded-md transition-all ${layout === "lista" ? "bg-brand text-white" : "text-muted-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {layout === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {pacientes?.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}
            >
              <PacienteCard p={p} />
            </div>
          ))}
          {pacientes?.length === 0 && (
            <Card className="glass p-8 col-span-full text-center text-sm text-muted-foreground">
              Nenhum paciente encontrado.
            </Card>
          )}
        </div>
      ) : (
        <Card className="glass overflow-hidden">
          <div className="divide-y">
            {pacientes?.map((p) => (
              <PacienteRow key={p.id} p={p} />
            ))}
            {pacientes?.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum paciente encontrado.
              </div>
            )}
          </div>
        </Card>
      )}
      </TwoColumn>
    </div>
  );
}

function PacientesSidePanel({ stats }: { stats: any }) {
  const maxMod = Math.max(1, ...stats.porModalidade.map((m: any) => m.valor));
  return (
    <>
      <PanelCard title="Modalidades" icon={Stethoscope} delay={80}>
        {stats.porModalidade.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="space-y-2.5">
            {stats.porModalidade.slice(0, 6).map((m: any) => (
              <div key={m.nome}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-foreground">{m.nome}</span>
                  <span className="shrink-0 text-muted-foreground">{m.valor}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-lilac-soft/50">
                  <div
                    className="h-full rounded-full bg-lilac"
                    style={{ width: `${(m.valor / maxMod) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Em hipótese diagnóstica" icon={Sparkles} delay={140}>
        {stats.comHipoteseList.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Todos os pacientes desta visão têm diagnóstico definido ✨
          </p>
        ) : (
          <div className="space-y-1">
            {stats.comHipoteseList.slice(0, 5).map((p: any) => (
              <Link key={p.id} to="/pacientes/$id" params={{ id: p.id }}>
                <NotifRow
                  leading={<Avatar foto={p.foto_url} nome={p.nome} size={36} />}
                  title={p.nome}
                  subtitle={p.queixa_principal ?? "Investigação inicial"}
                  trailing={
                    <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-600">
                      hipótese
                    </Badge>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </PanelCard>

      <Link
        to="/indicadores"
        className="animate-fade-up card-lift relative block overflow-hidden rounded-[var(--radius)] gradient-lilac p-5 shadow-[var(--shadow-card)]"
        style={{ animationDelay: "200ms" }}
      >
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
        <div className="relative">
          <ArrowUpRight className="h-5 w-5 text-lilac-foreground" />
          <p className="mt-2 text-lg font-display leading-tight text-lilac-foreground">
            Panorama clínico
          </p>
          <p className="mt-1 text-xs text-lilac-foreground/80">
            Veja evolução, atendimentos e indicadores de toda a clínica.
          </p>
        </div>
      </Link>
    </>
  );
}

function PacienteCard({ p }: { p: any }) {
  const diagnosticos = (p.paciente_diagnosticos ?? [])
    .map((d: any) => d.diagnostico?.nome)
    .filter(Boolean);
  return (
    <Card
      className={`glass p-4 hover:shadow-soft transition-all hover:-translate-y-0.5 h-full relative ${p.arquivado ? "opacity-60" : ""}`}
    >
      <div className="absolute top-2 right-2 z-10">
        <PacienteAcoesMenu
          pacienteId={p.id}
          pacienteNome={p.nome}
          arquivado={p.arquivado}
          status={p.status}
        />
      </div>
      <Link to="/pacientes/$id" params={{ id: p.id }} className="block">
        <div className="flex items-start gap-3 pr-8">
          <Avatar foto={p.foto_url} nome={p.nome} size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{p.nome}</p>
              {p.arquivado && (
                <Badge variant="outline" className="text-[9px]">
                  arquivado
                </Badge>
              )}
              {!p.arquivado && p.status !== "ativo" && (
                <Badge variant="outline" className="text-[9px]">
                  {PACIENTE_STATUS_LABEL[p.status as keyof typeof PACIENTE_STATUS_LABEL] ??
                    p.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {p.data_nascimento
                ? `${calcAge(p.data_nascimento)} anos · ${format(parseISO(p.data_nascimento), "dd/MM/yyyy")}`
                : "Idade —"}
            </p>
            {p.escola?.nome && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3 h-3" /> {p.escola.nome}
              </p>
            )}
          </div>
        </div>

        {(diagnosticos.length > 0 || p.hipotese_diagnostica || p.queixa_principal) && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
            {diagnosticos.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                <Stethoscope className="w-3 h-3 text-brand" />
                {diagnosticos.map((d: string, i: number) => (
                  <Badge key={i} className="text-[10px] bg-brand/15 text-brand hover:bg-brand/20">
                    {d}
                  </Badge>
                ))}
              </div>
            )}
            {diagnosticos.length === 0 && (p.hipotese_diagnostica || p.queixa_principal) && (
              <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  <span className="text-amber-600 font-medium">
                    {p.hipotese_diagnostica ? "Em hipótese" : "Queixa"}:
                  </span>{" "}
                  {p.queixa_principal ?? "investigação inicial"}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-3">
          {p.modalidade && (
            <Badge
              variant="secondary"
              className="text-[10px]"
              style={
                p.modalidade.cor
                  ? {
                      backgroundColor: `color-mix(in oklab, ${p.modalidade.cor} 15%, transparent)`,
                      color: p.modalidade.cor,
                    }
                  : {}
              }
            >
              {p.modalidade.nome}
            </Badge>
          )}
          {p.profissional_responsavel && (
            <Badge
              variant="outline"
              className="text-[10px]"
              style={
                p.profissional_responsavel.cor
                  ? {
                      borderColor: p.profissional_responsavel.cor,
                      color: p.profissional_responsavel.cor,
                    }
                  : {}
              }
            >
              {p.profissional_responsavel.nome}
            </Badge>
          )}
        </div>
      </Link>
    </Card>
  );
}

function PacienteRow({ p }: { p: any }) {
  const diagnosticos = (p.paciente_diagnosticos ?? [])
    .map((d: any) => d.diagnostico?.nome)
    .filter(Boolean);
  return (
    <div
      className={`p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors ${p.arquivado ? "opacity-60" : ""}`}
    >
      <Link
        to="/pacientes/$id"
        params={{ id: p.id }}
        className="flex-1 flex items-center gap-3 min-w-0"
      >
        <Avatar foto={p.foto_url} nome={p.nome} size={40} />
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
          <div className="col-span-12 md:col-span-3 min-w-0">
            <p className="font-medium truncate">{p.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              {p.data_nascimento ? `${calcAge(p.data_nascimento)} anos` : "Idade —"}
              {p.escola?.nome ? ` · ${p.escola.nome}` : ""}
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 min-w-0 flex flex-wrap gap-1">
            {diagnosticos.length > 0 ? (
              diagnosticos.slice(0, 3).map((d: string, i: number) => (
                <Badge key={i} className="text-[10px] bg-brand/15 text-brand">
                  {d}
                </Badge>
              ))
            ) : p.hipotese_diagnostica || p.queixa_principal ? (
              <span className="text-[11px] text-amber-600 truncate">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {p.queixa_principal ?? "Em hipótese"}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Sem diagnóstico</span>
            )}
          </div>
          <div className="col-span-6 md:col-span-2 min-w-0">
            {p.modalidade && (
              <Badge variant="secondary" className="text-[10px]">
                {p.modalidade.nome}
              </Badge>
            )}
          </div>
          <div className="col-span-6 md:col-span-2 min-w-0">
            {p.profissional_responsavel && (
              <Badge variant="outline" className="text-[10px]">
                {p.profissional_responsavel.nome}
              </Badge>
            )}
          </div>
          <div className="hidden md:block md:col-span-1 text-right">
            {p.arquivado ? (
              <Badge variant="outline" className="text-[9px]">
                arquivado
              </Badge>
            ) : (
              p.status !== "ativo" && (
                <Badge variant="outline" className="text-[9px]">
                  {PACIENTE_STATUS_LABEL[p.status as keyof typeof PACIENTE_STATUS_LABEL] ??
                    p.status}
                </Badge>
              )
            )}
          </div>
        </div>
      </Link>
      <PacienteAcoesMenu
        pacienteId={p.id}
        pacienteNome={p.nome}
        arquivado={p.arquivado}
        status={p.status}
      />
    </div>
  );
}

function Avatar({ foto, nome, size }: { foto?: string | null; nome: string; size: number }) {
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden gradient-brand text-brand-foreground flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {foto ? (
        <img src={foto} alt={nome} className="w-full h-full object-cover" />
      ) : (
        iniciais || <User className="w-1/2 h-1/2" />
      )}
    </div>
  );
}

function calcAge(date: string) {
  const d = new Date(date);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function NovoPacienteDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    data_nascimento: "",
    escola_id: "" as string | "",
    serie_curso: "",
    responsavel_nome: "",
    responsavel_telefone: "",
    responsavel_parentesco: "",
    convenio: "",
    modelo_pagamento: "particular",
    valor_acordado: "" as string,
    canal_origem_id: "" as string,
  });

  const criar = useServerFn(criarPacienteRapido);

  const { data: canaisOrigem } = useQuery({
    queryKey: ["canais-origem-mini"],
    queryFn: async () => ((await supabase.from("canais_marketing").select("id, nome").eq("ativo", true).order("nome")).data ?? []) as { id: string; nome: string }[],
  });

  const mutation = useMutation({
    mutationFn: async () =>
      criar({
        data: {
          nome: form.nome.trim(),
          data_nascimento: form.data_nascimento || null,
          escola_id: form.escola_id || null,
          serie_curso: form.serie_curso || null,
          responsavel_nome: form.responsavel_nome || null,
          responsavel_telefone: form.responsavel_telefone || null,
          responsavel_parentesco: form.responsavel_parentesco || null,
          convenio: form.convenio || null,
          modelo_pagamento: form.modelo_pagamento || null,
          valor_acordado: form.valor_acordado ? Number(form.valor_acordado) : null,
          canal_origem_id: form.canal_origem_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Paciente cadastrado! Complete o perfil na anamnese.");
      setOpen(false);
      setForm({
        nome: "",
        data_nascimento: "",
        escola_id: "",
        serie_curso: "",
        responsavel_nome: "",
        responsavel_telefone: "",
        responsavel_parentesco: "",
        convenio: "",
        modelo_pagamento: "particular",
        valor_acordado: "",
        canal_origem_id: "",
      });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Novo paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo paciente</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cadastro rápido — os outros dados podem ser preenchidos depois na anamnese.
          </p>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
            />
          </div>

          <div className="pt-2 border-t border-border/30">
            <Label className="text-xs uppercase tracking-wide font-semibold text-lilac">
              Responsável
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.responsavel_nome}
                  onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Parentesco</Label>
                <Input
                  placeholder="mãe, pai, ..."
                  value={form.responsavel_parentesco}
                  onChange={(e) => setForm({ ...form, responsavel_parentesco: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={form.responsavel_telefone}
                onChange={(e) => setForm({ ...form, responsavel_telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border/30">
            <Label className="text-xs uppercase tracking-wide font-semibold text-lilac">Escola</Label>
            <div className="grid gap-3 mt-2">
              <EscolaCombobox
                value={form.escola_id || null}
                onChange={(id) => setForm({ ...form, escola_id: id ?? "" })}
              />
              <div>
                <Label className="text-xs">Ano / série</Label>
                <Input
                  value={form.serie_curso}
                  onChange={(e) => setForm({ ...form, serie_curso: e.target.value })}
                  placeholder="ex.: 5º ano"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/30">
            <Label className="text-xs uppercase tracking-wide font-semibold text-lilac">
              Origem
            </Label>
            <div className="mt-2">
              <Label className="text-xs">Como chegou até a Nave?</Label>
              <Select
                value={form.canal_origem_id || "__none"}
                onValueChange={(v) => setForm({ ...form, canal_origem_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Não informado</SelectItem>
                  {canaisOrigem?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t border-border/30">
            <Label className="text-xs uppercase tracking-wide font-semibold text-lilac">
              Financeiro
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select
                  value={form.modelo_pagamento}
                  onValueChange={(v) => setForm({ ...form, modelo_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="convenio">Convênio</SelectItem>
                    <SelectItem value="mensalidade">Mensalidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_acordado}
                  onChange={(e) => setForm({ ...form, valor_acordado: e.target.value })}
                />
              </div>
            </div>
            {form.modelo_pagamento === "convenio" && (
              <div className="mt-2">
                <Label className="text-xs">Nome do convênio</Label>
                <Input
                  value={form.convenio}
                  onChange={(e) => setForm({ ...form, convenio: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.nome || mutation.isPending}
            className="gradient-brand text-brand-foreground"
          >
            {mutation.isPending ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
