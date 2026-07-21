import { useState, type ComponentType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Target,
  Wallet,
  Clock,
  AlertTriangle,
  Users,
  ListChecks,
  Loader2,
  Activity,
} from "lucide-react";
import {
  differenceInDays,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { currency, type MktRotina, type MktRotinaExecucao, type Cadencia } from "./types";
import { IndicadoresGerais } from "./IndicadoresGerais";
import { periodoAtual } from "@/lib/marketing-periodos";
import { gerarTarefasMarketing } from "@/lib/marketing-tarefas";
import { invalidarMarketing } from "@/lib/marketing-cache";

const CORES = ["#064570", "#5585b1", "#f9ca0a", "#deb0bd", "#10b981", "#ef4444"];

type LeadDashboard = {
  id: string;
  created_at: string;
  etapa_id: string;
  canal_id: string | null;
  canal?: { nome: string | null } | null;
  campanha_id: string | null;
  responsavel?: { nome: string | null } | null;
  paciente_id_criado: string | null;
  convertido_em: string | null;
  entrou_em: string;
  ultimo_contato_em: string | null;
};

type CampanhaCusto = {
  id: string;
  canal_id: string | null;
  custo_realizado: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

type MetricaCanal = {
  canalId: string | null;
  canal: string;
  leads: number;
  convertidos: number;
  taxa: number;
  custo: number;
  cpl: number | null;
  cac: number | null;
  ciclo: number | null;
};

type PacienteOrigem = {
  id: string;
  status: string;
  canal_origem_id: string | null;
  campanha_origem_id: string | null;
  created_at: string;
};

type LookupNome = { id: string; nome: string | null };
type PagamentoOrigem = {
  paciente_id: string;
  valor: number;
  valor_recebido: number | null;
  status: string;
};
type LancamentoOrigem = { paciente_id: string | null; valor: number; tipo: string; status: string };
type FrequenciaOrigem = { paciente_id: string; tipo: string };

type QualidadeOrigem = {
  key: string;
  canalId: string | null;
  campanhaId: string | null;
  canal: string;
  campanha: string;
  pacientesConvertidos: number;
  pacientesAtivos: number;
  abandonoCancelamento: number;
  receitaRecebida: number;
  inadimplenciaValor: number;
  frequencias: number;
  presencas: number;
};
const PERIODOS = {
  mes: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  ano: "Este ano",
} as const;
type PeriodoKey = keyof typeof PERIODOS;

export function DashboardMarketing() {
  const today = new Date();
  const [periodo, setPeriodo] = useState<PeriodoKey>("3m");

  const { inicio, fim } = (() => {
    if (periodo === "mes") return { inicio: startOfMonth(today), fim: endOfMonth(today) };
    if (periodo === "3m")
      return { inicio: startOfMonth(subMonths(today, 2)), fim: endOfMonth(today) };
    if (periodo === "6m")
      return { inicio: startOfMonth(subMonths(today, 5)), fim: endOfMonth(today) };
    return { inicio: startOfYear(today), fim: endOfYear(today) };
  })();
  const inicioISO = inicio.toISOString();
  const fimISO = endOfMonth(fim).toISOString();

  const { data: leads } = useQuery({
    queryKey: ["mkt-dashboard-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select(
          "id, created_at, etapa_id, canal_id, canal:canais_marketing(nome), campanha_id, responsavel:profiles(nome), paciente_id_criado, convertido_em, entrou_em, ultimo_contato_em",
        )
        .order("created_at", { ascending: false });
      return (data ?? []) as LeadDashboard[];
    },
  });

  const { data: etapas } = useQuery({
    queryKey: ["etapas-mini"],
    queryFn: async () =>
      (await supabase.from("pipeline_etapas").select("*").eq("ativo", true).order("ordem")).data ??
      [],
  });

  const { data: campanhas } = useQuery({
    queryKey: ["mkt-dashboard-campanhas"],
    queryFn: async () =>
      ((await supabase.from("campanhas").select("id, canal_id, custo_realizado, data_inicio, data_fim")).data ?? []) as CampanhaCusto[],
  });
  const { data: pacientesOrigem } = useQuery({
    queryKey: ["mkt-pacientes-origem", inicioISO, fimISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, status, canal_origem_id, campanha_origem_id, created_at")
        .not("canal_origem_id", "is", null)
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO);
      return (data ?? []) as PacienteOrigem[];
    },
  });

  const { data: canaisOrigem } = useQuery({
    queryKey: ["mkt-canais-origem-lookup"],
    queryFn: async () => (await supabase.from("canais_marketing").select("id, nome")).data ?? [],
  });

  const { data: campanhasOrigem } = useQuery({
    queryKey: ["mkt-campanhas-origem-lookup"],
    queryFn: async () => (await supabase.from("campanhas").select("id, nome")).data ?? [],
  });

  const idsPacientesOrigem = (pacientesOrigem ?? []).map((p) => p.id);

  const { data: pagamentosOrigem } = useQuery({
    queryKey: ["mkt-pagamentos-origem", idsPacientesOrigem.join(",")],
    enabled: idsPacientesOrigem.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("paciente_id, valor, valor_recebido, status")
        .in("paciente_id", idsPacientesOrigem);
      return (data ?? []) as PagamentoOrigem[];
    },
  });

  const { data: lancamentosOrigem } = useQuery({
    queryKey: ["mkt-lancamentos-origem", idsPacientesOrigem.join(",")],
    enabled: idsPacientesOrigem.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("lancamentos_financeiros")
        .select("paciente_id, valor, tipo, status")
        .in("paciente_id", idsPacientesOrigem);
      return (data ?? []) as LancamentoOrigem[];
    },
  });

  const { data: frequenciasOrigem } = useQuery({
    queryKey: ["mkt-frequencias-origem", idsPacientesOrigem.join(",")],
    enabled: idsPacientesOrigem.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("paciente_id, tipo")
        .in("paciente_id", idsPacientesOrigem);
      return (data ?? []) as FrequenciaOrigem[];
    },
  });

  const { data: pacientesAquisicao } = useQuery({
    queryKey: ["mkt-dashboard-pacientes-aquisicao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, lead_origem_id, canal_origem:canal_origem_id(nome), campanha_origem_id, data_conversao_marketing")
        .not("lead_origem_id", "is", null);
      return (data ?? []) as any[];
    },
  });

  const qc = useQueryClient();
  const { data: rotinas } = useQuery({
    queryKey: ["mkt-rotinas"],
    queryFn: async () =>
      ((await supabase.from("marketing_rotinas").select("*").eq("ativo", true).order("ordem"))
        .data ?? []) as MktRotina[],
  });
  const periodosAtuais = Array.from(
    new Set((["semanal", "mensal", "bimestral"] as Cadencia[]).map((c) => periodoAtual(c))),
  );
  const { data: execucoes } = useQuery({
    queryKey: ["mkt-rotina-execucoes", ...periodosAtuais],
    queryFn: async () =>
      ((await supabase.from("marketing_rotina_execucoes").select("*").in("periodo", periodosAtuais))
        .data ?? []) as MktRotinaExecucao[],
  });
  const rotinasPendentes = (rotinas ?? []).filter((r) => {
    const per = periodoAtual(r.cadencia as Cadencia);
    const e = (execucoes ?? []).find((x) => x.rotina_id === r.id && x.periodo === per);
    return !(e && (e.feito || e.quantidade >= r.meta_qtd));
  });

  const gerar = useMutation({
    mutationFn: gerarTarefasMarketing,
    onSuccess: (r) => {
      const partes: string[] = [];
      if (r.rotinas) partes.push(`${r.rotinas} de rotina`);
      if (r.followups) partes.push(`${r.followups} de follow-up`);
      toast.success(
        partes.length
          ? `Tarefas criadas: ${partes.join(" · ")}`
          : "Tudo em dia — nenhuma tarefa nova",
      );
      invalidarMarketing(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leadsPeriodo = (leads ?? []).filter((l) => l.created_at >= inicioISO && l.created_at <= fimISO);
  const leadIdsPeriodo = new Set(leadsPeriodo.map((l) => l.id));
  const convertidosPeriodo = (pacientesAquisicao ?? []).filter((p) => p.lead_origem_id && leadIdsPeriodo.has(p.lead_origem_id));
  const taxaConversao = leadsPeriodo.length > 0 ? (convertidosPeriodo.length / leadsPeriodo.length) * 100 : 0;

  const etapasAbertas = new Set((etapas ?? []).filter((e) => e.tipo === "ativo").map((e) => e.id));
  const leadsAbertos = (leads ?? []).filter((l) => etapasAbertas.has(l.etapa_id));

  // Custo atribuído por canal = campanhas do canal que se sobrepõem ao período selecionado.
  const iniDia = format(inicio, "yyyy-MM-dd");
  const fimDia = format(fim, "yyyy-MM-dd");
  const campanhaNoPeriodo = (c: CampanhaCusto) =>
    (!c.data_inicio || c.data_inicio <= fimDia) && (!c.data_fim || c.data_fim >= iniDia);
  const custoPorCanal = new Map<string | null, number>();
  for (const c of campanhas ?? []) {
    if (!campanhaNoPeriodo(c)) continue;
    const k = c.canal_id ?? null;
    custoPorCanal.set(k, (custoPorCanal.get(k) ?? 0) + Number(c.custo_realizado || 0));
  }
  const nomeCanal = new Map<string, string>();
  for (const l of leads ?? []) if (l.canal_id) nomeCanal.set(l.canal_id, l.canal?.nome ?? "Canal");

  const canaisSet = new Set<string | null>();
  for (const l of leadsPeriodo) canaisSet.add(l.canal_id ?? null);
  for (const k of custoPorCanal.keys()) canaisSet.add(k);

  const metricasCanal: MetricaCanal[] = Array.from(canaisSet)
    .map((cid) => {
      const leadsC = leadsPeriodo.filter((l) => (l.canal_id ?? null) === cid);
      const convC = leadsC.filter((l) => l.paciente_id_criado);
      const custo = custoPorCanal.get(cid) ?? 0;
      const ciclosC = convC.filter((l) => l.convertido_em && l.entrou_em);
      const ciclo = ciclosC.length > 0
        ? ciclosC.reduce((s, l) => s + differenceInDays(parseISO(l.convertido_em!), parseISO(l.entrou_em)), 0) / ciclosC.length
        : null;
      return {
        canalId: cid,
        canal: cid ? (nomeCanal.get(cid) ?? "Canal") : "Sem origem informada",
        leads: leadsC.length,
        convertidos: convC.length,
        taxa: leadsC.length > 0 ? (convC.length / leadsC.length) * 100 : 0,
        custo,
        cpl: leadsC.length > 0 && custo > 0 ? custo / leadsC.length : null,
        cac: convC.length > 0 && custo > 0 ? custo / convC.length : null,
        ciclo,
      } as MetricaCanal;
    })
    .filter((m) => m.leads > 0 || m.custo > 0)
    .sort((a, b) => b.leads - a.leads);

  // Custo por lead global, respeitando o período (task 3).
  const custoPeriodoTotal = Array.from(custoPorCanal.values()).reduce((s, v) => s + v, 0);
  const custoPorLead = leadsPeriodo.length > 0 && custoPeriodoTotal > 0 ? custoPeriodoTotal / leadsPeriodo.length : null;
  const leadsSemOrigem = leadsPeriodo.filter((l) => !l.canal_id).length;

  const pacientesPorLead = new Map((pacientesAquisicao ?? []).map((p) => [p.lead_origem_id, p]));
  const convertidosTotal = (leads ?? []).filter((l) => pacientesPorLead.has(l.id) && l.convertido_em && l.entrou_em);
  const cicloMedio = convertidosTotal.length > 0
    ? convertidosTotal.reduce((s, l) => s + differenceInDays(parseISO(l.convertido_em), parseISO(l.entrou_em)), 0) / convertidosTotal.length
    : null;

  const leadsEstagnados = leadsAbertos.filter((l) => {
    const ref = l.ultimo_contato_em ?? l.entrou_em;
    return ref && differenceInDays(today, parseISO(ref)) >= 7;
  });

  const funil = (etapas ?? []).map((e) => ({
    etapa: e.nome,
    quantidade: (leads ?? []).filter((l) => l.etapa_id === e.id).length,
    cor: e.cor,
  }));

  const porCanal = (() => {
    const map = new Map<string, number>();
    for (const l of leadsPeriodo) {
      const nome = l.canal?.nome ?? "Sem canal";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  })();

  const serieTemporal = (() => {
    const out: { mes: string; leads: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(today, i);
      const ini = startOfMonth(m).toISOString();
      const fimM = endOfMonth(m).toISOString();
      out.push({
        mes: format(m, "MMM", { locale: ptBR }),
        leads: (leads ?? []).filter((l) => l.created_at >= ini && l.created_at <= fimM).length,
      });
    }
    return out;
  })();

  const qualidadeOrigem = (() => {
    const canais = new Map(
      ((canaisOrigem as LookupNome[] | undefined) ?? []).map((c) => [c.id, c.nome]),
    );
    const campanhas = new Map(
      ((campanhasOrigem as LookupNome[] | undefined) ?? []).map((c) => [c.id, c.nome]),
    );
    const recebidos = new Set(["pago", "recebido", "quitado"]);
    const inadimplentes = new Set(["atrasado", "vencido", "pendente"]);
    const presentes = new Set(["presente", "reposicao"]);
    const map = new Map<string, QualidadeOrigem>();

    for (const p of pacientesOrigem ?? []) {
      const key = `${p.canal_origem_id ?? "sem-canal"}|${p.campanha_origem_id ?? "sem-campanha"}`;
      const cur = map.get(key) ?? {
        key,
        canalId: p.canal_origem_id,
        campanhaId: p.campanha_origem_id,
        canal: canais.get(p.canal_origem_id) ?? "Sem canal",
        campanha: campanhas.get(p.campanha_origem_id) ?? "Sem campanha",
        pacientesConvertidos: 0,
        pacientesAtivos: 0,
        abandonoCancelamento: 0,
        receitaRecebida: 0,
        inadimplenciaValor: 0,
        frequencias: 0,
        presencas: 0,
      };
      cur.pacientesConvertidos += 1;
      if (p.status === "ativo") cur.pacientesAtivos += 1;
      if (["inativo", "cancelado", "abandono", "abandonou"].includes(p.status))
        cur.abandonoCancelamento += 1;
      map.set(key, cur);
    }

    const pacienteGrupo = new Map(
      (pacientesOrigem ?? []).map((p) => [
        p.id,
        `${p.canal_origem_id ?? "sem-canal"}|${p.campanha_origem_id ?? "sem-campanha"}`,
      ]),
    );
    for (const pg of pagamentosOrigem ?? []) {
      const grupo = pacienteGrupo.get(pg.paciente_id);
      const cur = grupo ? map.get(grupo) : null;
      if (!cur) continue;
      if (recebidos.has(pg.status))
        cur.receitaRecebida += Number(pg.valor_recebido ?? pg.valor ?? 0);
      if (inadimplentes.has(pg.status)) cur.inadimplenciaValor += Number(pg.valor ?? 0);
    }
    for (const l of lancamentosOrigem ?? []) {
      const grupo = pacienteGrupo.get(l.paciente_id);
      const cur = grupo ? map.get(grupo) : null;
      if (!cur || l.tipo !== "receita") continue;
      if (recebidos.has(l.status)) cur.receitaRecebida += Number(l.valor ?? 0);
      if (inadimplentes.has(l.status)) cur.inadimplenciaValor += Number(l.valor ?? 0);
    }
    for (const f of frequenciasOrigem ?? []) {
      const grupo = pacienteGrupo.get(f.paciente_id);
      const cur = grupo ? map.get(grupo) : null;
      if (!cur) continue;
      cur.frequencias += 1;
      if (presentes.has(f.tipo)) cur.presencas += 1;
    }

    return Array.from(map.values())
      .map((v) => ({
        ...v,
        ticketMedio: v.pacientesConvertidos ? v.receitaRecebida / v.pacientesConvertidos : 0,
        frequenciaMedia: v.frequencias ? (v.presencas / v.frequencias) * 100 : null,
        retencao: v.pacientesConvertidos ? (v.pacientesAtivos / v.pacientesConvertidos) * 100 : 0,
        alerta:
          v.pacientesConvertidos >= 3 &&
          (v.receitaRecebida / v.pacientesConvertidos < 200 ||
            v.pacientesAtivos / v.pacientesConvertidos < 0.5),
      }))
      .sort(
        (a, b) =>
          b.pacientesConvertidos - a.pacientesConvertidos || b.receitaRecebida - a.receitaRecebida,
      );
  })();

  const porResponsavel = (() => {
    const map = new Map<string, { total: number; convertidos: number }>();
    for (const l of leads ?? []) {
      const nome = l.responsavel?.nome ?? "Sem responsável";
      const cur = map.get(nome) ?? { total: 0, convertidos: 0 };
      cur.total += 1;
      if (pacientesPorLead.has(l.id)) cur.convertidos += 1;
      map.set(nome, cur);
    }
    return Array.from(map.entries())
      .map(([responsavel, v]) => ({ responsavel, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Resumo do período</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={gerar.isPending}
            onClick={() => gerar.mutate()}
          >
            {gerar.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            )}
            Gerar tarefas
          </Button>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODOS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(leadsEstagnados.length > 0 || rotinasPendentes.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {leadsEstagnados.length > 0 && (
            <Card className="glass border-brand-yellow/60">
              <CardContent className="flex items-center gap-3 py-3">
                <AlertTriangle className="h-5 w-5 text-brand-yellow shrink-0" />
                <p className="text-sm">
                  <strong>{leadsEstagnados.length}</strong> lead(s) sem contato há 7 dias ou mais —
                  veja o Pipeline ou gere as tarefas.
                </p>
              </CardContent>
            </Card>
          )}
          {rotinasPendentes.length > 0 && (
            <Card className="glass border-brand/30">
              <CardContent className="flex items-center gap-3 py-3">
                <ListChecks className="h-5 w-5 text-brand shrink-0" />
                <p className="text-sm">
                  <strong>{rotinasPendentes.length}</strong> rotina(s) pendente(s) no período —
                  confira a aba Rotinas.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Leads no período"
          value={String(leadsPeriodo.length)}
          tone="brand"
          delay={40}
        />
        <Kpi
          icon={Target}
          label="Taxa de conversão"
          value={`${taxaConversao.toFixed(0)}%`}
          tone="success"
          delay={90}
        />
        <Kpi
          icon={TrendingUp}
          label="Leads em aberto"
          value={String(leadsAbertos.length)}
          tone="muted"
          delay={140}
        />
        <Kpi
          icon={AlertTriangle}
          label="Sem contato 7+ dias"
          value={String(leadsEstagnados.length)}
          tone={leadsEstagnados.length > 0 ? "danger" : "muted"}
          delay={190}
        />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Custo por lead (geral)"
          value={custoPorLead != null ? currency(custoPorLead) : "—"}
          tone="warning"
          delay={240}
        />
        <Kpi
          icon={Clock}
          label="Ciclo médio de fechamento"
          value={cicloMedio != null ? `${cicloMedio.toFixed(0)} dias` : "—"}
          tone="brand"
          delay={290}
        />
        <Kpi
          label="Convertidos no período"
          value={String(convertidosPeriodo.length)}
          tone="success"
          delay={340}
        />
        <Kpi
          label="Total de leads (geral)"
          value={String(leads?.length ?? 0)}
          tone="muted"
          delay={390}
        />
      </div>

      <IndicadoresGerais />

      <Card className="glass card-lift animate-fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-brand" />
            Métricas por canal — {PERIODOS[periodo].toLowerCase()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadsSemOrigem > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-yellow/15 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-brand-yellow" />
              <span><strong>{leadsSemOrigem}</strong> lead(s) do período sem canal de origem — cadastre a origem para não distorcer a análise.</span>
            </div>
          )}
          {metricasCanal.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left">Canal</th>
                    <th className="py-2 px-3 text-right">Leads</th>
                    <th className="py-2 px-3 text-right">Convertidos</th>
                    <th className="py-2 px-3 text-right">Taxa</th>
                    <th className="py-2 px-3 text-right">Custo</th>
                    <th className="py-2 px-3 text-right" title="Custo por lead">CPL</th>
                    <th className="py-2 px-3 text-right" title="Custo de aquisição por paciente">CAC</th>
                    <th className="py-2 pl-3 text-right">Ciclo médio</th>
                  </tr>
                </thead>
                <tbody>
                  {metricasCanal.map((m) => (
                    <tr key={m.canalId ?? "sem"} className={m.canalId ? "border-b" : "border-b bg-muted/30"}>
                      <td className="py-3 pr-3 font-medium">{m.canal}</td>
                      <td className="py-3 px-3 text-right">{m.leads}</td>
                      <td className="py-3 px-3 text-right">{m.convertidos}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={m.taxa >= 30 ? "text-emerald-600 font-medium" : m.taxa > 0 ? "" : "text-muted-foreground"}>
                          {m.taxa.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">{m.custo > 0 ? currency(m.custo) : "—"}</td>
                      <td className="py-3 px-3 text-right">{m.cpl != null ? currency(m.cpl) : "—"}</td>
                      <td className="py-3 px-3 text-right">{m.cac != null ? currency(m.cac) : "—"}</td>
                      <td className="py-3 pl-3 text-right">{m.ciclo != null ? `${m.ciclo.toFixed(0)} d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem leads no período para comparar canais.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass card-lift animate-fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-brand" />
            Origem dos pacientes — qualidade comercial e clínica
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualidadeOrigem.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left">Canal / campanha</th>
                    <th className="py-2 px-3 text-right">Convertidos</th>
                    <th className="py-2 px-3 text-right">Ativos</th>
                    <th className="py-2 px-3 text-right">Receita</th>
                    <th className="py-2 px-3 text-right">Ticket médio</th>
                    <th className="py-2 px-3 text-right">Inadimplência</th>
                    <th className="py-2 px-3 text-right">Frequência</th>
                    <th className="py-2 pl-3 text-right">Aband./cancel.</th>
                  </tr>
                </thead>
                <tbody>
                  {qualidadeOrigem.map((o) => (
                    <tr key={o.key} className={o.alerta ? "border-b bg-destructive/5" : "border-b"}>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{o.canal}</div>
                        <div className="text-xs text-muted-foreground">{o.campanha}</div>
                        {o.alerta && (
                          <div className="mt-1 text-xs font-medium text-destructive">
                            Alto volume com baixa retenção ou receita
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{o.pacientesConvertidos}</td>
                      <td className="py-3 px-3 text-right">
                        {o.pacientesAtivos}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({o.retencao.toFixed(0)}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">{currency(o.receitaRecebida)}</td>
                      <td className="py-3 px-3 text-right">{currency(o.ticketMedio)}</td>
                      <td className="py-3 px-3 text-right">{currency(o.inadimplenciaValor)}</td>
                      <td className="py-3 px-3 text-right">
                        {o.frequenciaMedia != null ? `${o.frequenciaMedia.toFixed(0)}%` : "—"}
                      </td>
                      <td className="py-3 pl-3 text-right">{o.abandonoCancelamento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              Sem pacientes convertidos com origem no período.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="glass card-lift animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base">Funil de conversão (todas as etapas)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funil} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={130}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="quantidade" radius={[0, 6, 6, 0]}>
                  {funil.map((f, i) => (
                    <Cell key={i} fill={f.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass card-lift animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base">
              Leads por canal — {PERIODOS[periodo].toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {porCanal.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porCanal}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => e.name}
                  >
                    {porCanal.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">
                Sem leads no período.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="glass card-lift animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base">Leads criados — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={serieTemporal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#064570"
                  strokeWidth={2.5}
                  dot={{ fill: "#5585b1", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass card-lift animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base">Leads por responsável</CardTitle>
          </CardHeader>
          <CardContent>
            {porResponsavel.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porResponsavel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="responsavel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" fill="#5585b1" name="Total" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="convertidos"
                    fill="#10b981"
                    name="Convertidos"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">
                Sem dados suficientes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "brand",
  delay,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "brand" | "success" | "danger" | "warning" | "muted";
  delay?: number;
}) {
  const toneClasses: Record<string, string> = {
    brand: "gradient-brand text-white",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-destructive/15 text-destructive",
    warning: "bg-brand-yellow/40 text-foreground",
    muted: "bg-secondary text-foreground",
  };
  return (
    <Card
      className="glass card-lift animate-fade-up"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        {Icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-soft shrink-0 ${toneClasses[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
