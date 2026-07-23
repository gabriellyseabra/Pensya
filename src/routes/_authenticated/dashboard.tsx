import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  Cake,
  Users,
  DollarSign,
  AlertTriangle,
  Plus,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Activity,
  Users2,
  CalendarCheck2,
  Target,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
  GraduationCap,
  UserCog,
  FileText,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isToday,
  isSameDay,
  addWeeks,
  subWeeks,
  subMonths,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { SmartCard } from "@/components/shared/SmartCard";
import { SetupChecklistCard } from "@/components/shared/SetupChecklistCard";
import { TutorialGuiadoCard } from "@/components/shared/TutorialGuiadoCard";
import { cn } from "@/lib/utils";
import { listarMetasEstagnadas } from "@/lib/insights.functions";
import { clinicaLogoUrl, getMinhaOrganizacao } from "@/lib/clinica-config";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const PRESENTES = new Set(["presente", "reposicao"]);
const PALETA_AVATAR = ["#6d5bd0", "#5585b1", "#c98bb9", "#e0a458", "#4c9f9f", "#b06ab3"];

// Frase do hero — muda a cada dia
const FRASES_HERO = [
  "Cuidar em equipe é sempre melhor",
  "Cada sessão é um passo no desenvolvimento",
  "Pequenos progressos, grandes conquistas",
  "O acolhimento começa nos detalhes",
  "Evolução se constrói dia após dia",
  "Escutar é o primeiro cuidado",
  "Cada criança tem seu próprio tempo",
  "Transformar vidas, uma sessão por vez",
];

function fraseDoDia(d: Date) {
  const inicioAno = new Date(d.getFullYear(), 0, 0);
  const dia = Math.floor((d.getTime() - inicioAno.getTime()) / 86400000);
  return FRASES_HERO[dia % FRASES_HERO.length];
}

// Diferenciação visual dos tipos de reunião
type ReuniaoTipo = "pais" | "escola" | "equipe" | "outro";
const REUNIAO_META: Record<
  ReuniaoTipo,
  { label: string; icon: React.ComponentType<{ className?: string }>; dot: string; chip: string }
> = {
  pais: {
    label: "Família",
    icon: Users,
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  escola: {
    label: "Escola",
    icon: GraduationCap,
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  equipe: {
    label: "Equipe",
    icon: UserCog,
    dot: "bg-brand",
    chip: "bg-brand/15 text-brand",
  },
  outro: {
    label: "Outros",
    icon: FileText,
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground",
  },
};

function reuniaoMeta(tipo?: string | null) {
  return REUNIAO_META[(tipo as ReuniaoTipo) in REUNIAO_META ? (tipo as ReuniaoTipo) : "outro"];
}

function corDoNome(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return PALETA_AVATAR[Math.abs(h) % PALETA_AVATAR.length];
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({
  nome,
  foto,
  className,
}: {
  nome: string;
  foto?: string | null;
  className?: string;
}) {
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        title={nome}
        className={cn("rounded-full object-cover ring-2 ring-card", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-card",
        className,
      )}
      style={{ backgroundColor: corDoNome(nome) }}
      title={nome}
    >
      {iniciais(nome)}
    </span>
  );
}

function DashboardPage() {
  const today = new Date();
  // Terapeuta (acesso restrito) não vê dados financeiros da clínica.
  const { isTerapeutaRestrito: ehTerapeuta } = useRoles();
  const [escopo, setEscopo] = useState<"semana" | "mes">("semana");
  const [weekOffset, setWeekOffset] = useState(0);
  const [ocultarValores, setOcultarValores] = useState(false);
  // Card "Recebido no mês": "tudo" (mensalidades + receitas manuais, igual ao Financeiro) ou só mensalidades.
  const [modoReceita, setModoReceita] = useState<"tudo" | "mensalidades">("tudo");

  useEffect(() => {
    setOcultarValores(localStorage.getItem("nave-ocultar-valores") === "1");
  }, []);
  const toggleValores = () => {
    setOcultarValores((v) => {
      const nv = !v;
      localStorage.setItem("nave-ocultar-valores", nv ? "1" : "0");
      return nv;
    });
  };
  // Máscara para valores sensíveis (financeiros) quando o modo privado está ativo
  const money = (n: number) => (ocultarValores ? "R$ ••••" : currency(n));

  const inicioMes = startOfMonth(today);
  const fimMes = endOfMonth(today);
  const inicioSemana = startOfWeek(today, { weekStartsOn: 1 });
  const fimSemana = endOfWeek(today, { weekStartsOn: 1 });
  const inicioSemanaPassada = subWeeks(inicioSemana, 1);
  const fimSemanaPassada = subWeeks(fimSemana, 1);
  const inicioMesPassado = startOfMonth(subMonths(today, 1));
  const inicio6Meses = startOfMonth(subMonths(today, 5));

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", ehTerapeuta],
    queryFn: async () => {
      // Terapeuta: contadores de tarefas contam só as atribuídas a ela.
      let uidT: string | null = null;
      if (ehTerapeuta) {
        const { data: { user } } = await supabase.auth.getUser();
        uidT = user?.id ?? null;
      }
      const tarefasBase = () => {
        let q = supabase.from("tarefas").select("*", { count: "exact", head: true }).neq("status", "concluida");
        if (ehTerapeuta && uidT) q = q.or(`responsavel_id.eq.${uidT},criador_id.eq.${uidT}`);
        return q;
      };
      const [
        { count: pacientesAtivos },
        { count: novosPacientesMes },
        { count: atendimentosHoje },
        { count: atendimentosSemana },
        { count: atendimentosSemanaPassada },
        { count: tarefasAbertas },
        { count: tarefasAtrasadas },
        { count: cadastrosPendentes },
        { count: metasAtivas },
        { count: sessoesSemana },
        { count: sessoesMes },
      ] = await Promise.all([
        supabase
          .from("pacientes")
          .select("*", { count: "exact", head: true })
          .eq("status", "ativo"),
        supabase
          .from("pacientes")
          .select("*", { count: "exact", head: true })
          .gte("created_at", inicioMes.toISOString()),
        supabase
          .from("atendimentos")
          .select("*", { count: "exact", head: true })
          .gte("inicio", startOfDay(today).toISOString())
          .lte("inicio", endOfDay(today).toISOString()),
        supabase
          .from("atendimentos")
          .select("*", { count: "exact", head: true })
          .gte("inicio", inicioSemana.toISOString())
          .lte("inicio", fimSemana.toISOString()),
        supabase
          .from("atendimentos")
          .select("*", { count: "exact", head: true })
          .gte("inicio", inicioSemanaPassada.toISOString())
          .lte("inicio", fimSemanaPassada.toISOString()),
        tarefasBase(),
        tarefasBase().lt("prazo", format(today, "yyyy-MM-dd")),
        supabase
          .from("cadastro_publico")
          .select("*", { count: "exact", head: true })
          .in("status", ["pendente", "em_preenchimento", "preenchido"]),
        supabase
          .from("metas_terapeuticas")
          .select("*", { count: "exact", head: true })
          .eq("status", "ativa"),
        supabase
          .from("prontuario_sessoes")
          .select("*", { count: "exact", head: true })
          .gte("data_sessao", format(inicioSemana, "yyyy-MM-dd"))
          .lte("data_sessao", format(fimSemana, "yyyy-MM-dd")),
        supabase
          .from("prontuario_sessoes")
          .select("*", { count: "exact", head: true })
          .gte("data_sessao", format(inicioMes, "yyyy-MM-dd"))
          .lte("data_sessao", format(fimMes, "yyyy-MM-dd")),
      ]);
      return {
        pacientesAtivos: pacientesAtivos ?? 0,
        novosPacientesMes: novosPacientesMes ?? 0,
        atendimentosHoje: atendimentosHoje ?? 0,
        atendimentosSemana: atendimentosSemana ?? 0,
        atendimentosSemanaPassada: atendimentosSemanaPassada ?? 0,
        tarefasAbertas: tarefasAbertas ?? 0,
        tarefasAtrasadas: tarefasAtrasadas ?? 0,
        cadastrosPendentes: cadastrosPendentes ?? 0,
        metasAtivas: metasAtivas ?? 0,
        sessoesSemana: sessoesSemana ?? 0,
        sessoesMes: sessoesMes ?? 0,
      };
    },
  });

  const { data: fin } = useQuery({
    queryKey: ["dash-fin-6m", inicioMes.toISOString()],
    enabled: !ehTerapeuta, // terapeuta não acessa dados financeiros
    queryFn: async () => {
      // Mensalidades/cobranças (pagamentos) + receitas manuais (lançamentos),
      // para que o card possa mostrar "só mensalidades" ou "tudo" — igual ao Financeiro.
      const [pagsRes, lancRes] = await Promise.all([
        supabase
          .from("pagamentos")
          .select("valor, status, vencimento")
          .gte("vencimento", format(inicio6Meses, "yyyy-MM-dd"))
          .lte("vencimento", format(fimMes, "yyyy-MM-dd")),
        supabase
          .from("lancamentos_financeiros")
          .select("valor, tipo, status, vencimento")
          .eq("tipo", "receita")
          .gte("vencimento", format(inicio6Meses, "yyyy-MM-dd"))
          .lte("vencimento", format(fimMes, "yyyy-MM-dd")),
      ]);
      const rows = pagsRes.data ?? [];
      const lancs = lancRes.data ?? [];
      const mesAtual = format(today, "yyyy-MM");
      const mesAnterior = format(inicioMesPassado, "yyyy-MM");

      let pago = 0,
        pendente = 0,
        atrasado = 0,
        pagoMesAnterior = 0,
        receitaManual = 0,
        receitaManualMesAnterior = 0;
      const porMes = new Map<string, number>(); // só mensalidades
      const porMesTotal = new Map<string, number>(); // mensalidades + receitas manuais
      for (let i = 5; i >= 0; i--) {
        const k = format(subMonths(today, i), "yyyy-MM");
        porMes.set(k, 0);
        porMesTotal.set(k, 0);
      }

      for (const r of rows) {
        const mes = String(r.vencimento).slice(0, 7);
        const valor = Number(r.valor);
        if (r.status === "pago") {
          if (porMes.has(mes)) porMes.set(mes, (porMes.get(mes) ?? 0) + valor);
          if (porMesTotal.has(mes)) porMesTotal.set(mes, (porMesTotal.get(mes) ?? 0) + valor);
          if (mes === mesAtual) pago += valor;
          if (mes === mesAnterior) pagoMesAnterior += valor;
        } else if (mes === mesAtual) {
          if (
            r.status === "atrasado" ||
            (r.status === "pendente" && new Date(r.vencimento) < today)
          )
            atrasado += valor;
          else if (r.status === "pendente") pendente += valor;
        }
      }

      for (const l of lancs) {
        if (l.status !== "confirmado") continue;
        const mes = String(l.vencimento).slice(0, 7);
        const valor = Number(l.valor);
        if (porMesTotal.has(mes)) porMesTotal.set(mes, (porMesTotal.get(mes) ?? 0) + valor);
        if (mes === mesAtual) receitaManual += valor;
        if (mes === mesAnterior) receitaManualMesAnterior += valor;
      }

      const serie = Array.from(porMes.entries()).map(([mes, valor]) => ({
        mes,
        label: format(parseISO(mes + "-01"), "MMM", { locale: ptBR }),
        valor,
        valorTotal: porMesTotal.get(mes) ?? valor,
        atual: mes === mesAtual,
      }));

      const pagoTotal = pago + receitaManual;
      const pagoTotalMesAnterior = pagoMesAnterior + receitaManualMesAnterior;
      const deltaReceita =
        pagoMesAnterior > 0 ? Math.round(((pago - pagoMesAnterior) / pagoMesAnterior) * 100) : null;
      const deltaReceitaTotal =
        pagoTotalMesAnterior > 0
          ? Math.round(((pagoTotal - pagoTotalMesAnterior) / pagoTotalMesAnterior) * 100)
          : null;

      return {
        pago,
        pagoTotal,
        receitaManual,
        pendente,
        atrasado,
        total: pago + pendente + atrasado,
        serie,
        deltaReceita,
        deltaReceitaTotal,
      };
    },
  });

  const { data: capitalGiro } = useQuery({
    queryKey: ["dash-capital-giro"],
    enabled: !ehTerapeuta, // terapeuta não acessa dados financeiros
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_financeiras")
        .select("saldo_inicial")
        .eq("ativo", true);
      return (data ?? []).reduce((s, r: any) => s + Number(r.saldo_inicial ?? 0), 0);
    },
  });

  const { data: presenca } = useQuery({
    queryKey: ["dash-presenca", inicioMes.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("data_referencia, tipo")
        .gte("data_referencia", format(inicioMesPassado, "yyyy-MM-dd"))
        .lte("data_referencia", format(fimMes, "yyyy-MM-dd"));
      const rows = data ?? [];
      const mesAtual = format(today, "yyyy-MM");
      const calc = (mes: string) => {
        const doMes = rows.filter((r) => String(r.data_referencia).startsWith(mes));
        if (doMes.length === 0) return null;
        return Math.round((doMes.filter((r) => PRESENTES.has(r.tipo)).length / doMes.length) * 100);
      };
      const atual = calc(mesAtual);
      const anterior = calc(format(inicioMesPassado, "yyyy-MM"));
      return { atual, delta: atual != null && anterior != null ? atual - anterior : null };
    },
  });

  const { data: atendimentosHojeList } = useQuery({
    queryKey: ["atendimentos-hoje-lista"],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select(
          "id, inicio, fim, paciente:pacientes(id, nome, foto_url), profissional:profissionais_consultorio(nome, cor), modalidade:modalidades(nome)",
        )
        .gte("inicio", startOfDay(today).toISOString())
        .lte("inicio", endOfDay(today).toISOString())
        .order("inicio");
      return data ?? [];
    },
  });

  const proximoAtendimento = atendimentosHojeList?.find((a) => new Date(a.inicio) > new Date());

  const { data: tarefas } = useQuery({
    queryKey: ["tarefas-dash", ehTerapeuta],
    queryFn: async () => {
      let q = supabase
        .from("tarefas")
        .select("id, titulo, prioridade, status, prazo, departamento, paciente:pacientes(nome)")
        .neq("status", "concluida")
        .order("prazo", { ascending: true })
        .limit(5);
      // Terapeuta só vê as tarefas atribuídas a ela (ou criadas por ela).
      if (ehTerapeuta) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) q = q.or(`responsavel_id.eq.${user.id},criador_id.eq.${user.id}`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: aniversariantes } = useQuery({
    queryKey: ["aniversariantes", today.getMonth() + 1],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, data_nascimento")
        .not("data_nascimento", "is", null);
      const month = today.getMonth() + 1;
      return (data ?? [])
        .filter((p) => p.data_nascimento && new Date(p.data_nascimento).getMonth() + 1 === month)
        .sort(
          (a, b) => new Date(a.data_nascimento!).getDate() - new Date(b.data_nascimento!).getDate(),
        );
    },
  });

  const { data: pacientesOciosos } = useQuery({
    queryKey: ["dash-pacientes-ociosos"],
    queryFn: async () => {
      const { data: pacs } = await supabase
        .from("pacientes")
        .select("id, nome, foto_url")
        .eq("status", "ativo");
      if (!pacs?.length) return [];
      const ids = pacs.map((p) => p.id);
      const { data: sessoes } = await supabase
        .from("prontuario_sessoes")
        .select("paciente_id, data_sessao")
        .in("paciente_id", ids)
        .order("data_sessao", { ascending: false });
      const ultima = new Map<string, string>();
      (sessoes ?? []).forEach((s: any) => {
        if (!ultima.has(s.paciente_id)) ultima.set(s.paciente_id, s.data_sessao);
      });
      const limite = new Date();
      limite.setDate(limite.getDate() - 14);
      return pacs
        .map((p) => ({ ...p, ultima_sessao: ultima.get(p.id) ?? null }))
        .filter((p) => !p.ultima_sessao || new Date(p.ultima_sessao) < limite)
        .sort((a, b) => (a.ultima_sessao ?? "").localeCompare(b.ultima_sessao ?? ""))
        .slice(0, 6);
    },
  });

  const { data: proximasReunioes } = useQuery({
    queryKey: ["dash-proximas-reunioes"],
    queryFn: async () => {
      const fim = new Date();
      fim.setDate(fim.getDate() + 7);
      const { data } = await supabase
        .from("reunioes")
        .select("id, data_reuniao, tipo, paciente:pacientes(id, nome)")
        .gte("data_reuniao", new Date().toISOString())
        .lte("data_reuniao", fim.toISOString())
        .order("data_reuniao")
        .limit(8);
      return data ?? [];
    },
  });

  const listarEstagnadas = useServerFn(listarMetasEstagnadas);
  const { data: metasEstagnadas } = useQuery({
    queryKey: ["dash-metas-estagnadas"],
    queryFn: async () => ((await listarEstagnadas()) as any).metas as any[],
  });

  // Identidade da clínica (logo própria da profissional, opcional)
  const { data: clinicaCfg } = useQuery({
    queryKey: ["minha-organizacao"],
    queryFn: getMinhaOrganizacao,
  });
  const clinicaLogo = clinicaLogoUrl(clinicaCfg?.logo_path);

  // Perfil logado (foto + nome) para personalizar o topo
  const { data: meuPerfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return { nome: data?.nome ?? "", avatar_url: data?.avatar_url ?? null };
    },
  });

  // Equipe (membros da organização atual) para o card "Members".
  const { data: equipe } = useQuery({
    queryKey: ["dash-equipe"],
    queryFn: async () => {
      const { data: orgId } = await supabase.rpc("my_org_id");
      if (!orgId) return [];
      const { data: membros } = await supabase
        .from("organizacao_membros")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("ativo", true);
      const ids = (membros ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", ids)
        .order("nome");
      return profiles ?? [];
    },
  });

  const deltaSemana =
    stats && stats.atendimentosSemanaPassada > 0
      ? Math.round(
          ((stats.atendimentosSemana - stats.atendimentosSemanaPassada) /
            stats.atendimentosSemanaPassada) *
            100,
        )
      : null;

  const insights = buildInsights({
    // Terapeuta não recebe alertas financeiros (inadimplência, receita, caixa).
    fin: ehTerapeuta ? undefined : fin,
    capitalGiro: ehTerapeuta ? 0 : capitalGiro ?? 0,
    stats,
    presenca,
    ocultarValores,
  });

  // Faixa de dias da semana exibida no cartão de calendário
  const semanaBase = addWeeks(inicioSemana, weekOffset);
  const diasSemana = eachDayOfInterval({
    start: semanaBase,
    end: endOfWeek(semanaBase, { weekStartsOn: 1 }),
  });

  const sessoesEscopo =
    escopo === "semana" ? (stats?.sessoesSemana ?? 0) : (stats?.sessoesMes ?? 0);
  const atendEscopo = escopo === "semana" ? (stats?.atendimentosSemana ?? 0) : "—";

  const maxReceita = Math.max(
    1,
    ...(fin?.serie.map((s) => (modoReceita === "tudo" ? s.valorTotal : s.valor)) ?? [1]),
  );

  const primeiroNome = (meuPerfil?.nome ?? "").trim().split(/\s+/)[0] || "";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ===== Coluna principal ===== */}
      <div className="space-y-4">
        {/* Hero */}
        <div className="animate-fade-up relative overflow-hidden rounded-[var(--radius)] gradient-lilac p-6 shadow-[var(--shadow-card)]">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
          <button
            onClick={toggleValores}
            title={ocultarValores ? "Mostrar valores" : "Ocultar valores"}
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-lilac-foreground shadow-sm backdrop-blur transition hover:bg-white/90"
          >
            {ocultarValores ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {ocultarValores ? "Valores ocultos" : "Ocultar valores"}
          </button>
          {clinicaLogo && (
            <Link
              to="/configuracoes"
              title="Identidade da clínica"
              className="absolute bottom-4 right-4 z-10 hidden items-center justify-center rounded-2xl bg-white/85 px-4 py-3 shadow-sm backdrop-blur transition hover:bg-white sm:flex"
            >
              <img src={clinicaLogo} alt="Logo da clínica" className="h-16 w-auto max-w-[11rem] object-contain" />
            </Link>
          )}
          <div className="relative max-w-lg">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/60 text-sm font-semibold text-lilac-foreground ring-2 ring-white/50">
                {meuPerfil?.avatar_url ? (
                  <img src={meuPerfil.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  iniciais(meuPerfil?.nome || "?")
                )}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-lilac-foreground">
                  {saudacao()}
                  {primeiroNome ? `, ${primeiroNome}` : ""}
                </p>
                <p className="text-xs capitalize text-lilac-foreground/70">
                  {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            <h1 className="mt-1 text-3xl font-display leading-tight text-lilac-foreground">
              {fraseDoDia(today)}
            </h1>
            <p className="mt-1.5 text-sm text-lilac-foreground/80">
              Acompanhe pacientes, sessões e metas em um só lugar — comece registrando o dia de
              hoje.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/cadastros">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Novo cadastro
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="bg-white/70">
                <Link to="/agenda">
                  <CalendarIcon className="mr-1.5 h-4 w-4" />
                  Ver agenda
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="bg-white/70">
                <Link to="/tarefas">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova tarefa
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Tour guiado pelo sistema usando a paciente modelo */}
        <TutorialGuiadoCard />

        {/* Primeiros passos — some quando a clínica já está configurada */}
        <SetupChecklistCard />

        {/* Três cartões: pacientes de hoje · recebido · presença */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="animate-fade-up card-lift" style={{ animationDelay: "60ms" }}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pacientes de hoje</span>
                <Link to="/agenda" className="text-muted-foreground hover:text-foreground">
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              {(atendimentosHojeList?.length ?? 0) === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Nenhum atendimento hoje.</p>
              ) : (
                <>
                  <div className="flex items-center">
                    {atendimentosHojeList?.slice(0, 5).map((a, i) => (
                      <Avatar
                        key={a.id}
                        nome={a.paciente?.nome ?? "—"}
                        foto={a.paciente?.foto_url}
                        className={cn("h-9 w-9", i > 0 && "-ml-2.5")}
                      />
                    ))}
                    {(atendimentosHojeList?.length ?? 0) > 5 && (
                      <span className="-ml-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[11px] font-semibold ring-2 ring-card">
                        +{(atendimentosHojeList?.length ?? 0) - 5}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">
                      {atendimentosHojeList?.length ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {proximoAtendimento
                        ? `próximo às ${format(parseISO(proximoAtendimento.inicio), "HH:mm")}`
                        : "agendados"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {!ehTerapeuta && (
          <Card className="animate-fade-up card-lift" style={{ animationDelay: "120ms" }}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Recebido no mês</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex rounded-full bg-muted/60 p-0.5 text-[10px] font-medium">
                    <button
                      type="button"
                      onClick={() => setModoReceita("tudo")}
                      className={cn(
                        "rounded-full px-2 py-0.5 transition-colors",
                        modoReceita === "tudo" ? "bg-background shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      Tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoReceita("mensalidades")}
                      className={cn(
                        "rounded-full px-2 py-0.5 transition-colors",
                        modoReceita === "mensalidades"
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      Mensalidades
                    </button>
                  </div>
                  <DollarSign className="h-4 w-4 text-lilac" />
                </div>
              </div>
              <p className="text-3xl font-semibold">
                {money((modoReceita === "tudo" ? fin?.pagoTotal : fin?.pago) ?? 0)}
              </p>
              <div className="flex h-12 items-end gap-1.5">
                {(fin?.serie ?? []).map((s) => {
                  const v = modoReceita === "tudo" ? s.valorTotal : s.valor;
                  return (
                    <div key={s.mes} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cn("w-full rounded-t-md", s.atual ? "bg-lilac" : "bg-lilac-soft")}
                        style={{ height: `${Math.max(6, (v / maxReceita) * 40)}px` }}
                      />
                      <span className="text-[9px] capitalize text-muted-foreground">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {(modoReceita === "tudo" ? fin?.deltaReceitaTotal : fin?.deltaReceita) != null && (
                <DeltaText
                  value={(modoReceita === "tudo" ? fin?.deltaReceitaTotal : fin?.deltaReceita) as number}
                  label="vs mês anterior"
                />
              )}
              {modoReceita === "tudo" && (fin?.receitaManual ?? 0) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Inclui {money(fin?.receitaManual ?? 0)} em receitas avulsas (lançamentos)
                </p>
              )}
            </CardContent>
          </Card>
          )}

          <Card className="animate-fade-up card-lift" style={{ animationDelay: "180ms" }}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Presença no mês</span>
                <CalendarCheck2 className="h-4 w-4 text-lilac" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-semibold">
                  {presenca?.atual != null ? `${presenca.atual}%` : "—"}
                </p>
                {presenca?.delta != null && (
                  <Badge
                    className={cn(
                      "gap-0.5",
                      presenca.delta >= 0
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 text-destructive",
                    )}
                    variant="secondary"
                  >
                    {presenca.delta >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {presenca.delta >= 0 ? "+" : ""}
                    {presenca.delta}pp
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Comparecimento dos atendimentos registrados neste mês.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas + destaque escuro + promo lilás */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="animate-fade-up card-lift" style={{ animationDelay: "220ms" }}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium">Produtividade clínica</span>
                <div className="flex rounded-full bg-muted p-0.5 text-xs">
                  {(["semana", "mes"] as const).map((e) => (
                    <button
                      key={e}
                      onClick={() => setEscopo(e)}
                      className={cn(
                        "rounded-full px-3 py-1 font-medium capitalize transition-colors",
                        escopo === e ? "bg-foreground text-background" : "text-muted-foreground",
                      )}
                    >
                      {e === "semana" ? "Semana" : "Mês"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-4xl font-semibold leading-none">{sessoesEscopo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">sessões registradas</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold leading-none text-lilac">
                    {stats?.metasAtivas ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">metas ativas</p>
                </div>
                {escopo === "semana" && deltaSemana != null && (
                  <div className="ml-auto self-center">
                    <DeltaText value={deltaSemana} label="atend. vs sem. anterior" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  icon={CheckSquare}
                  label="Tarefas em aberto"
                  value={stats?.tarefasAbertas ?? 0}
                  to="/tarefas"
                  alerta={
                    stats?.tarefasAtrasadas ? `${stats.tarefasAtrasadas} vencidas` : undefined
                  }
                />
                <MiniStat
                  icon={Users}
                  label="Cadastros p/ revisar"
                  value={stats?.cadastrosPendentes ?? 0}
                  to="/cadastros"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {/* Destaque escuro: próximo compromisso */}
            <div
              className="animate-fade-up card-lift rounded-[var(--radius)] border border-white/10 bg-rail p-5 text-rail-foreground shadow-[var(--shadow-card)] dark:bg-[oklch(0.26_0.03_285)]"
              style={{ animationDelay: "260ms" }}
            >
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Clock className="h-3.5 w-3.5" /> Próximo compromisso
              </div>
              {proximoAtendimento ? (
                <div className="mt-3">
                  <p className="text-lg font-semibold text-white">
                    {proximoAtendimento.paciente?.nome ?? "Atendimento"}
                  </p>
                  <p className="text-sm text-white/60">
                    {format(parseISO(proximoAtendimento.inicio), "HH:mm")}
                    {proximoAtendimento.profissional?.nome
                      ? ` · ${proximoAtendimento.profissional.nome}`
                      : ""}
                  </p>
                </div>
              ) : proximasReunioes && proximasReunioes.length > 0 ? (
                <div className="mt-3">
                  <p className="text-lg font-semibold capitalize text-white">
                    {proximasReunioes[0].tipo}
                  </p>
                  <p className="text-sm text-white/60">
                    {proximasReunioes[0].paciente?.nome ?? "—"} ·{" "}
                    {format(parseISO(proximasReunioes[0].data_reuniao), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">Sem compromissos futuros próximos.</p>
              )}
            </div>

            {/* Promo lilás: metas estagnadas ou tudo em dia */}
            <Link
              to="/indicadores"
              className="animate-fade-up card-lift relative flex-1 overflow-hidden rounded-[var(--radius)] gradient-lilac p-5 shadow-[var(--shadow-card)]"
              style={{ animationDelay: "300ms" }}
            >
              <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
              <div className="relative">
                <Sparkles className="h-5 w-5 text-lilac-foreground" />
                <p className="mt-2 text-lg font-display leading-tight text-lilac-foreground">
                  {metasEstagnadas && metasEstagnadas.length > 0
                    ? `${metasEstagnadas.length} meta${metasEstagnadas.length > 1 ? "s" : ""} pedindo atenção`
                    : "Evolução em dia"}
                </p>
                <p className="mt-1 text-xs text-lilac-foreground/80">
                  {metasEstagnadas && metasEstagnadas.length > 0
                    ? "Revise as metas sem progresso recente."
                    : "Acompanhe indicadores e a evolução clínica."}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-lilac-foreground">
                  Ver indicadores <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i, idx) => (
              <div
                key={idx}
                className="animate-fade-up"
                style={{ animationDelay: `${240 + idx * 80}ms` }}
              >
                <SmartCard title={i.title} severity={i.severity}>
                  <p>{i.text}</p>
                </SmartCard>
              </div>
            ))}
          </div>
        )}

        {/* Tarefas em aberto */}
        <Card className="animate-fade-up card-lift" style={{ animationDelay: "300ms" }}>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-medium">
                <CheckSquare className="h-4 w-4 text-lilac" /> Tarefas em aberto
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tarefas">Ver todas</Link>
              </Button>
            </div>
            {(!tarefas || tarefas.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">Tudo em dia ✨</p>
            )}
            {tarefas?.map((t: any) => {
              const vencida = t.prazo && t.prazo < format(today, "yyyy-MM-dd");
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.departamento ? `${t.departamento} · ` : ""}
                      {t.paciente?.nome ? `${t.paciente.nome} · ` : ""}
                      {t.prazo ? (
                        <span className={vencida ? "font-medium text-destructive" : ""}>
                          {format(parseISO(t.prazo), "dd/MM")}
                          {vencida ? " (vencida)" : ""}
                        </span>
                      ) : (
                        "Sem prazo"
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={t.prioridade === "alta" ? "destructive" : "outline"}
                    className="shrink-0"
                  >
                    {t.prioridade}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ===== Coluna lateral ===== */}
      <div className="space-y-4">
        {/* Equipe */}
        <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-medium">
                <Users className="h-4 w-4 text-lilac" /> Equipe
              </span>
              <Link
                to="/equipe"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Gerenciar equipe"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
            {(equipe?.length ?? 0) === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                {equipe?.map((m) => (
                  <Link
                    key={m.id}
                    to="/equipe"
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                    title={m.nome}
                  >
                    <Avatar nome={m.nome || "?"} foto={m.avatar_url} className="h-16 w-16" />
                    <span className="line-clamp-2 text-center text-xs leading-tight text-muted-foreground">
                      {m.nome}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendário da semana */}
        <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-display capitalize">
                {format(semanaBase, "MMMM yyyy", { locale: ptBR })}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 hover:bg-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 hover:bg-accent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {diasSemana.map((d) => {
                const ativo = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl py-2 text-center transition-colors",
                      ativo ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[10px] capitalize">
                      {format(d, "EEEEEE", { locale: ptBR })}
                    </span>
                    <span className={cn("text-sm", ativo && "font-semibold")}>
                      {format(d, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Próximas reuniões (lista compacta, diferenciada por tipo) */}
        <Card className="animate-fade-up" style={{ animationDelay: "140ms" }}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-medium">
                <Users2 className="h-4 w-4 text-lilac" />
                Próximas reuniões
              </span>
              <div className="hidden items-center gap-2 text-[10px] text-muted-foreground sm:flex">
                {(["pais", "escola", "equipe", "outro"] as const).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <span className={cn("h-2 w-2 rounded-full", REUNIAO_META[t].dot)} />
                    {REUNIAO_META[t].label}
                  </span>
                ))}
              </div>
            </div>
            {(!proximasReunioes || proximasReunioes.length === 0) && (
              <p className="py-3 text-sm text-muted-foreground">
                Nenhuma reunião nos próximos 7 dias.
              </p>
            )}
            <div className="space-y-1">
              {proximasReunioes?.map((r: any) => {
                const meta = reuniaoMeta(r.tipo);
                const Icon = meta.icon;
                return (
                  <Link
                    key={r.id}
                    to="/pacientes/$id"
                    params={{ id: r.paciente?.id ?? "" }}
                    className="flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4",
                        meta.chip,
                      )}
                    >
                      <Icon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {r.paciente?.nome ?? "—"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {meta.label} · {format(parseISO(r.data_reuniao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Atenção clínica (estilo notificações) */}
        <Card className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-lilac" />
              <span className="text-base font-medium">Atenção clínica</span>
            </div>
            <div className="space-y-2">
              {(pacientesOciosos?.length ?? 0) === 0 && (metasEstagnadas?.length ?? 0) === 0 && (
                <p className="py-3 text-sm text-muted-foreground">
                  Todos os pacientes ativos têm sessão recente ✨
                </p>
              )}
              {pacientesOciosos?.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to="/pacientes/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 rounded-2xl p-2 hover:bg-accent"
                >
                  <Avatar nome={p.nome} foto={(p as any).foto_url} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.ultima_sessao
                        ? `Última sessão em ${format(parseISO(p.ultima_sessao), "dd/MM")}`
                        : "Nenhuma sessão registrada"}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-600">
                    &gt;14d
                  </Badge>
                </Link>
              ))}
              {metasEstagnadas?.slice(0, 3).map((m: any) => (
                <Link
                  key={m.meta_id}
                  to="/pacientes/$id"
                  params={{ id: m.paciente_id }}
                  className="flex items-center gap-3 rounded-2xl p-2 hover:bg-accent"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                    <Target className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.paciente_nome}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-600">
                    {m.dias_sem_mudanca}d
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Aniversariantes */}
        <Card className="animate-fade-up" style={{ animationDelay: "260ms" }}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Cake className="h-4 w-4 text-lilac" />
              <span className="text-base font-medium">Aniversariantes do mês</span>
            </div>
            {(!aniversariantes || aniversariantes.length === 0) && (
              <p className="py-3 text-sm text-muted-foreground">Nenhum aniversariante.</p>
            )}
            <div className="space-y-1">
              {aniversariantes?.slice(0, 5).map((p) => {
                const data = parseISO(p.data_nascimento!);
                const ehHoje = isToday(
                  new Date(today.getFullYear(), data.getMonth(), data.getDate()),
                );
                return (
                  <Link
                    key={p.id}
                    to="/pacientes/$id"
                    params={{ id: p.id }}
                    className="-mx-2 flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {ehHoje && <span>🎉</span>}
                      {p.nome}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        ehHoje ? "font-semibold text-lilac" : "text-muted-foreground",
                      )}
                    >
                      {format(data, "dd/MM")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeltaText({ value, label }: { value: number; label: string }) {
  const good = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
      )}
    >
      {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {good ? "+" : ""}
      {value}% <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  to,
  alerta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  to: string;
  alerta?: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {alerta && <p className="text-[11px] text-destructive">{alerta}</p>}
    </Link>
  );
}

function buildInsights({
  fin,
  capitalGiro,
  stats,
  presenca,
  ocultarValores,
}: {
  fin:
    | {
        pago: number;
        pendente: number;
        atrasado: number;
        total: number;
        deltaReceita: number | null;
      }
    | undefined;
  capitalGiro: number;
  stats:
    | {
        pacientesAtivos: number;
        cadastrosPendentes: number;
        tarefasAbertas: number;
        tarefasAtrasadas: number;
      }
    | undefined;
  presenca: { atual: number | null; delta: number | null } | undefined;
  ocultarValores?: boolean;
}) {
  const out: {
    title: string;
    text: string;
    severity: "info" | "success" | "warning" | "danger";
  }[] = [];
  if (fin && fin.atrasado > 0) {
    const valor = ocultarValores
      ? "valores"
      : fin.atrasado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    out.push({
      title: "Inadimplência ativa",
      text: `Há ${valor} em pagamentos atrasados. Considere acionar cobrança.`,
      severity: "danger",
    });
  }
  if (stats && stats.tarefasAtrasadas > 0) {
    out.push({
      title: "Tarefas com prazo vencido",
      text: `${stats.tarefasAtrasadas} tarefa${stats.tarefasAtrasadas > 1 ? "s" : ""} passou do prazo. Reorganize as prioridades da semana.`,
      severity: "warning",
    });
  }
  if (presenca?.atual != null && presenca.atual < 80) {
    out.push({
      title: "Presença abaixo de 80%",
      text: `A taxa de presença do mês está em ${presenca.atual}%. Vale revisar faltas recorrentes e confirmar agendamentos.`,
      severity: "warning",
    });
  }
  if (fin && fin.total > 0 && fin.pago / fin.total >= 0.8) {
    out.push({
      title: "Mês acima de 80% recebido",
      text: `Você já recebeu ${Math.round((fin.pago / fin.total) * 100)}% do previsto para o mês.`,
      severity: "success",
    });
  }
  if (fin?.deltaReceita != null && fin.deltaReceita >= 10) {
    out.push({
      title: "Receita em crescimento",
      text: `O recebido deste mês está ${fin.deltaReceita}% acima do mês anterior.`,
      severity: "success",
    });
  }
  if (capitalGiro > 0 && fin && fin.atrasado > capitalGiro * 0.2) {
    out.push({
      title: "Atrasados representam mais de 20% do caixa",
      text: "Risco de fluxo de caixa. Priorize cobranças desta semana.",
      severity: "warning",
    });
  }
  if (stats && stats.cadastrosPendentes >= 5) {
    out.push({
      title: "Cadastros acumulados",
      text: `${stats.cadastrosPendentes} cadastros aguardam revisão clínica.`,
      severity: "warning",
    });
  }
  return out.slice(0, 3);
}

function currency(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}
