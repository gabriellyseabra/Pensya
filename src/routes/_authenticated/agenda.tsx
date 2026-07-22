import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DataDrawer } from "@/components/shared/DataDrawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Calendar as CalIcon,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Filter,
  X,
  User,
  Clock,
  MapPin,
  ExternalLink,
  ClipboardList,
  FileText,
  Ban,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { SessaoDialog } from "@/components/prontuario/SessaoDialog";
import { AtendimentoQuickInfo } from "@/components/agenda/AtendimentoQuickInfo";
import { ReporFaltaDialog } from "@/components/paciente/ReporFaltaDialog";
import { consumirReposicaoPendente } from "@/lib/frequencia";
import { toast } from "sonner";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type ViewMode = "dia" | "semana" | "mes";

type Filtros = {
  profissional_id?: string;
  modalidade_id?: string;
  local_id?: string;
  paciente_id?: string;
  status_id?: string;
  especialidade_id?: string;
};

const HOUR_START = 7;
const HOUR_END = 21;
const PX_PER_HOUR = 76;

/* ============ Layout de eventos sobrepostos (mesmo horário, profissionais diferentes) ============ */
function layoutDayEvents<T extends { inicio: string; fim: string }>(
  events: T[],
): { event: T; col: number; totalCols: number; span: number }[] {
  const sorted = [...events].sort(
    (a, b) => parseISO(a.inicio).getTime() - parseISO(b.inicio).getTime(),
  );
  const result: { event: T; col: number; totalCols: number; span: number }[] = [];
  let cluster: { event: T; col: number }[] = [];
  let clusterEnd = -Infinity;
  let colEnds: number[] = [];

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const totalCols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      const s = parseISO(c.event.inicio).getTime();
      const e = parseISO(c.event.fim).getTime();
      // Expande o card para as colunas livres à direita durante todo o seu intervalo,
      // para não desperdiçar largura quando não há conflito real naquele horário.
      let span = 1;
      for (let nc = c.col + 1; nc < totalCols; nc++) {
        const ocupada = cluster.some(
          (o) => o !== c && o.col === nc &&
            parseISO(o.event.inicio).getTime() < e && parseISO(o.event.fim).getTime() > s,
        );
        if (ocupada) break;
        span++;
      }
      result.push({ event: c.event, col: c.col, totalCols, span });
    }
    cluster = [];
  };

  for (const ev of sorted) {
    const startMs = parseISO(ev.inicio).getTime();
    const endMs = parseISO(ev.fim).getTime();

    if (startMs >= clusterEnd) {
      flushCluster();
      colEnds = [];
      clusterEnd = -Infinity;
    }

    let col = colEnds.findIndex((end) => end <= startMs);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMs);
    } else {
      colEnds[col] = endMs;
    }

    cluster.push({ event: ev, col });
    clusterEnd = Math.max(clusterEnd, endMs);
  }
  flushCluster();

  return result;
}

/* ============ Status de frequência (registrado no painel do paciente) ============ */
type FreqStatus = "confirmada" | "falta_reposicao" | "falta_sem_reposicao" | "cancelado";

const FREQ_STATUS_META: Record<
  FreqStatus,
  { Icon: typeof CheckCircle2; cls: string; label: string }
> = {
  confirmada: { Icon: CheckCircle2, cls: "text-emerald-600", label: "Presença confirmada" },
  falta_reposicao: { Icon: XCircle, cls: "text-amber-600", label: "Falta justificada (gera reposição)" },
  falta_sem_reposicao: { Icon: Ban, cls: "text-red-600", label: "Falta não justificada" },
  cancelado: { Icon: Ban, cls: "text-muted-foreground", label: "Cancelado pelo profissional" },
};

function mapFreqTipoToStatus(tipo?: string | null): FreqStatus | null {
  switch (tipo) {
    case "presente":
    case "reposicao":
      return "confirmada";
    case "falta_justificada":
      return "falta_reposicao";
    case "falta_nao_justificada":
      return "falta_sem_reposicao";
    case "cancelado_profissional":
      return "cancelado";
    default:
      return null;
  }
}

type FreqMap = { byAtendimento: Record<string, any>; byPacienteData: Record<string, any> };

function resolveFreqStatus(a: any, map?: FreqMap | null): FreqStatus | null {
  if (!map) return null;
  const key = `${a.paciente_id}|${format(parseISO(a.inicio), "yyyy-MM-dd")}`;
  const rec = map.byAtendimento[a.id] ?? map.byPacienteData[key];
  return rec ? mapFreqTipoToStatus(rec.tipo) : null;
}

function FreqBadgeIcon({
  status,
  size = 12,
  className = "",
}: {
  status: FreqStatus;
  size?: number;
  className?: string;
}) {
  const meta = FREQ_STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span title={meta.label} className="inline-flex shrink-0">
      <Icon className={`${meta.cls} shrink-0 ${className}`} style={{ width: size, height: size }} />
    </span>
  );
}

function PacienteAvatar({
  paciente,
  size = 16,
}: {
  paciente?: { nome?: string; foto_url?: string | null } | null;
  size?: number;
}) {
  const iniciais = (paciente?.nome ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand/15 text-brand font-semibold overflow-hidden shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.45) }}
    >
      {paciente?.foto_url ? (
        <img src={paciente.foto_url} alt="" className="w-full h-full object-cover" />
      ) : (
        iniciais
      )}
    </span>
  );
}

function ProfAvatar({
  prof,
  size = 40,
}: {
  prof?: { nome?: string; cor?: string | null; avatar_url?: string | null } | null;
  size?: number;
}) {
  const iniciais = (prof?.nome ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const cor = prof?.cor || "hsl(var(--brand))";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        backgroundColor: prof?.avatar_url ? undefined : cor,
      }}
    >
      {prof?.avatar_url ? (
        <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        iniciais
      )}
    </span>
  );
}

function AgendaPage() {
  const [ref, setRef] = useState(new Date());
  const [view, setView] = useState<ViewMode>("semana");
  const [filtros, setFiltros] = useState<Filtros>({});
  const [mostrarLateral, setMostrarLateral] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("agenda:lateral") !== "0";
  });
  const toggleLateral = () => {
    setMostrarLateral((v) => {
      const novo = !v;
      if (typeof window !== "undefined") localStorage.setItem("agenda:lateral", novo ? "1" : "0");
      return novo;
    });
  };
  const [selected, setSelected] = useState<any | null>(null);
  const [novoSlot, setNovoSlot] = useState<{
    data: string;
    hora_inicio: string;
    hora_fim: string;
  } | null>(null);
  const qc = useQueryClient();

  const { start, end } = useMemo(() => {
    if (view === "dia") return { start: ref, end: ref };
    if (view === "semana")
      return {
        start: startOfWeek(ref, { weekStartsOn: 1 }),
        end: endOfWeek(ref, { weekStartsOn: 1 }),
      };
    const mStart = startOfMonth(ref);
    const mEnd = endOfMonth(ref);
    return {
      start: startOfWeek(mStart, { weekStartsOn: 1 }),
      end: endOfWeek(mEnd, { weekStartsOn: 1 }),
    };
  }, [view, ref]);

  // Profissionais filtrados por especialidade (quando ativo)
  const { data: profissionaisEspec } = useQuery({
    queryKey: ["prof-by-espec", filtros.especialidade_id],
    queryFn: async () => {
      if (!filtros.especialidade_id) return null;
      const { data } = await supabase
        .from("profissionais_consultorio_especialidades")
        .select("profissional_id")
        .eq("especialidade_id", filtros.especialidade_id);
      return (data ?? []).map((r: any) => r.profissional_id);
    },
    enabled: !!filtros.especialidade_id,
  });

  const { data: atendimentos } = useQuery({
    queryKey: ["agenda", view, start.toISOString(), end.toISOString(), filtros, profissionaisEspec],
    queryFn: async () => {
      let q = supabase
        .from("atendimentos")
        .select(
          `
          id, inicio, fim, observacoes, paciente_id, profissional_id, local_id, modalidade_id,
          status_frequencia_id, confirmado_em, confirmacao_enviada_em, recorrencia, recorrencia_grupo,
          paciente:pacientes(id, nome, foto_url, data_nascimento),
          profissional:profissionais_consultorio(id, nome, cor),
          modalidade:modalidades(id, nome, cor),
          local:locais(id, nome),
          status:status_frequencia(id, nome, cor)
        `,
        )
        .gte(
          "inicio",
          new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString(),
        )
        .lte(
          "inicio",
          new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString(),
        )
        .order("inicio");
      if (filtros.profissional_id) q = q.eq("profissional_id", filtros.profissional_id);
      if (filtros.modalidade_id) q = q.eq("modalidade_id", filtros.modalidade_id);
      if (filtros.local_id) q = q.eq("local_id", filtros.local_id);
      if (filtros.paciente_id) q = q.eq("paciente_id", filtros.paciente_id);
      if (filtros.status_id) q = q.eq("status_frequencia_id", filtros.status_id);
      if (filtros.especialidade_id) {
        const ids = profissionaisEspec ?? [];
        if (ids.length === 0) return [];
        q = q.in("profissional_id", ids);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: !filtros.especialidade_id || profissionaisEspec !== undefined,
  });

  const pacienteIds = useMemo(
    () => Array.from(new Set((atendimentos ?? []).map((a) => a.paciente_id).filter(Boolean))),
    [atendimentos],
  );
  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis-agenda", pacienteIds.join(",")],
    queryFn: async () => {
      if (pacienteIds.length === 0) return {};
      const { data } = await supabase
        .from("responsaveis")
        .select("paciente_id, nome, telefone, principal")
        .in("paciente_id", pacienteIds);
      const map: Record<string, { nome: string; telefone: string | null }> = {};
      (data ?? []).forEach((r) => {
        if (!map[r.paciente_id] || r.principal) {
          map[r.paciente_id] = { nome: r.nome, telefone: r.telefone };
        }
      });
      return map;
    },
    enabled: pacienteIds.length > 0,
  });

  // Frequência (presença/falta) registrada no painel do paciente, para exibir na agenda
  const { data: frequenciaMap } = useQuery({
    queryKey: ["freq-agenda", pacienteIds.join(","), start.toISOString(), end.toISOString()],
    queryFn: async (): Promise<FreqMap> => {
      const { data } = await supabase
        .from("frequencia")
        .select("id, paciente_id, atendimento_id, data_referencia, tipo, reposto_em")
        .in("paciente_id", pacienteIds)
        .gte("data_referencia", format(start, "yyyy-MM-dd"))
        .lte("data_referencia", format(end, "yyyy-MM-dd"));
      const byAtendimento: Record<string, any> = {};
      const byPacienteData: Record<string, any> = {};
      (data ?? []).forEach((r) => {
        if (r.atendimento_id) byAtendimento[r.atendimento_id] = r;
        else byPacienteData[`${r.paciente_id}|${r.data_referencia}`] = r;
      });
      return { byAtendimento, byPacienteData };
    },
    enabled: pacienteIds.length > 0,
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      atendimentoId,
      novoInicio,
      novoFim,
    }: {
      atendimentoId: string;
      novoInicio: Date;
      novoFim: Date;
    }) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({
          inicio: novoInicio.toISOString(),
          fim: novoFim.toISOString(),
        })
        .eq("id", atendimentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento reagendado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleMove = (atendimentoId: string, dia: Date, hora: number, minuto: number) => {
    const original = (atendimentos ?? []).find((a) => a.id === atendimentoId);
    if (!original) return;
    const duracaoMin = differenceInMinutes(parseISO(original.fim), parseISO(original.inicio));
    const novoInicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto);
    if (novoInicio.getTime() === parseISO(original.inicio).getTime()) return;
    const novoFim = new Date(novoInicio.getTime() + duracaoMin * 60000);
    moveMutation.mutate({ atendimentoId, novoInicio, novoFim });
  };

  // Profissionais visíveis no período (para a legenda de cores)
  const profissionaisLegenda = useMemo(() => {
    const list: { id: string; nome: string; cor?: string }[] = [];
    (atendimentos ?? []).forEach((a) => {
      const prof = a.profissional;
      if (prof?.id && !list.find((p) => p.id === prof.id)) {
        list.push({ id: prof.id, nome: prof.nome, cor: prof.cor ?? undefined });
      }
    });
    return list;
  }, [atendimentos]);

  const days = useMemo(() => {
    if (view === "dia") return [ref];
    if (view === "semana")
      return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(ref, { weekStartsOn: 1 }), i));
    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  }, [view, ref, start, end]);

  function whatsappLink(at: any, tipo: "confirmacao" | "lembrete") {
    const resp = responsaveis?.[at.paciente_id];
    if (!resp?.telefone) return null;
    const dataHora = format(parseISO(at.inicio), "dd/MM 'às' HH:mm", { locale: ptBR });
    const msg =
      tipo === "confirmacao"
        ? `Olá, ${resp.nome}! Confirmando o atendimento de *${at.paciente?.nome}* em *${dataHora}*${at.profissional?.nome ? ` com ${at.profissional.nome}` : ""}. Pode confirmar? 💙`
        : `Olá, ${resp.nome}! Lembrete: amanhã *${at.paciente?.nome}* tem atendimento em *${dataHora}*${at.profissional?.nome ? ` com ${at.profissional.nome}` : ""}. Até lá! 💙`;
    const phone = resp.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : "55" + phone;
    return `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["agenda"] });

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) return setRef(new Date());
    if (view === "dia") setRef(addDays(ref, dir));
    else if (view === "semana") setRef(dir === 1 ? addWeeks(ref, 1) : subWeeks(ref, 1));
    else setRef(dir === 1 ? addMonths(ref, 1) : subMonths(ref, 1));
  };

  const headerLabel =
    view === "mes"
      ? format(ref, "MMMM 'de' yyyy", { locale: ptBR })
      : view === "semana"
        ? `${format(start, "dd 'de' MMM", { locale: ptBR })} – ${format(end, "dd 'de' MMM yyyy", { locale: ptBR })}`
        : format(ref, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Cabeçalho no estilo painel */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-lilac text-lilac-foreground">
              <CalIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-display leading-none tracking-tight">Agenda</h1>
              <p className="mt-1 text-sm capitalize text-muted-foreground">{headerLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border border-border/60 bg-background/60 p-0.5">
              <button
                onClick={() => navigate(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate(0)}
                className="rounded-full px-3 py-1 text-xs font-medium hover:bg-accent"
              >
                Hoje
              </button>
              <button
                onClick={() => navigate(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex rounded-full bg-muted p-0.5 text-xs">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                    view === v ? "bg-foreground text-background" : "text-muted-foreground"
                  }`}
                >
                  {v === "mes" ? "Mês" : v}
                </button>
              ))}
            </div>

            <FiltrosPopover filtros={filtros} setFiltros={setFiltros} />
            <button
              onClick={toggleLateral}
              title={mostrarLateral ? "Ocultar painel lateral" : "Mostrar painel lateral"}
              className="hidden xl:flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:bg-accent"
            >
              {mostrarLateral ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
            <AtendimentoDialog mode="create" onSaved={refresh} />
          </div>
        </div>

        {/* Resumo do período + legenda de profissionais */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lilac-soft/40 px-2.5 py-1 font-medium text-lilac-foreground">
            <CalIcon className="h-3.5 w-3.5" />
            {(atendimentos ?? []).length} atendimento{(atendimentos ?? []).length === 1 ? "" : "s"}{" "}
            no período
          </span>
          {profissionaisLegenda.length > 1 && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              {profissionaisLegenda.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.cor || "hsl(var(--brand))" }}
                  />
                  {p.nome}
                </span>
              ))}
            </>
          )}
        </div>
      </Card>

      <div className={`grid grid-cols-1 gap-4 ${mostrarLateral ? "xl:grid-cols-[minmax(0,1fr)_308px]" : ""}`}>
        <Card className="overflow-hidden p-0">
          {view === "mes" ? (
            <MonthView
              days={days}
              ref={ref}
              atendimentos={atendimentos ?? []}
              onSelect={setSelected}
              frequenciaMap={frequenciaMap}
            />
          ) : (
            <TimeGridView
              days={days}
              atendimentos={atendimentos ?? []}
              onSelect={setSelected}
              onEmptyClick={(data, hora_inicio, hora_fim) =>
                setNovoSlot({ data, hora_inicio, hora_fim })
              }
              onMove={handleMove}
              frequenciaMap={frequenciaMap}
            />
          )}
        </Card>

        {mostrarLateral && (
          <AgendaSidebar
            ref={ref}
            onPickDay={(d) => {
              setRef(d);
              setView("dia");
            }}
            view={view}
            atendimentos={atendimentos ?? []}
            onSelect={setSelected}
          />
        )}
      </div>

      {selected && (
        <AtendimentoDrawer
          atendimento={selected}
          waConfirm={whatsappLink(selected, "confirmacao")}
          waLembrete={whatsappLink(selected, "lembrete")}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refresh();
            setSelected(null);
          }}
        />
      )}

      {novoSlot && (
        <AtendimentoDialog
          mode="create"
          onSaved={() => {
            refresh();
            setNovoSlot(null);
          }}
          onCloseExternal={() => setNovoSlot(null)}
          forceOpen
          slotInicial={novoSlot}
        />
      )}
    </div>
  );
}

/* ============ Sidebar da agenda (mini calendário + pacientes por profissional) ============ */
function AgendaSidebar({
  ref,
  onPickDay,
  view,
  atendimentos,
  onSelect,
}: {
  ref: Date;
  onPickDay: (d: Date) => void;
  view: ViewMode;
  atendimentos: any[];
  onSelect: (a: any) => void;
}) {
  const [miniRef, setMiniRef] = useState(ref);

  // Mantém o mini-calendário sincronizado quando a agenda muda de período
  useEffect(() => {
    setMiniRef(ref);
  }, [ref]);

  const miniDays = useMemo(() => {
    const mStart = startOfWeek(startOfMonth(miniRef), { weekStartsOn: 1 });
    const mEnd = endOfWeek(endOfMonth(miniRef), { weekStartsOn: 1 });
    const total = Math.round((mEnd.getTime() - mStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: total }, (_, i) => addDays(mStart, i));
  }, [miniRef]);

  // Dias com atendimento no mês exibido (bolinha indicadora)
  const diasComEvento = useMemo(() => {
    const set = new Set<string>();
    atendimentos.forEach((a) => set.add(format(parseISO(a.inicio), "yyyy-MM-dd")));
    return set;
  }, [atendimentos]);

  // Pacientes agrupados por profissional no período
  const porProfissional = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; cor?: string; pacientes: Map<string, any>; total: number }
    >();
    atendimentos.forEach((a) => {
      const prof = a.profissional;
      const key = prof?.id ?? "__sem__";
      if (!map.has(key)) {
        map.set(key, {
          nome: prof?.nome ?? "Sem profissional",
          cor: prof?.cor ?? undefined,
          pacientes: new Map(),
          total: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (a.paciente?.id && !entry.pacientes.has(a.paciente.id)) {
        entry.pacientes.set(a.paciente.id, a.paciente);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [atendimentos]);

  const hoje = new Date();
  const weekLabels = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
      {/* Mini calendário */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold capitalize">
            {format(miniRef, "MMMM yyyy", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setMiniRef(subMonths(miniRef, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMiniRef(addMonths(miniRef, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekLabels.map((w, i) => (
            <span key={i} className="text-[10px] font-medium text-muted-foreground">
              {w}
            </span>
          ))}
          {miniDays.map((d) => {
            const isToday = isSameDay(d, hoje);
            const selecionado = isSameDay(d, ref) && view === "dia";
            const inMonth = isSameMonth(d, miniRef);
            const temEvento = diasComEvento.has(format(d, "yyyy-MM-dd"));
            return (
              <button
                key={d.toISOString()}
                onClick={() => onPickDay(d)}
                className={`relative flex h-8 items-center justify-center rounded-full text-xs transition-colors ${
                  selecionado
                    ? "bg-foreground font-semibold text-background"
                    : isToday
                      ? "bg-lilac-soft/50 font-semibold text-lilac-foreground"
                      : inMonth
                        ? "text-foreground hover:bg-accent"
                        : "text-muted-foreground/40 hover:bg-accent"
                }`}
              >
                {format(d, "d")}
                {temEvento && !selecionado && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Pacientes por profissional */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-lilac text-lilac-foreground">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">Por profissional</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pacientes no período</p>
          </div>
        </div>
        {porProfissional.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhum atendimento no período.
          </p>
        ) : (
          <div className="space-y-3">
            {porProfissional.map((p, i) => (
              <div key={i}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.cor || "hsl(var(--brand))" }}
                  />
                  <p className="flex-1 truncate text-xs font-medium">{p.nome}</p>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {p.pacientes.size}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 pl-4">
                  {Array.from(p.pacientes.values())
                    .slice(0, 8)
                    .map((pac: any) => (
                      <button
                        key={pac.id}
                        title={pac.nome}
                        onClick={() => {
                          const at = atendimentos.find((a) => a.paciente?.id === pac.id);
                          if (at) onSelect(at);
                        }}
                        className="transition-transform hover:-translate-y-0.5"
                      >
                        <PacienteAvatar paciente={pac} size={26} />
                      </button>
                    ))}
                  {p.pacientes.size > 8 && (
                    <span className="flex h-[26px] items-center text-[10px] text-muted-foreground">
                      +{p.pacientes.size - 8}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============ Time grid (Dia / Semana) ============ */
function TimeGridView({
  days,
  atendimentos,
  onSelect,
  onEmptyClick,
  onMove,
  frequenciaMap,
}: {
  days: Date[];
  atendimentos: any[];
  onSelect: (a: any) => void;
  onEmptyClick?: (data: string, hora_inicio: string, hora_fim: string) => void;
  onMove?: (atendimentoId: string, dia: Date, hora: number, minuto: number) => void;
  frequenciaMap?: FreqMap;
}) {
  const totalHours = HOUR_END - HOUR_START;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to 8h on mount
    if (containerRef.current) containerRef.current.scrollTop = PX_PER_HOUR;
  }, []);

  const nowOffset = (() => {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    if (hours < HOUR_START || hours > HOUR_END) return null;
    return (hours - HOUR_START) * PX_PER_HOUR;
  })();

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* Header days — chips arredondados, hoje em destaque */}
      <div className="flex shrink-0 items-stretch pb-3 pt-1">
        <div className="w-14 shrink-0" />
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((d) => {
            const hoje = isSameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                className={`mx-1 flex flex-col items-center justify-center rounded-2xl py-2 transition-colors ${
                  hoje ? "bg-foreground text-background shadow-sm" : "bg-muted/60 text-foreground"
                }`}
              >
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider ${hoje ? "text-background/70" : "text-muted-foreground"}`}
                >
                  {format(d, "EEE", { locale: ptBR })}
                </span>
                <span className="text-xl font-semibold leading-tight">{format(d, "dd")}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* Hours column */}
          <div className="w-14 shrink-0">
            {Array.from({ length: totalHours }, (_, i) => (
              <div
                key={i}
                className="pr-2 text-right text-[10px] font-medium text-muted-foreground"
                style={{ height: PX_PER_HOUR }}
              >
                {String(HOUR_START + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div
            className={`flex-1 grid relative`}
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((d) => {
              const dayEvents = atendimentos.filter((a) => isSameDay(parseISO(a.inicio), d));
              const dayKey = d.toISOString();
              return (
                <div
                  key={d.toISOString()}
                  className={`relative border-r border-border/30 transition-colors last:border-r-0 ${dragOverDay === dayKey ? "bg-brand/10" : ""}`}
                  style={{ height: totalHours * PX_PER_HOUR }}
                  onClick={(e) => {
                    if (!onEmptyClick) return;
                    // ignora clique sobre eventos
                    const target = e.target as HTMLElement;
                    if (target.closest("button")) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const hour = HOUR_START + offsetY / PX_PER_HOUR;
                    const h = Math.max(HOUR_START, Math.min(HOUR_END - 1, Math.floor(hour)));
                    const m = Math.round(((hour - h) * 60) / 30) * 30;
                    const start = `${String(h + (m === 60 ? 1 : 0)).padStart(2, "0")}:${String(m === 60 ? 0 : m).padStart(2, "0")}`;
                    const endH = h + (m === 60 ? 2 : 1);
                    const endStr = `${String(Math.min(HOUR_END, endH)).padStart(2, "0")}:${String(m === 60 ? 0 : m).padStart(2, "0")}`;
                    onEmptyClick(format(d, "yyyy-MM-dd"), start, endStr);
                  }}
                  onDragOver={(e) => {
                    if (!onMove) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverDay !== dayKey) setDragOverDay(dayKey);
                  }}
                  onDragLeave={() => setDragOverDay((cur) => (cur === dayKey ? null : cur))}
                  onDrop={(e) => {
                    if (!onMove) return;
                    e.preventDefault();
                    setDragOverDay(null);
                    const atendimentoId = e.dataTransfer.getData("text/atendimento-id");
                    if (!atendimentoId) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const hour = HOUR_START + offsetY / PX_PER_HOUR;
                    const h = Math.max(HOUR_START, Math.min(HOUR_END - 1, Math.floor(hour)));
                    const m = Math.round(((hour - h) * 60) / 15) * 15;
                    onMove(atendimentoId, d, h + (m === 60 ? 1 : 0), m === 60 ? 0 : m);
                  }}
                >
                  {/* Hour lines */}
                  {Array.from({ length: totalHours }, (_, i) => (
                    <div
                      key={i}
                      className="border-b border-border/25 transition-colors hover:bg-muted/20"
                      style={{ height: PX_PER_HOUR }}
                    />
                  ))}
                  {/* Now indicator */}
                  {isSameDay(d, new Date()) && nowOffset !== null && (
                    <div
                      className="absolute left-0 right-0 z-10 pointer-events-none"
                      style={{ top: nowOffset }}
                    >
                      <div className="h-px bg-red-500" />
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}
                  {/* Events */}
                  {layoutDayEvents(dayEvents).map(({ event: a, col, totalCols, span }) => {
                    const inicio = parseISO(a.inicio);
                    const fim = parseISO(a.fim);
                    const startH = inicio.getHours() + inicio.getMinutes() / 60;
                    const dur = Math.max(0.5, differenceInMinutes(fim, inicio) / 60);
                    const top = Math.max(0, (startH - HOUR_START) * PX_PER_HOUR);
                    const height = dur * PX_PER_HOUR - 2;
                    const cor = a.profissional?.cor || a.modalidade?.cor || "hsl(var(--brand))";
                    const colW = 100 / totalCols;
                    const widthPct = colW * span;
                    const leftPct = col * colW;
                    const freqStatus = resolveFreqStatus(a, frequenciaMap);
                    // Ao passar o mouse, um card estreito (dividindo espaço) expande para a
                    // largura toda do dia, sobrepondo os vizinhos para leitura confortável.
                    const estreito = span < totalCols;
                    const expandido = hoverId === a.id && estreito;
                    return (
                      <button
                        key={a.id}
                        draggable={!!onMove}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/atendimento-id", a.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onMouseEnter={() => setHoverId(a.id)}
                        onMouseLeave={() => setHoverId((cur) => (cur === a.id ? null : cur))}
                        onClick={() => onSelect(a)}
                        className="group absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] ring-1 ring-black/[0.04] transition-all hover:shadow-lg dark:ring-white/10"
                        style={{
                          top,
                          height: expandido ? Math.max(height, 46) : height,
                          left: expandido ? "2px" : `calc(${leftPct}% + 2px)`,
                          width: expandido ? "calc(100% - 4px)" : `calc(${widthPct}% - 4px)`,
                          backgroundColor: expandido
                            ? `color-mix(in oklab, ${cor} 30%, var(--card))`
                            : `color-mix(in oklab, ${cor} 22%, var(--card))`,
                          zIndex: expandido ? 40 : hoverId === a.id ? 30 : 20,
                        }}
                      >
                        {/* Horário de início + nome na mesma linha, para caber em cards estreitos */}
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="shrink-0 text-[10px] font-semibold tabular-nums"
                            style={{ color: `color-mix(in oklab, ${cor} 75%, var(--foreground))` }}
                          >
                            {format(inicio, "HH:mm")}
                          </span>
                          <span className="truncate font-semibold text-foreground">
                            {a.paciente?.nome ?? "—"}
                          </span>
                          {freqStatus && <span className="ml-auto shrink-0"><FreqBadgeIcon status={freqStatus} size={12} /></span>}
                        </div>
                        {(expandido || height > 46) && (
                          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                            <PacienteAvatar paciente={a.paciente} size={16} />
                            <p className="truncate text-[10px] text-muted-foreground">
                              {format(inicio, "HH:mm")}–{format(fim, "HH:mm")}
                              {a.profissional?.nome ? ` · ${a.profissional.nome}` : ""}
                              {a.modalidade?.nome ? ` · ${a.modalidade.nome}` : ""}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Month view ============ */
function MonthView({
  days,
  ref,
  atendimentos,
  onSelect,
  frequenciaMap,
}: {
  days: Date[];
  ref: Date;
  atendimentos: any[];
  onSelect: (a: any) => void;
  frequenciaMap?: FreqMap;
}) {
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center border-r last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: "calc(100vh - 240px)" }}>
        {days.map((d) => {
          const dayItems = atendimentos.filter((a) => isSameDay(parseISO(a.inicio), d));
          const isToday = isSameDay(d, new Date());
          const inMonth = isSameMonth(d, ref);
          return (
            <div
              key={d.toISOString()}
              className={`border-r border-b last:border-r-0 p-1.5 min-h-[100px] ${inMonth ? "" : "bg-muted/20"}`}
            >
              <div
                className={`text-xs font-medium mb-1 ${isToday ? "text-brand" : inMonth ? "" : "text-muted-foreground"}`}
              >
                {format(d, "dd")}
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 4).map((a) => {
                  const cor = a.profissional?.cor || a.modalidade?.cor || "hsl(var(--brand))";
                  const freqStatus = resolveFreqStatus(a, frequenciaMap);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className="w-full truncate rounded-lg px-1.5 py-1 text-left text-[10px] ring-1 ring-black/[0.04] transition-all hover:shadow-sm dark:ring-white/10"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${cor} 22%, var(--card))`,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <PacienteAvatar paciente={a.paciente} size={14} />
                        <span className="flex-1 truncate font-medium text-foreground">
                          <span
                            className="font-semibold"
                            style={{ color: `color-mix(in oklab, ${cor} 75%, var(--foreground))` }}
                          >
                            {format(parseISO(a.inicio), "HH:mm")}
                          </span>{" "}
                          {a.paciente?.nome}
                        </span>
                        {freqStatus && <FreqBadgeIcon status={freqStatus} size={10} />}
                      </span>
                    </button>
                  );
                })}
                {dayItems.length > 4 && (
                  <p className="text-[9px] text-muted-foreground px-1">
                    +{dayItems.length - 4} mais
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Filtros ============ */
function FiltrosPopover({
  filtros,
  setFiltros,
}: {
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: profissionais } = useQuery({
    queryKey: ["prof-mini"],
    queryFn: async () =>
      (await supabase.from("profissionais_consultorio").select("id, nome").eq("ativo", true))
        .data ?? [],
  });
  const { data: modalidades } = useQuery({
    queryKey: ["mod-mini"],
    queryFn: async () =>
      (await supabase.from("modalidades").select("id, nome").eq("ativo", true)).data ?? [],
  });
  const { data: locais } = useQuery({
    queryKey: ["loc-mini"],
    queryFn: async () =>
      (await supabase.from("locais").select("id, nome").eq("ativo", true)).data ?? [],
  });
  const { data: pacientes } = useQuery({
    queryKey: ["pac-mini"],
    queryFn: async () =>
      (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: especialidades } = useQuery({
    queryKey: ["esp-mini"],
    queryFn: async () =>
      (await supabase.from("especialidades").select("id, nome").order("nome")).data ?? [],
  });
  const { data: statusList } = useQuery({
    queryKey: ["status-mini"],
    queryFn: async () =>
      (await supabase.from("status_frequencia").select("id, nome").order("nome")).data ?? [],
  });

  const ativos = Object.values(filtros).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-1.5" /> Filtros
          {ativos > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
              {ativos}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong max-w-sm">
        <DialogHeader>
          <DialogTitle>Filtros da agenda</DialogTitle>
          <DialogDescription>Refine os atendimentos exibidos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <SelectFiltro
            label="Profissional"
            value={filtros.profissional_id}
            options={profissionais ?? []}
            onChange={(v) => setFiltros({ ...filtros, profissional_id: v })}
          />
          <SelectFiltro
            label="Especialidade"
            value={filtros.especialidade_id}
            options={especialidades ?? []}
            onChange={(v) => setFiltros({ ...filtros, especialidade_id: v })}
          />
          <SelectFiltro
            label="Modalidade"
            value={filtros.modalidade_id}
            options={modalidades ?? []}
            onChange={(v) => setFiltros({ ...filtros, modalidade_id: v })}
          />
          <SelectFiltro
            label="Status"
            value={filtros.status_id}
            options={statusList ?? []}
            onChange={(v) => setFiltros({ ...filtros, status_id: v })}
          />
          <SelectFiltro
            label="Local"
            value={filtros.local_id}
            options={locais ?? []}
            onChange={(v) => setFiltros({ ...filtros, local_id: v })}
          />
          <SelectFiltro
            label="Paciente"
            value={filtros.paciente_id}
            options={pacientes ?? []}
            onChange={(v) => setFiltros({ ...filtros, paciente_id: v })}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setFiltros({});
              setOpen(false);
            }}
          >
            <X className="h-4 w-4 mr-1.5" /> Limpar
          </Button>
          <Button onClick={() => setOpen(false)} className="gradient-brand text-white">
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectFiltro({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { id: string; nome: string }[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select
        value={value ?? "__all__"}
        onValueChange={(v) => onChange(v === "__all__" ? undefined : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ============ Drawer lateral do atendimento ============ */
function AtendimentoDrawer({
  atendimento,
  waConfirm,
  waLembrete,
  onClose,
  onChanged,
}: {
  atendimento: any;
  waConfirm: string | null;
  waLembrete: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sessaoTipo, setSessaoTipo] = useState<"avaliacao" | "intervencao" | null>(null);
  const [reporOpen, setReporOpen] = useState(false);
  const qc = useQueryClient();

  const { data: statusList } = useQuery({
    queryKey: ["status-frequencia"],
    queryFn: async () =>
      (await supabase.from("status_frequencia").select("*").order("nome")).data ?? [],
  });

  // Próximos atendimentos do mesmo paciente
  const { data: proximos } = useQuery({
    queryKey: ["proximos-paciente", atendimento.paciente_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select(
          "id, inicio, fim, profissional:profissionais_consultorio(nome, cor), modalidade:modalidades(nome)",
        )
        .eq("paciente_id", atendimento.paciente_id)
        .gte("inicio", new Date().toISOString())
        .neq("id", atendimento.id)
        .order("inicio")
        .limit(5);
      return data ?? [];
    },
  });

  // Resumo do paciente: profissionais vinculados, último atendimento
  const { data: ultimoAtend } = useQuery({
    queryKey: ["ultimo-atend", atendimento.paciente_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("inicio")
        .eq("paciente_id", atendimento.paciente_id)
        .lt("inicio", new Date().toISOString())
        .order("inicio", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status_id: string | null) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({ status_frequencia_id: status_id })
        .eq("id", atendimento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setConfirmado = useMutation({
    mutationFn: async (confirmar: boolean) => {
      const { error } = await supabase
        .from("atendimentos")
        .update({
          confirmado_em: confirmar ? new Date().toISOString() : null,
        })
        .eq("id", atendimento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confirmação atualizada");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarEnviado = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("atendimentos")
        .update({
          confirmacao_enviada_em: new Date().toISOString(),
        })
        .eq("id", atendimento.id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const excluir = useMutation({
    mutationFn: async (escopo: "este" | "grupo") => {
      if (escopo === "grupo" && atendimento.recorrencia_grupo) {
        const { error } = await supabase
          .from("atendimentos")
          .delete()
          .eq("recorrencia_grupo", atendimento.recorrencia_grupo);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("atendimentos").delete().eq("id", atendimento.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Excluído");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Registro de frequência (mesmo lançamento usado no painel do paciente)
  const dataReferencia = format(parseISO(atendimento.inicio), "yyyy-MM-dd");
  const { data: freqAtual } = useQuery({
    queryKey: ["freq-atendimento", atendimento.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("id, tipo, reposto_em, data_referencia")
        .eq("atendimento_id", atendimento.id)
        .maybeSingle();
      if (data) return data;
      const { data: legado } = await supabase
        .from("frequencia")
        .select("id, tipo, reposto_em, data_referencia")
        .eq("paciente_id", atendimento.paciente_id)
        .eq("data_referencia", dataReferencia)
        .is("atendimento_id", null)
        .maybeSingle();
      return legado ?? null;
    },
  });

  const registrarFrequencia = useMutation({
    mutationFn: async ({
      tipo,
      faltaId,
    }: {
      tipo: "presente" | "reposicao" | "falta_justificada" | "falta_nao_justificada" | "cancelado_profissional";
      faltaId?: string | null;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (freqAtual?.id) {
        const { error } = await supabase
          .from("frequencia")
          .update({ tipo, atendimento_id: atendimento.id })
          .eq("id", freqAtual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("frequencia").insert({
          paciente_id: atendimento.paciente_id,
          atendimento_id: atendimento.id,
          data_referencia: dataReferencia,
          tipo,
          created_by: user?.id,
        });
        if (error) throw error;
      }
      // Reposição consome a falta justificada escolhida (ou a mais antiga).
      if (tipo === "reposicao") {
        await consumirReposicaoPendente(atendimento.paciente_id, dataReferencia, faltaId);
      }
      const nomeAlvo =
        tipo === "presente" || tipo === "reposicao"
          ? /presen|realiz|reposi/i
          : tipo === "falta_justificada"
            ? /justif/i
            : tipo === "falta_nao_justificada"
              ? /^falta$/i
              : /remarc|cancel/i;
      const statusAlvo = statusList?.find((s) => nomeAlvo.test(s.nome));
      if (statusAlvo) {
        await supabase
          .from("atendimentos")
          .update({ status_frequencia_id: statusAlvo.id })
          .eq("id", atendimento.id);
      }
    },
    onSuccess: () => {
      toast.success("Frequência registrada.");
      qc.invalidateQueries({ queryKey: ["freq-atendimento", atendimento.id] });
      qc.invalidateQueries({ queryKey: ["freq-agenda"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["drawer-freq", atendimento.paciente_id] });
      qc.invalidateQueries({ queryKey: ["faltas-pendentes", atendimento.paciente_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing) {
    return (
      <AtendimentoDialog
        mode="edit"
        atendimento={atendimento}
        onSaved={onChanged}
        onCloseExternal={() => setEditing(false)}
        forceOpen
      />
    );
  }

  const paciente = atendimento.paciente;
  const iniciais = (paciente?.nome ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s: string) => s[0])
    .join("")
    .toUpperCase();
  const idade = paciente?.data_nascimento
    ? Math.floor(
        (new Date().getTime() - new Date(paciente.data_nascimento).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <DataDrawer
      open
      onOpenChange={(o) => !o && onClose()}
      title="Atendimento"
      description={format(parseISO(atendimento.inicio), "EEEE, dd 'de' MMMM 'às' HH:mm", {
        locale: ptBR,
      })}
      width="lg"
      footer={
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
                <AlertDialogDescription>
                  {atendimento.recorrencia_grupo
                    ? "Este atendimento faz parte de uma série recorrente. Escolha o que excluir."
                    : "Esta ação não pode ser desfeita."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                {atendimento.recorrencia_grupo && (
                  <AlertDialogAction
                    onClick={() => excluir.mutate("grupo")}
                    className="bg-destructive"
                  >
                    Excluir toda a série
                  </AlertDialogAction>
                )}
                <AlertDialogAction
                  onClick={() => excluir.mutate("este")}
                  className="bg-destructive"
                >
                  Excluir somente este
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button size="sm" onClick={onClose} className="gradient-brand text-white">
              Fechar
            </Button>
          </div>
        </div>
      }
    >
      {/* Painel do paciente */}
      <div className="rounded-xl border bg-muted/30 p-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand/15 text-brand flex items-center justify-center font-semibold overflow-hidden shrink-0">
          {paciente?.foto_url ? (
            <img
              src={paciente.foto_url}
              alt={paciente.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            iniciais
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{paciente?.nome ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {idade !== null ? `${idade} anos` : "Idade —"}
            {ultimoAtend
              ? ` · Último: ${format(parseISO(ultimoAtend.inicio), "dd/MM")}`
              : " · Primeiro atendimento"}
          </p>
        </div>
        {paciente?.id && (
          <Button asChild variant="outline" size="sm">
            <Link to="/pacientes/$id" params={{ id: paciente.id }}>
              <ExternalLink className="w-3 h-3 mr-1" /> Perfil
            </Link>
          </Button>
        )}
      </div>

      {/* Info do atendimento */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info
          icon={Clock}
          label="Horário"
          value={`${format(parseISO(atendimento.inicio), "HH:mm")} – ${format(parseISO(atendimento.fim), "HH:mm")}`}
        />
        <Info icon={User} label="Profissional" value={atendimento.profissional?.nome} />
        <Info label="Modalidade" value={atendimento.modalidade?.nome} />
        <Info icon={MapPin} label="Local" value={atendimento.local?.nome} />
      </div>

      {atendimento.observacoes && (
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Observações
          </Label>
          <p className="text-sm text-muted-foreground">{atendimento.observacoes}</p>
        </div>
      )}

      {/* Registro de frequência — mesmo lançamento que aparece no painel do paciente */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Registrar frequência
          </Label>
          {freqAtual && mapFreqTipoToStatus(freqAtual.tipo) && (
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <FreqBadgeIcon status={mapFreqTipoToStatus(freqAtual.tipo)!} size={13} />
              {FREQ_STATUS_META[mapFreqTipoToStatus(freqAtual.tipo)!].label}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => registrarFrequencia.mutate({ tipo: "presente" })}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Presente
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-blue-700 border-blue-600 hover:bg-blue-50"
            onClick={() => setReporOpen(true)}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reposição
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-700 border-amber-600 hover:bg-amber-50"
            onClick={() => registrarFrequencia.mutate({ tipo: "falta_justificada" })}
          >
            <XCircle className="w-4 h-4 mr-1.5" /> Falta justificada
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 border-red-600 hover:bg-red-50"
            onClick={() => registrarFrequencia.mutate({ tipo: "falta_nao_justificada" })}
          >
            <Ban className="w-4 h-4 mr-1.5" /> Falta não justificada
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => registrarFrequencia.mutate({ tipo: "cancelado_profissional" })}
          >
            <Ban className="w-4 h-4 mr-1.5" /> Cancelado (profissional)
          </Button>
        </div>
      </div>

      <ReporFaltaDialog
        pacienteId={atendimento.paciente_id}
        open={reporOpen}
        onOpenChange={setReporOpen}
        onConfirm={(faltaId) => registrarFrequencia.mutate({ tipo: "reposicao", faltaId })}
      />

      {/* Registro de sessão */}
      {paciente?.id && (
        <div className="rounded-xl border p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Registrar sessão
          </Label>
          <p className="text-xs text-muted-foreground">
            Abre o prontuário já com data e duração pré-preenchidas a partir deste atendimento.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setSessaoTipo("avaliacao")}>
              <ClipboardList className="w-4 h-4 mr-1.5" /> Avaliação
            </Button>
            <Button
              size="sm"
              className="gradient-brand text-white"
              onClick={() => setSessaoTipo("intervencao")}
            >
              <FileText className="w-4 h-4 mr-1.5" /> Intervenção
            </Button>
          </div>
        </div>
      )}

      {paciente?.id && sessaoTipo && (
        <SessaoDialog
          open
          onOpenChange={(o) => !o && setSessaoTipo(null)}
          pacienteId={paciente.id}
          tipo={sessaoTipo}
          atendimentoId={atendimento.id}
          dataInicial={format(parseISO(atendimento.inicio), "yyyy-MM-dd")}
          duracaoInicial={Math.max(
            1,
            Math.round(
              differenceInMinutes(parseISO(atendimento.fim), parseISO(atendimento.inicio)),
            ),
          )}
          onSaved={() => {
            setSessaoTipo(null);
            qc.invalidateQueries({ queryKey: ["freq-atendimento", atendimento.id] });
            qc.invalidateQueries({ queryKey: ["freq-agenda"] });
            qc.invalidateQueries({ queryKey: ["drawer-freq", atendimento.paciente_id] });
            // Marca como presente se houver status "presente"
            const presente = statusList?.find((s) => /presen|realiz/i.test(s.nome));
            if (presente && atendimento.status_frequencia_id !== presente.id) {
              setStatus.mutate(presente.id);
            } else {
              onChanged();
            }
          }}
        />
      )}

      {/* WhatsApp */}
      <div className="rounded-xl border p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp</Label>
        <div className="flex gap-2 flex-wrap">
          {waConfirm ? (
            <Button asChild variant="outline" size="sm" onClick={() => marcarEnviado.mutate()}>
              <a href={waConfirm} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" /> Confirmação
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Sem telefone do responsável.</p>
          )}
          {waLembrete && (
            <Button asChild variant="outline" size="sm" onClick={() => marcarEnviado.mutate()}>
              <a href={waLembrete} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" /> Lembrete 24h
              </a>
            </Button>
          )}
        </div>
        {atendimento.confirmacao_enviada_em && (
          <p className="text-[11px] text-muted-foreground">
            Última mensagem enviada em{" "}
            {format(parseISO(atendimento.confirmacao_enviada_em), "dd/MM HH:mm")}.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {atendimento.confirmado_em ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmado.mutate(false)}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Desfazer confirmação
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setConfirmado.mutate(true)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmou presença (responsável)
            </Button>
          )}
        </div>
      </div>

      {/* Próximos atendimentos */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Próximos atendimentos
        </Label>
        <div className="mt-2 space-y-1.5">
          {(proximos?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum agendamento futuro.</p>
          )}
          {proximos?.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border p-2 text-xs"
              style={
                p.profissional?.cor
                  ? { borderLeftWidth: 3, borderLeftColor: p.profissional.cor }
                  : {}
              }
            >
              <div className="flex-1">
                <p className="font-medium">
                  {format(parseISO(p.inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-muted-foreground">
                  {p.profissional?.nome ?? "—"}
                  {p.modalidade?.nome ? ` · ${p.modalidade.nome}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo clínico/financeiro do paciente */}
      <AtendimentoQuickInfo pacienteId={atendimento.paciente_id} />
    </DataDrawer>
  );
}

function Info({ icon: Icon, label, value }: { icon?: any; label: string; value?: string | null }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </Label>
      <p className="font-medium text-sm">{value ?? "—"}</p>
    </div>
  );
}

/* ============ Criar / Editar atendimento ============ */
function AtendimentoDialog({
  mode,
  atendimento,
  onSaved,
  onCloseExternal,
  forceOpen,
  slotInicial,
}: {
  mode: "create" | "edit";
  atendimento?: any;
  onSaved: () => void;
  onCloseExternal?: () => void;
  forceOpen?: boolean;
  slotInicial?: { data: string; hora_inicio: string; hora_fim: string };
}) {
  const [open, setOpen] = useState(!!forceOpen);
  const isEdit = mode === "edit";

  const initial =
    isEdit && atendimento
      ? {
          paciente_id: atendimento.paciente_id,
          profissional_id: atendimento.profissional_id ?? "",
          local_id: atendimento.local_id ?? "",
          modalidade_id: atendimento.modalidade_id ?? "",
          data: format(parseISO(atendimento.inicio), "yyyy-MM-dd"),
          hora_inicio: format(parseISO(atendimento.inicio), "HH:mm"),
          hora_fim: format(parseISO(atendimento.fim), "HH:mm"),
          observacoes: atendimento.observacoes ?? "",
          recorrencia: "nao" as
            | "nao"
            | "semanal_4"
            | "semanal_8"
            | "semanal_12"
            | "semanal_ilimitada",
        }
      : {
          paciente_id: "",
          profissional_id: "",
          local_id: "",
          modalidade_id: "",
          data: slotInicial?.data ?? format(new Date(), "yyyy-MM-dd"),
          hora_inicio: slotInicial?.hora_inicio ?? "09:00",
          hora_fim: slotInicial?.hora_fim ?? "10:00",
          observacoes: "",
          recorrencia: "nao" as
            | "nao"
            | "semanal_4"
            | "semanal_8"
            | "semanal_12"
            | "semanal_ilimitada",
        };

  const [form, setForm] = useState(initial);

  const { data: pacientes } = useQuery({
    queryKey: ["pac-mini-foto"],
    queryFn: async () =>
      (await supabase.from("pacientes").select("id, nome, foto_url").order("nome")).data ?? [],
  });
  const { data: profissionais } = useQuery({
    queryKey: ["prof-mini-foto"],
    queryFn: async () => {
      const { data: profs } =
        (await supabase
          .from("profissionais_consultorio")
          .select("id, nome, cor, user_id")
          .eq("ativo", true)
          .order("nome")) ?? {};
      const userIds = (profs ?? []).map((p: any) => p.user_id).filter(Boolean);
      let avatarByUser: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", userIds);
        (perfis ?? []).forEach((p: any) => {
          avatarByUser[p.id] = p.avatar_url;
        });
      }
      return (profs ?? []).map((p: any) => ({
        ...p,
        avatar_url: p.user_id ? (avatarByUser[p.user_id] ?? null) : null,
      }));
    },
  });
  const { data: locais } = useQuery({
    queryKey: ["loc-mini"],
    queryFn: async () =>
      (await supabase.from("locais").select("id, nome").eq("ativo", true)).data ?? [],
  });
  const { data: modalidades } = useQuery({
    queryKey: ["mod-mini"],
    queryFn: async () =>
      (await supabase.from("modalidades").select("id, nome").eq("ativo", true)).data ?? [],
  });

  const close = () => {
    setOpen(false);
    onCloseExternal?.();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const inicio = new Date(`${form.data}T${form.hora_inicio}`);
      const fim = new Date(`${form.data}T${form.hora_fim}`);
      const payload = {
        paciente_id: form.paciente_id,
        profissional_id: form.profissional_id || null,
        local_id: form.local_id || null,
        modalidade_id: form.modalidade_id || null,
        observacoes: form.observacoes || null,
      };
      if (isEdit) {
        const { error } = await supabase
          .from("atendimentos")
          .update({
            ...payload,
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
          })
          .eq("id", atendimento.id);
        if (error) throw error;
        return;
      }
      const repeticoes =
        form.recorrencia === "semanal_4"
          ? 4
          : form.recorrencia === "semanal_8"
            ? 8
            : form.recorrencia === "semanal_12"
              ? 12
              : form.recorrencia === "semanal_ilimitada"
                ? 104
                : 1;
      const grupo = repeticoes > 1 ? crypto.randomUUID() : null;
      const rows = Array.from({ length: repeticoes }, (_, i) => ({
        ...payload,
        inicio: addWeeks(inicio, i).toISOString(),
        fim: addWeeks(fim, i).toISOString(),
        recorrencia: grupo ? "semanal" : null,
        recorrencia_grupo: grupo,
      }));
      const { error } = await supabase.from("atendimentos").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atendimento atualizado!" : "Atendimento agendado!");
      close();
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pacienteSel = pacientes?.find((p: any) => p.id === form.paciente_id);

  const content = (
    <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
      {/* Cabeçalho com destaque + paciente selecionado */}
      <div className="gradient-lilac px-6 pb-5 pt-6">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-xl text-lilac-foreground">
            {isEdit ? "Editar atendimento" : "Novo atendimento"}
          </DialogTitle>
          <DialogDescription className="text-lilac-foreground/70">
            {isEdit ? "Atualize os dados do atendimento." : "Agende um novo atendimento na agenda."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/75 p-2.5 shadow-sm backdrop-blur">
          <PacienteAvatar paciente={pacienteSel ?? null} size={44} />
          <div className="min-w-0">
            {pacienteSel ? (
              <>
                <p className="truncate text-sm font-semibold text-foreground">{pacienteSel.nome}</p>
                <p className="text-[11px] text-muted-foreground">Paciente selecionado</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um paciente abaixo</p>
            )}
          </div>
        </div>
      </div>

      {/* Corpo */}
      <div className="grid max-h-[58vh] gap-4 overflow-y-auto px-6 py-5">
        <div>
          <Label>Paciente *</Label>
          <Select
            value={form.paciente_id}
            onValueChange={(v) => setForm({ ...form, paciente_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {pacientes?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <PacienteAvatar paciente={p} size={22} />
                    {p.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Profissional — seleção por foto da equipe */}
        <div>
          <Label className="mb-2 block">Profissional</Label>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {profissionais?.map((p: any) => {
              const ativo = form.profissional_id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, profissional_id: ativo ? "" : p.id })
                  }
                  className={`flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-2 transition-all ${
                    ativo
                      ? "border-brand bg-brand/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-accent"
                  }`}
                >
                  <span
                    className={`rounded-full transition-all ${ativo ? "ring-2 ring-brand ring-offset-2 ring-offset-card" : ""}`}
                  >
                    <ProfAvatar prof={p} size={44} />
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-medium leading-tight">
                    {p.nome?.split(" ")[0]}
                  </span>
                </button>
              );
            })}
            {(profissionais?.length ?? 0) === 0 && (
              <p className="py-3 text-xs text-muted-foreground">Nenhum profissional cadastrado.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
          <div>
            <Label>Início</Label>
            <Input
              type="time"
              value={form.hora_inicio}
              onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="time"
              value={form.hora_fim}
              onChange={(e) => setForm({ ...form, hora_fim: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Modalidade</Label>
            <Select
              value={form.modalidade_id || "__none__"}
              onValueChange={(v) => setForm({ ...form, modalidade_id: v === "__none__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {modalidades?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Local</Label>
            <Select
              value={form.local_id || "__none__"}
              onValueChange={(v) => setForm({ ...form, local_id: v === "__none__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {locais?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isEdit && (
          <div>
            <Label>Recorrência</Label>
            <Select
              value={form.recorrencia}
              onValueChange={(v: any) => setForm({ ...form, recorrencia: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Sem repetição</SelectItem>
                <SelectItem value="semanal_4">Semanal — 4 semanas</SelectItem>
                <SelectItem value="semanal_8">Semanal — 8 semanas</SelectItem>
                <SelectItem value="semanal_12">Semanal — 12 semanas</SelectItem>
                <SelectItem value="semanal_ilimitada">Semanal — ilimitada (2 anos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>
      </div>

      <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
        <Button variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!form.paciente_id || mutation.isPending}
          className="gradient-brand text-white"
        >
          {isEdit ? "Salvar" : "Agendar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (forceOpen) {
    return (
      <Dialog open onOpenChange={(o) => !o && close()}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-brand text-white">
          <Plus className="mr-2 h-4 w-4" />
          Novo
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
}
