import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, ChevronLeft, ChevronRight, Sparkles, Target, Lightbulb, RefreshCw, Trash2, Plus } from "lucide-react";
import { RecursoPicker } from "@/components/prontuario/RecursoPicker";

/**
 * Planejamento das sessões do mês — calendário integrado à Agenda (Módulo 1).
 * Ancora o plano a um atendimento real; a data segue a agenda. Faltas movem o
 * planejado para a próxima sessão. Sugere o que trabalhar a partir dos registros.
 */

const STATUS = [
  { value: "planejada", label: "Planejada" },
  { value: "realizada", label: "Realizada" },
  { value: "cancelada", label: "Cancelada" },
];
const FALTA_NOMES = new Set(["Falta", "Falta justificada"]);
const PROGRESSO_POS = new Set(["sim", "parcial"]);
const PROGRESSO_NEG = new Set(["regressao", "sem_mudanca"]);

type Plano = {
  id: string; atendimento_id: string | null; data_prevista: string | null;
  metas_foco: string[]; foco: string | null; recursos: string | null; estrategias: string | null;
  status: string; sessao_id: string | null; ordem: number; movido_de_atendimento_id: string | null;
};
type Atend = { id: string; inicio: string; fim: string; status: { nome: string; cor: string } | null };
type Meta = { id: string; titulo: string; ordem_progressao: number | null };

export function PlanejamentoSessoes({ pacienteId, onRegistrar }: { pacienteId: string; onRegistrar?: (atendimentoId: string, dataISO: string) => void }) {
  const qc = useQueryClient();
  const [mesRef, setMesRef] = useState<Date>(startOfMonth(new Date()));
  const [selAtendId, setSelAtendId] = useState<string | null>(null);
  const [selPlanoAvulso, setSelPlanoAvulso] = useState<string | null>(null);
  const carryRodou = useMemo(() => ({ done: false }), [pacienteId]);

  const inicioMes = startOfMonth(mesRef);
  const fimMes = endOfMonth(mesRef);

  const { data: atendimentos = [] } = useQuery({
    queryKey: ["planej-atend", pacienteId, format(mesRef, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("id, inicio, fim, status:status_frequencia(nome, cor)")
        .eq("paciente_id", pacienteId)
        .gte("inicio", inicioMes.toISOString())
        .lte("inicio", fimMes.toISOString())
        .order("inicio");
      return (data ?? []) as unknown as Atend[];
    },
  });

  const { data: planejamentos = [] } = useQuery({
    queryKey: ["planej-planos", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessao_planejamentos")
        .select("id, atendimento_id, data_prevista, metas_foco, foco, recursos, estrategias, status, sessao_id, ordem, movido_de_atendimento_id")
        .eq("paciente_id", pacienteId)
        .order("ordem");
      return (data ?? []) as Plano[];
    },
  });

  // Metas ativas do plano (ordenadas pela ordem de progressão)
  const { data: metas = [] } = useQuery({
    queryKey: ["planejamento-metas", pacienteId],
    queryFn: async () => {
      const { data: mt } = await supabase
        .from("metas_terapeuticas").select("id, titulo, status").eq("paciente_id", pacienteId)
        .in("status", ["ativa", "planejamento"]);
      const ativos = (mt ?? []) as any[];
      const { data: pm } = await supabase
        .from("plano_metas").select("meta_terapeutica_id, ordem_progressao")
        .in("meta_terapeutica_id", ativos.map((m) => m.id).filter(Boolean));
      const ordemMap = new Map<string, number | null>();
      (pm ?? []).forEach((p: any) => ordemMap.set(p.meta_terapeutica_id, p.ordem_progressao));
      return ativos.filter((m) => ordemMap.has(m.id))
        .map((m) => ({ id: m.id, titulo: m.titulo, ordem_progressao: ordemMap.get(m.id) ?? null }))
        .sort((a, b) => (a.ordem_progressao ?? 99) - (b.ordem_progressao ?? 99)) as Meta[];
    },
  });

  // Registros por meta → sugestões "o que trabalhar"
  const { data: sessoesReg = [] } = useQuery({
    queryKey: ["planej-registros", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("data_sessao, sessao_metas(meta_id, nivel_gas_observado, componentes_trabalhados, houve_progresso)")
        .eq("paciente_id", pacienteId)
        .order("data_sessao", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const metaTitulo = (id: string) => metas.find((m) => m.id === id)?.titulo ?? "meta";
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["planej-planos", pacienteId] });
    qc.invalidateQueries({ queryKey: ["planej-atend", pacienteId] });
  };

  const planoPorAtend = useMemo(() => {
    const m = new Map<string, Plano>();
    for (const p of planejamentos) if (p.atendimento_id) m.set(p.atendimento_id, p);
    return m;
  }, [planejamentos]);

  // ===== Carry-forward: faltas movem o planejado para a próxima sessão =====
  async function reorganizarFaltas(silencioso: boolean) {
    const hojeISO = new Date();
    const janIni = subMonths(startOfMonth(hojeISO), 2).toISOString();
    const janFim = addMonths(endOfMonth(hojeISO), 3).toISOString();
    const [{ data: ats }, { data: plans }] = await Promise.all([
      supabase.from("atendimentos").select("id, inicio, status:status_frequencia(nome)").eq("paciente_id", pacienteId).gte("inicio", janIni).lte("inicio", janFim).order("inicio"),
      supabase.from("sessao_planejamentos").select("id, atendimento_id, status, sessao_id").eq("paciente_id", pacienteId).not("atendimento_id", "is", null),
    ]);
    const atList = (ats ?? []) as any[];
    const atById = new Map(atList.map((a) => [a.id, a]));
    const usados = new Set<string>((plans ?? []).map((p: any) => p.atendimento_id).filter(Boolean));
    let movidos = 0;
    for (const p of (plans ?? []) as any[]) {
      if (p.status === "realizada" || p.sessao_id) continue;
      const a = atById.get(p.atendimento_id);
      if (!a) continue;
      const passado = new Date(a.inicio).getTime() < Date.now();
      const faltou = FALTA_NOMES.has(a.status?.nome ?? "");
      if (!passado || !faltou) continue;
      // próximo atendimento futuro sem plano
      const alvo = atList.find((x) => new Date(x.inicio).getTime() > new Date(a.inicio).getTime() && !usados.has(x.id));
      if (!alvo) continue;
      await supabase.from("sessao_planejamentos").update({ atendimento_id: alvo.id, movido_de_atendimento_id: a.id }).eq("id", p.id);
      usados.delete(p.atendimento_id); usados.add(alvo.id);
      movidos++;
    }
    if (movidos > 0) { invalidate(); toast.success(`${movidos} planejamento(s) de falta movido(s) para a próxima sessão`); }
    else if (!silencioso) toast.info("Nenhum planejamento de falta a reorganizar");
  }

  useEffect(() => {
    if (carryRodou.done) return;
    carryRodou.done = true;
    reorganizarFaltas(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // ===== Sugestões "o que trabalhar" (dos registros) =====
  const sugestoes = useMemo(() => {
    const byMeta = new Map<string, any[]>();
    for (const s of sessoesReg) for (const sm of (s.sessao_metas ?? [])) {
      const arr = byMeta.get(sm.meta_id) ?? []; arr.push({ ...sm, data: s.data_sessao }); byMeta.set(sm.meta_id, arr);
    }
    const out: { metaId: string; titulo: string; motivo: string }[] = [];
    for (const m of metas) {
      const regs = (byMeta.get(m.id) ?? []).sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
      const gass = regs.map((r) => r.nivel_gas_observado).filter((n: any) => n != null).map(Number);
      const ultimaData = regs[regs.length - 1]?.data;
      const limita = new Map<string, number>();
      for (const r of regs) if (PROGRESSO_NEG.has(r.houve_progresso)) (Array.isArray(r.componentes_trabalhados) ? r.componentes_trabalhados : []).forEach((c: string) => limita.set(c, (limita.get(c) ?? 0) + 1));
      let motivo = "";
      if (!regs.length) motivo = "Ainda sem registro — iniciar trabalho.";
      else if (ultimaData && differenceInCalendarDays(new Date(), new Date(ultimaData)) > 21) motivo = `Sem registro há ${differenceInCalendarDays(new Date(), new Date(ultimaData))} dias.`;
      else if (gass.length >= 2 && (gass[gass.length - 1] - gass[0]) <= -1) motivo = "Tendência de queda no GAS — reforçar.";
      else if (limita.size) motivo = `Componentes limitantes: ${Array.from(limita.keys()).slice(0, 3).join(", ")}.`;
      else if (m.ordem_progressao != null) motivo = "Na ordem de progressão.";
      if (motivo) out.push({ metaId: m.id, titulo: m.titulo, motivo });
    }
    return out;
  }, [sessoesReg, metas]);

  // ===== Grade do mês =====
  const dias = useMemo(() => {
    const gi = startOfWeek(inicioMes, { weekStartsOn: 0 });
    const gf = endOfWeek(fimMes, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gi, end: gf });
  }, [mesRef]);
  const atendPorDia = useMemo(() => {
    const m = new Map<string, Atend[]>();
    for (const a of atendimentos) {
      const k = format(parseISO(a.inicio), "yyyy-MM-dd");
      const arr = m.get(k) ?? []; arr.push(a); m.set(k, arr);
    }
    return m;
  }, [atendimentos]);

  const selAtend = atendimentos.find((a) => a.id === selAtendId) ?? null;
  const planoSelAtend = selAtendId ? planoPorAtend.get(selAtendId) ?? null : null;
  const planoAvulsoSel = selPlanoAvulso ? planejamentos.find((p) => p.id === selPlanoAvulso) ?? null : null;

  async function ensurePlanoParaAtend(atId: string): Promise<string | null> {
    const existente = planoPorAtend.get(atId);
    if (existente) return existente.id;
    const { data, error } = await supabase.from("sessao_planejamentos")
      .insert({ paciente_id: pacienteId, atendimento_id: atId, status: "planejada", metas_foco: [], ordem: planejamentos.length })
      .select("id").single();
    if (error) { toast.error(error.message); return null; }
    invalidate();
    return data.id;
  }

  return (
    <Card className="glass border-brand/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand" /> Planejamento das sessões
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Calendário integrado à agenda. Clique num atendimento para planejar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => reorganizarFaltas(false)} title="Move o planejado de sessões faltadas para a próxima">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />Reorganizar faltas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Navegação do mês */}
        <div className="flex items-center justify-between">
          <Button size="icon" variant="ghost" onClick={() => setMesRef(subMonths(mesRef, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium capitalize">{format(mesRef, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <Button size="icon" variant="ghost" onClick={() => setMesRef(addMonths(mesRef, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {/* Grade */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1 font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dias.map((dia) => {
            const k = format(dia, "yyyy-MM-dd");
            const doDia = atendPorDia.get(k) ?? [];
            const foraMes = !isSameMonth(dia, mesRef);
            const hoje = isSameDay(dia, new Date());
            return (
              <div key={k} className={`min-h-[62px] rounded-md border p-1 text-left ${foraMes ? "opacity-40" : ""} ${hoje ? "border-brand" : "border-border/50"}`}>
                <div className="text-[10px] text-muted-foreground">{format(dia, "d")}</div>
                <div className="mt-0.5 space-y-0.5">
                  {doDia.map((a) => {
                    const p = planoPorAtend.get(a.id);
                    const sel = selAtendId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setSelAtendId(a.id); setSelPlanoAvulso(null); }}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight ${sel ? "ring-1 ring-brand" : ""}`}
                        style={{ backgroundColor: (a.status?.cor ?? "#94a3b8") + "22", color: "inherit" }}
                        title={`${format(parseISO(a.inicio), "HH:mm")} · ${a.status?.nome ?? "Agendado"}`}
                      >
                        {format(parseISO(a.inicio), "HH:mm")}{p && (p.metas_foco?.length ?? 0) > 0 ? ` · ${p.metas_foco.length}m` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor do atendimento selecionado */}
        {selAtend && (
          <AtendEditor
            atend={selAtend}
            plano={planoSelAtend}
            metas={metas}
            metaTitulo={metaTitulo}
            movidoDe={planoSelAtend?.movido_de_atendimento_id ?? null}
            ensurePlano={() => ensurePlanoParaAtend(selAtend.id)}
            onChanged={invalidate}
            onRegistrar={onRegistrar}
          />
        )}

        {/* Sugestões dos registros */}
        {sugestoes.length > 0 && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <Lightbulb className="h-3.5 w-3.5" /> O que trabalhar (dos registros)
            </p>
            <div className="space-y-1">
              {sugestoes.map((s) => (
                <div key={s.metaId} className="flex items-center justify-between gap-2 text-[11px]">
                  <span><strong>{s.titulo}</strong> — <span className="text-muted-foreground">{s.motivo}</span></span>
                  {selAtend && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                      onClick={async () => {
                        const pid = await ensurePlanoParaAtend(selAtend.id);
                        if (!pid) return;
                        const atual = planoPorAtend.get(selAtend.id)?.metas_foco ?? [];
                        if (atual.includes(s.metaId)) return;
                        await supabase.from("sessao_planejamentos").update({ metas_foco: [...atual, s.metaId] }).eq("id", pid);
                        invalidate();
                      }}>
                      <Plus className="mr-1 h-3 w-3" />foco
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {metas.length === 0 && (
          <p className="text-[11px] text-muted-foreground/70">Nenhuma meta ativa no plano — aprove/ative metas na aba Plano para planejar.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AtendEditor({
  atend, plano, metas, metaTitulo, movidoDe, ensurePlano, onChanged, onRegistrar,
}: {
  atend: Atend; plano: Plano | null; metas: Meta[]; metaTitulo: (id: string) => string;
  movidoDe: string | null; ensurePlano: () => Promise<string | null>; onChanged: () => void;
  onRegistrar?: (atendimentoId: string, dataISO: string) => void;
}) {
  const [foco, setFoco] = useState(plano?.foco ?? "");
  const [recursos, setRecursos] = useState(plano?.recursos ?? "");
  const [estrategias, setEstrategias] = useState(plano?.estrategias ?? "");
  useEffect(() => { setFoco(plano?.foco ?? ""); setRecursos(plano?.recursos ?? ""); setEstrategias(plano?.estrategias ?? ""); }, [plano?.id]);

  async function patch(campos: Record<string, any>) {
    const id = plano?.id ?? (await ensurePlano());
    if (!id) return;
    const { error } = await supabase.from("sessao_planejamentos").update(campos as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }
  async function toggleMeta(id: string) {
    const set = new Set(plano?.metas_foco ?? []);
    if (set.has(id)) set.delete(id); else set.add(id);
    await patch({ metas_foco: Array.from(set) });
  }
  async function excluir() {
    if (!plano) return;
    await supabase.from("sessao_planejamentos").delete().eq("id", plano.id);
    onChanged();
  }

  const metasFoco = plano?.metas_foco ?? [];

  return (
    <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          Sessão de {format(parseISO(atend.inicio), "dd/MM (EEE) 'às' HH:mm", { locale: ptBR })}
          {atend.status?.nome && <Badge variant="outline" className="ml-2 text-[10px]" style={{ borderColor: atend.status.cor, color: atend.status.cor }}>{atend.status.nome}</Badge>}
          {movidoDe && <Badge variant="secondary" className="ml-1 text-[10px]">movido de falta</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {onRegistrar && plano?.status !== "realizada" && (
            <Button size="sm" onClick={() => onRegistrar(atend.id, atend.inicio)}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />Registrar sessão
            </Button>
          )}
          {plano && (
            <Select value={plano.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {plano && <Button size="sm" variant="ghost" onClick={excluir}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
        </div>
      </div>

      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Metas-foco desta sessão</Label>
      {metas.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70">Nenhuma meta ativa no plano.</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {metas.map((m, idx) => {
            const sel = metasFoco.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggleMeta(m.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${sel ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                title={m.titulo}>
                <span className="mr-1 opacity-60">#{m.ordem_progressao ?? idx + 1}</span>
                {m.titulo.length > 42 ? m.titulo.slice(0, 42) + "…" : m.titulo}
              </button>
            );
          })}
        </div>
      )}
      {metasFoco.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {metasFoco.map((id) => <Badge key={id} variant="secondary" className="text-[10px]">{metaTitulo(id)}</Badge>)}
        </div>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Objetivo/foco</Label>
          <Textarea rows={2} className="text-xs" value={foco} onChange={(e) => setFoco(e.target.value)} onBlur={() => { if (foco !== (plano?.foco ?? "")) patch({ foco: foco || null }); }} placeholder="O que avançar…" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Recursos previstos</Label>
            <RecursoPicker onAdd={(nome) => { const novo = recursos.trim() ? recursos.replace(/,\s*$/, "") + ", " + nome : nome; setRecursos(novo); patch({ recursos: novo }); }} />
          </div>
          <Textarea rows={2} className="text-xs" value={recursos} onChange={(e) => setRecursos(e.target.value)} onBlur={() => { if (recursos !== (plano?.recursos ?? "")) patch({ recursos: recursos || null }); }} placeholder="Jogos, materiais…" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Estratégias</Label>
          <Textarea rows={2} className="text-xs" value={estrategias} onChange={(e) => setEstrategias(e.target.value)} onBlur={() => { if (estrategias !== (plano?.estrategias ?? "")) patch({ estrategias: estrategias || null }); }} placeholder="Estratégias previstas…" />
        </div>
      </div>
    </div>
  );
}
