import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calculator, Settings2, Lock, Unlock, Printer, AlertTriangle, CheckCircle2, Eye, ChevronLeft, ChevronRight, CalendarRange, LayoutList, Wallet, Clock, Landmark, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Encargos estimados — porcentagens gerenciais
const ENCARGOS = { clt: 0.28, pj: 0, autonomo: 0.11 } as const;

export function Folha() {
  const qc = useQueryClient();
  const [refMonth, setRefMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [configOpen, setConfigOpen] = useState(false);
  const [configProf, setConfigProf] = useState<any>(null);
  const [holerite, setHolerite] = useState<any>(null);
  const [detalhe, setDetalhe] = useState<any>(null);
  const [view, setView] = useState<"mes" | "ano">("mes");

  const [ano, mes] = refMonth.split("-").map(Number);
  const competencia = new Date(ano, mes - 1, 1);

  const { data: profs } = useQuery({
    queryKey: ["folha-profs"],
    queryFn: async () =>
      (await supabase.from("profissionais_consultorio").select("id, nome, ativo").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: configs } = useQuery({
    queryKey: ["folha-configs"],
    queryFn: async () => (await supabase.from("colaborador_config").select("*")).data ?? [],
  });

  const { data: folhas } = useQuery({
    queryKey: ["folha-mes", refMonth],
    queryFn: async () =>
      (await supabase.from("folha_pagamento").select("*")
        .eq("competencia", competencia.toISOString().slice(0, 10))).data ?? [],
  });

  const configByProf = (id: string) => (configs ?? []).find((c) => c.profissional_id === id);
  const folhaByProf = (id: string) => (folhas ?? []).find((f) => f.profissional_id === id);

  const gerar = useMutation({
    mutationFn: async (profId: string) => {
      const cfg = configByProf(profId);
      if (!cfg) throw new Error("Configure o colaborador primeiro");
      const ini = startOfMonth(competencia).toISOString();
      const fim = endOfMonth(competencia).toISOString();
      const { data: atend } = await supabase
        .from("atendimentos")
        .select("id, status_frequencia_id, status_frequencia:status_frequencia(conta_presenca)")
        .eq("profissional_id", profId)
        .gte("inicio", ini)
        .lte("inicio", fim);
      const sessoesContadas = (atend ?? []).filter((a: any) => a.status_frequencia?.conta_presenca !== false).length;

      const beneficios = Number(cfg.beneficios || 0);
      // Forma de repasse explícita escolhida pela clínica. "auto" mantém o
      // comportamento antigo (valor/sessão se > 0; senão % sobre receita).
      const forma = (cfg.forma_repasse ?? "auto") as string;

      // Receita do mês atribuída ao profissional (para o modo percentual).
      async function receitaDoProfissional(): Promise<number> {
        const { data: pacientesIds } = await supabase
          .from("paciente_profissionais").select("paciente_id").eq("profissional_id", profId);
        const ids = (pacientesIds ?? []).map((x) => x.paciente_id);
        if (!ids.length) return 0;
        const { data: pags } = await supabase
          .from("pagamentos").select("valor")
          .in("paciente_id", ids)
          .eq("status", "pago")
          .gte("pago_em", ini.slice(0, 10))
          .lte("pago_em", fim.slice(0, 10));
        return (pags ?? []).reduce((s, p) => s + Number(p.valor), 0);
      }

      // Sessões contadas por paciente (para o modo "por paciente").
      async function sessoesPorPaciente(): Promise<Record<string, number>> {
        const { data } = await supabase
          .from("atendimentos")
          .select("paciente_id, status_frequencia:status_frequencia(conta_presenca)")
          .eq("profissional_id", profId)
          .gte("inicio", ini)
          .lte("inicio", fim);
        const out: Record<string, number> = {};
        for (const a of (data ?? []) as any[]) {
          if (a.status_frequencia?.conta_presenca === false) continue;
          if (!a.paciente_id) continue;
          out[a.paciente_id] = (out[a.paciente_id] ?? 0) + 1;
        }
        return out;
      }

      // Salário fixo só entra no bruto nos modos "fixo mensal" e "auto";
      // nos demais o repasse vem inteiro das comissões (salário fica 0).
      let salario = Number(cfg.salario_base || 0);
      let comissoes = 0;
      let regra = forma;

      if (forma === "fixo_mensal") {
        comissoes = 0; // valor fixo mensal = salário base
      } else if (forma === "por_sessao") {
        salario = 0;
        comissoes = sessoesContadas * Number(cfg.valor_por_sessao || 0);
      } else if (forma === "percentual") {
        salario = 0;
        comissoes = (await receitaDoProfissional()) * (Number(cfg.comissao_percentual || 0) / 100);
      } else if (forma === "por_paciente") {
        salario = 0;
        const [{ data: valores }, counts] = await Promise.all([
          supabase.from("colaborador_paciente_valor").select("*").eq("profissional_id", profId),
          sessoesPorPaciente(),
        ]);
        comissoes = (valores ?? []).reduce((s, v: any) => {
          const n = counts[v.paciente_id] ?? 0;
          if (v.modo === "fixo_mensal") return s + (n > 0 ? Number(v.valor || 0) : 0);
          return s + Number(v.valor || 0) * n; // por_sessao
        }, 0);
      } else {
        // auto (legado)
        if (Number(cfg.valor_por_sessao) > 0) {
          comissoes = sessoesContadas * Number(cfg.valor_por_sessao);
          regra = "valor_por_sessao";
        } else if (Number(cfg.comissao_percentual) > 0) {
          comissoes = (await receitaDoProfissional()) * (Number(cfg.comissao_percentual) / 100);
          regra = "percentual_receita";
        }
      }

      const vinculo = (cfg.vinculo ?? "autonomo") as keyof typeof ENCARGOS;
      const provBruto = salario + comissoes + beneficios;
      const encargos = provBruto * (ENCARGOS[vinculo] ?? 0);
      const descontos = Number(cfg.descontos_fixos || 0);
      const liquido = provBruto - descontos;

      const payload = {
        profissional_id: profId,
        competencia: competencia.toISOString().slice(0, 10),
        salario_base: salario,
        comissoes,
        beneficios,
        bonus: 0,
        encargos,
        descontos,
        liquido,
        qtd_sessoes: sessoesContadas,
        detalhes: { vinculo, encargos_pct: ENCARGOS[vinculo], forma_repasse: forma, regra },
        status: "aberta",
      };
      const existente = folhaByProf(profId);
      if (existente) {
        const { error } = await supabase.from("folha_pagamento").update(payload).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("folha_pagamento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["folha-mes"] }); toast.success("Folha calculada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const fechar = useMutation({
    mutationFn: async (folha: any) => {
      // Cria lançamento de despesa total (líquido + encargos)
      const total = Number(folha.liquido) + Number(folha.encargos);
      const { data: lanc, error: lErr } = await supabase.from("lancamentos_financeiros").insert({
        tipo: "despesa",
        status: "previsto",
        descricao: `Folha ${format(competencia, "MM/yyyy")} — colaborador`,
        valor: total,
        competencia: folha.competencia,
        vencimento: format(endOfMonth(competencia), "yyyy-MM-05"),
        observacoes: `Líquido ${currency(folha.liquido)} + encargos ${currency(folha.encargos)}`,
      }).select("id").single();
      if (lErr) throw lErr;
      const { error } = await supabase.from("folha_pagamento")
        .update({ status: "fechada", fechada_em: new Date().toISOString(), lancamento_id: lanc.id })
        .eq("id", folha.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["folha-mes"] }); invalidarFinanceiro(qc); toast.success("Folha fechada e despesa lançada"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  // Reabre uma folha fechada/paga para edição: remove a despesa lançada e
  // volta para "aberta" (permitindo reconfigurar, recalcular e fechar de novo).
  const reabrir = useMutation({
    mutationFn: async (folha: any) => {
      if (folha.lancamento_id) {
        await supabase.from("lancamentos_financeiros").delete().eq("id", folha.lancamento_id);
      }
      const { error } = await supabase.from("folha_pagamento")
        .update({ status: "aberta", fechada_em: null, lancamento_id: null, paga_em: null })
        .eq("id", folha.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["folha-mes"] }); invalidarFinanceiro(qc); toast.success("Folha reaberta para edição"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  // Controle de status do pagamento (realizado ou não).
  const marcarPago = useMutation({
    mutationFn: async (folha: any) => {
      const pago = folha.status === "paga";
      const { error } = await supabase.from("folha_pagamento")
        .update({
          status: pago ? (folha.lancamento_id ? "fechada" : "aberta") : "paga",
          paga_em: pago ? null : new Date().toISOString().slice(0, 10),
        })
        .eq("id", folha.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["folha-mes"] }); toast.success("Status de pagamento atualizado"); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const totalLiquido = (folhas ?? []).reduce((s, f) => s + Number(f.liquido || 0), 0);
  const totalEncargos = (folhas ?? []).reduce((s, f) => s + Number(f.encargos || 0), 0);
  const totalPago = (folhas ?? []).filter((f) => f.status === "paga").reduce((s, f) => s + Number(f.liquido || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="glass border-brand-yellow/40 bg-brand-yellow/5">
        <CardContent className="flex items-start gap-3 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
          <p>
            Cálculo gerencial estimado. <strong>Não substitui a folha oficial</strong> emitida pela
            contabilidade — encargos usam alíquotas padrão (CLT 28%, autônomo 11%, PJ 0%).
          </p>
        </CardContent>
      </Card>

      <div className="flex w-fit items-center gap-1 rounded-lg border p-1">
        <Button size="sm" variant={view === "mes" ? "default" : "ghost"} onClick={() => setView("mes")}>
          <LayoutList className="mr-1 h-3.5 w-3.5" />Mês
        </Button>
        <Button size="sm" variant={view === "ano" ? "default" : "ghost"} onClick={() => setView("ano")}>
          <CalendarRange className="mr-1 h-3.5 w-3.5" />Ano
        </Button>
      </div>

      {view === "ano" ? (
        <FolhaAnual />
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={refMonth}
          onChange={(e) => setRefMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="Líquido total" value={currency(totalLiquido)} />
        <KpiCard icon={CheckCircle2} label="Pago" value={currency(totalPago)} tone="success" />
        <KpiCard icon={Clock} label="A pagar" value={currency(Math.max(totalLiquido - totalPago, 0))} tone="warn" />
        <KpiCard icon={Landmark} label="Encargos (empresa)" value={currency(totalEncargos)} />
      </div>

      {/* Colaboradores */}
      {(!profs || profs.length === 0) ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum colaborador cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(profs ?? []).map((p) => (
            <ColaboradorCard
              key={p.id}
              p={p}
              cfg={configByProf(p.id)}
              f={folhaByProf(p.id)}
              onConfigurar={() => { setConfigProf(p); setConfigOpen(true); }}
              onCalcular={() => gerar.mutate(p.id)}
              onFechar={(folha: any) => fechar.mutate(folha)}
              onReabrir={(folha: any) => reabrir.mutate(folha)}
              onMarcarPago={(folha: any) => marcarPago.mutate(folha)}
              onHolerite={(folha: any) => setHolerite({ ...folha, profissional: p })}
              onDetalhes={(cfg: any) => setDetalhe({ prof: p, cfg })}
            />
          ))}
        </div>
      )}
      </>
      )}

      <ColaboradorConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        profissional={configProf}
        config={configProf ? configByProf(configProf.id) : null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["folha-configs"] })}
      />

      <HoleriteDialog folha={holerite} onClose={() => setHolerite(null)} />
      <DetalhePorPacienteDialog detalhe={detalhe} competencia={competencia} onClose={() => setDetalhe(null)} />
    </div>
  );
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Detalhe do valor por paciente no mês: nº de sessões contadas e valor calculado
// conforme a forma de repasse (principalmente útil no "por sessão"/"por paciente").
function DetalhePorPacienteDialog({ detalhe, competencia, onClose }: { detalhe: any; competencia: Date; onClose: () => void }) {
  const prof = detalhe?.prof;
  const cfg = detalhe?.cfg;
  const forma = (cfg?.forma_repasse ?? "auto") as string;

  const { data: linhas = [] } = useQuery({
    queryKey: ["folha-detalhe", prof?.id, format(competencia, "yyyy-MM"), forma],
    enabled: !!prof,
    queryFn: async () => {
      const ini = startOfMonth(competencia).toISOString();
      const fim = endOfMonth(competencia).toISOString();
      const { data: atend } = await supabase
        .from("atendimentos")
        .select("paciente_id, paciente:pacientes(nome), status_frequencia:status_frequencia(conta_presenca)")
        .eq("profissional_id", prof.id)
        .gte("inicio", ini)
        .lte("inicio", fim);

      const porPac: Record<string, { nome: string; sessoes: number }> = {};
      for (const a of (atend ?? []) as any[]) {
        if (a.status_frequencia?.conta_presenca === false) continue;
        if (!a.paciente_id) continue;
        (porPac[a.paciente_id] ??= { nome: a.paciente?.nome ?? "—", sessoes: 0 }).sessoes++;
      }

      const valores: Record<string, any> = {};
      if (forma === "por_paciente") {
        const { data: vs } = await supabase
          .from("colaborador_paciente_valor").select("*").eq("profissional_id", prof.id);
        for (const v of (vs ?? []) as any[]) valores[v.paciente_id] = v;
      }

      const receita: Record<string, number> = {};
      if (forma === "percentual") {
        const ids = Object.keys(porPac);
        if (ids.length) {
          const { data: pags } = await supabase
            .from("pagamentos").select("paciente_id, valor")
            .in("paciente_id", ids).eq("status", "pago")
            .gte("pago_em", ini.slice(0, 10)).lte("pago_em", fim.slice(0, 10));
          for (const p of (pags ?? []) as any[]) receita[p.paciente_id] = (receita[p.paciente_id] ?? 0) + Number(p.valor);
        }
      }

      return Object.entries(porPac).map(([id, o]) => {
        let valor = 0;
        let base = "";
        if (forma === "por_sessao" || forma === "auto") {
          const v = Number(cfg?.valor_por_sessao || 0);
          valor = o.sessoes * v;
          base = `${o.sessoes} × ${currency(v)}`;
        } else if (forma === "por_paciente") {
          const v = valores[id];
          if (!v) { base = "sem valor definido"; }
          else if (v.modo === "fixo_mensal") { valor = o.sessoes > 0 ? Number(v.valor || 0) : 0; base = o.sessoes > 0 ? `fixo ${currency(Number(v.valor || 0))}` : "sem sessão no mês"; }
          else { valor = o.sessoes * Number(v.valor || 0); base = `${o.sessoes} × ${currency(Number(v.valor || 0))}`; }
        } else if (forma === "percentual") {
          const r = receita[id] ?? 0;
          const pct = Number(cfg?.comissao_percentual || 0);
          valor = r * pct / 100;
          base = `${currency(r)} × ${pct}%`;
        } else if (forma === "fixo_mensal") {
          base = "valor fixo mensal (não é por paciente)";
        }
        return { id, nome: o.nome, sessoes: o.sessoes, valor, base };
      }).sort((a, b) => b.sessoes - a.sessoes);
    },
  });

  const totalSessoes = linhas.reduce((s, l) => s + l.sessoes, 0);
  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <Dialog open={!!detalhe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Detalhe por paciente — {prof?.nome}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          {format(competencia, "MMMM 'de' yyyy", { locale: ptBR })} · {FORMAS_REPASSE.find((f) => f.value === forma)?.label ?? forma}
        </p>
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sessão contada neste mês.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-center">Sessões</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-[180px] truncate">{l.nome}</TableCell>
                    <TableCell className="text-center">{l.sessoes}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{currency(l.valor)}</div>
                      <div className="text-[10px] text-muted-foreground">{l.base}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-sm font-semibold">
          <span>Total: {totalSessoes} sessões</span>
          <span>{currency(totalValor)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Dashboard anual da folha: gráfico por mês + totais por colaborador no ano.
function FolhaAnual() {
  const [ano, setAno] = useState(() => new Date().getFullYear());

  const { data: folhas = [] } = useQuery({
    queryKey: ["folha-ano", ano],
    queryFn: async () =>
      (await supabase
        .from("folha_pagamento")
        .select("*, profissional:profissionais_consultorio(nome)")
        .gte("competencia", `${ano}-01-01`)
        .lte("competencia", `${ano}-12-31`)).data ?? [],
  });

  const porMes = MESES_CURTOS.map((nome, idx) => {
    const doMes = (folhas as any[]).filter((f) => parseISO(f.competencia).getMonth() === idx);
    return {
      mes: nome,
      "Líquido": doMes.reduce((s, f) => s + Number(f.liquido || 0), 0),
      "Pago": doMes.filter((f) => f.status === "paga").reduce((s, f) => s + Number(f.liquido || 0), 0),
    };
  });

  const totalLiquido = (folhas as any[]).reduce((s, f) => s + Number(f.liquido || 0), 0);
  const totalPago = (folhas as any[]).filter((f) => f.status === "paga").reduce((s, f) => s + Number(f.liquido || 0), 0);
  const totalEncargos = (folhas as any[]).reduce((s, f) => s + Number(f.encargos || 0), 0);
  const totalSessoes = (folhas as any[]).reduce((s, f) => s + Number(f.qtd_sessoes || 0), 0);

  const porProf: Record<string, { nome: string; liquido: number; pago: number; sessoes: number; meses: number }> = {};
  for (const f of folhas as any[]) {
    const k = f.profissional_id;
    (porProf[k] ??= { nome: f.profissional?.nome ?? "—", liquido: 0, pago: 0, sessoes: 0, meses: 0 });
    porProf[k].liquido += Number(f.liquido || 0);
    if (f.status === "paga") porProf[k].pago += Number(f.liquido || 0);
    porProf[k].sessoes += Number(f.qtd_sessoes || 0);
    porProf[k].meses += 1;
  }
  const profs = Object.values(porProf).sort((a, b) => b.liquido - a.liquido);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setAno(ano - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-16 text-center font-semibold">{ano}</span>
        <Button size="icon" variant="ghost" onClick={() => setAno(ano + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Líquido no ano" value={currency(totalLiquido)} />
        <StatCard label="Pago" value={currency(totalPago)} tone="success" />
        <StatCard label="Encargos" value={currency(totalEncargos)} />
        <StatCard label="Sessões" value={String(totalSessoes)} />
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Folha por mês — {ano}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porMes} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => currency(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Líquido" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Pago" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Meses</TableHead>
                <TableHead className="text-center">Sessões</TableHead>
                <TableHead className="text-right">Líquido no ano</TableHead>
                <TableHead className="text-right">Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhuma folha gerada em {ano}.</TableCell></TableRow>
              )}
              {profs.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-center">{p.meses}</TableCell>
                  <TableCell className="text-center">{p.sessoes}</TableCell>
                  <TableCell className="text-right font-semibold">{currency(p.liquido)}</TableCell>
                  <TableCell className="text-right">{currency(p.pago)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card className="glass">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${tone === "success" ? "text-emerald-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

const FORMAS_REPASSE: { value: string; label: string; ajuda: string }[] = [
  { value: "fixo_mensal", label: "Valor fixo mensal", ajuda: "Recebe o mesmo valor todo mês, independente de sessões." },
  { value: "por_sessao", label: "Por sessão", ajuda: "Valor único por sessão × nº de sessões contadas no mês." },
  { value: "por_paciente", label: "Por paciente", ajuda: "Cada paciente tem um valor próprio (por sessão ou fixo no mês)." },
  { value: "percentual", label: "Percentual sobre receita", ajuda: "% sobre o que os pacientes desse profissional pagaram no mês." },
  { value: "auto", label: "Automático (legado)", ajuda: "Usa valor por sessão se preenchido; senão, a comissão %." },
];

function ColaboradorConfigDialog({ open, onOpenChange, profissional, config, onSaved }: any) {
  const defaults = { forma_repasse: "por_sessao", vinculo: "autonomo", salario_base: 0, comissao_percentual: 0, valor_por_sessao: 0, beneficios: 0, descontos_fixos: 0, dependentes: 0 };
  const [form, setForm] = useState<any>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(config ? { ...defaults, ...config } : defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profissional?.id, config?.id]);

  const forma = form.forma_repasse ?? "por_sessao";

  async function salvar() {
    if (!profissional) return;
    setSaving(true);
    try {
      const payload = {
        profissional_id: profissional.id,
        forma_repasse: forma,
        vinculo: form.vinculo ?? "autonomo",
        salario_base: Number(form.salario_base || 0),
        comissao_percentual: Number(form.comissao_percentual || 0),
        valor_por_sessao: Number(form.valor_por_sessao || 0),
        beneficios: Number(form.beneficios || 0),
        descontos_fixos: Number(form.descontos_fixos || 0),
        dependentes: Number(form.dependentes || 0),
        observacoes: form.observacoes || null,
      };
      if (config?.id) {
        const { error } = await supabase.from("colaborador_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colaborador_config").insert(payload);
        if (error) throw error;
      }
      toast.success("Configuração salva");
      onSaved(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurar {profissional?.nome}</DialogTitle></DialogHeader>

        <div>
          <Label>Forma de repasse</Label>
          <Select value={forma} onValueChange={(v) => setForm({ ...form, forma_repasse: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_REPASSE.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{FORMAS_REPASSE.find((f) => f.value === forma)?.ajuda}</p>
        </div>

        {/* Campos específicos da forma escolhida */}
        {forma === "fixo_mensal" && (
          <div>
            <Label>Valor fixo mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.salario_base ?? 0} onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })} />
          </div>
        )}
        {(forma === "por_sessao" || forma === "auto") && (
          <div>
            <Label>Valor por sessão (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_por_sessao ?? 0} onChange={(e) => setForm({ ...form, valor_por_sessao: Number(e.target.value) })} />
          </div>
        )}
        {(forma === "percentual" || forma === "auto") && (
          <div>
            <Label>% Comissão sobre receita</Label>
            <Input type="number" step="0.01" value={form.comissao_percentual ?? 0} onChange={(e) => setForm({ ...form, comissao_percentual: Number(e.target.value) })} />
          </div>
        )}
        {forma === "por_paciente" && profissional && (
          <ValoresPorPacienteEditor profissionalId={profissional.id} />
        )}

        {/* Campos comuns */}
        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
          <div>
            <Label>Vínculo</Label>
            <Select value={form.vinculo} onValueChange={(v) => setForm({ ...form, vinculo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="autonomo">Autônomo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dependentes</Label>
            <Input type="number" value={form.dependentes ?? 0} onChange={(e) => setForm({ ...form, dependentes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Benefícios (R$)</Label>
            <Input type="number" step="0.01" value={form.beneficios ?? 0} onChange={(e) => setForm({ ...form, beneficios: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Descontos fixos (R$)</Label>
            <Input type="number" step="0.01" value={form.descontos_fixos ?? 0} onChange={(e) => setForm({ ...form, descontos_fixos: Number(e.target.value) })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editor dos valores por paciente (modo "por paciente"). Os valores ficam
// numa tabela própria e são salvos aqui mesmo (independem do "Salvar" do topo).
function ValoresPorPacienteEditor({ profissionalId }: { profissionalId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["colab-pac-valores", profissionalId],
    enabled: !!profissionalId,
    queryFn: async () => {
      const { data: pp } = await supabase
        .from("paciente_profissionais")
        .select("paciente_id, paciente:pacientes(nome)")
        .eq("profissional_id", profissionalId);
      const { data: vals } = await supabase
        .from("colaborador_paciente_valor")
        .select("*")
        .eq("profissional_id", profissionalId);
      return { pacientes: pp ?? [], valores: vals ?? [] };
    },
  });

  const [rows, setRows] = useState<Record<string, { modo: string; valor: string }>>({});
  useEffect(() => {
    if (!data) return;
    const map: Record<string, { modo: string; valor: string }> = {};
    for (const v of data.valores as any[]) map[v.paciente_id] = { modo: v.modo, valor: String(v.valor ?? "") };
    setRows(map);
  }, [data]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = (data?.pacientes ?? [])
        .filter((p: any) => rows[p.paciente_id] && Number(rows[p.paciente_id].valor) > 0)
        .map((p: any) => ({
          profissional_id: profissionalId,
          paciente_id: p.paciente_id,
          modo: rows[p.paciente_id].modo || "por_sessao",
          valor: Number(rows[p.paciente_id].valor || 0),
        }));
      if (!payload.length) { toast.error("Preencha ao menos um valor"); return; }
      const { error } = await supabase
        .from("colaborador_paciente_valor")
        .upsert(payload, { onConflict: "profissional_id,paciente_id" });
      if (error) throw error;
      toast.success("Valores por paciente salvos");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colab-pac-valores", profissionalId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const pacientes = data?.pacientes ?? [];

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Valores por paciente</Label>
        <Button size="sm" variant="outline" onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar valores</Button>
      </div>
      {pacientes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum paciente vinculado a este profissional ainda. Vincule pacientes na ficha do paciente.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2">
          {pacientes.map((p: any) => {
            const r = rows[p.paciente_id] ?? { modo: "por_sessao", valor: "" };
            const set = (patch: Partial<{ modo: string; valor: string }>) =>
              setRows((prev) => ({ ...prev, [p.paciente_id]: { ...r, ...patch } }));
            return (
              <div key={p.paciente_id} className="grid grid-cols-[1fr_130px_110px] items-center gap-2">
                <span className="text-sm truncate">{p.paciente?.nome ?? "—"}</span>
                <Select value={r.modo} onValueChange={(v) => set({ modo: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="por_sessao">Por sessão</SelectItem>
                    <SelectItem value="fixo_mensal">Fixo no mês</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number" step="0.01" placeholder="R$" className="h-8"
                  value={r.valor}
                  onChange={(e) => set({ valor: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        "Por sessão" multiplica pelo nº de sessões do paciente no mês; "Fixo no mês" soma o valor se houve ao menos uma sessão.
      </p>
    </div>
  );
}

function HoleriteDialog({ folha, onClose }: { folha: any; onClose: () => void }) {
  if (!folha) return null;
  return (
    <Dialog open={!!folha} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg print:shadow-none">
        <DialogHeader>
          <DialogTitle>Holerite — {folha.profissional?.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Competência: <strong>{format(parseISO(folha.competencia), "MMMM yyyy", { locale: ptBR })}</strong></p>
          <Linha label="Salário base" v={Number(folha.salario_base)} />
          <Linha label={`Comissões (${folha.qtd_sessoes} sessões)`} v={Number(folha.comissoes)} />
          <Linha label="Benefícios" v={Number(folha.beneficios)} />
          <Linha label="Bônus" v={Number(folha.bonus)} />
          <div className="border-t pt-2"><Linha label="Descontos" v={-Number(folha.descontos)} /></div>
          <div className="border-t pt-2 font-bold"><Linha label="Líquido a pagar" v={Number(folha.liquido)} /></div>
          <p className="text-xs text-muted-foreground border-t pt-2">
            Encargos estimados a cargo da empresa: {currency(Number(folha.encargos))}
          </p>
        </div>
        <DialogFooter className="print:hidden">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()}><Printer className="w-3 h-3 mr-1" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={v < 0 ? "text-destructive" : ""}>{currency(v)}</span>
    </div>
  );
}

// Card de KPI do resumo mensal.
function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "warn" }) {
  const toneCls =
    tone === "success" ? "bg-emerald-500/10 text-emerald-600"
    : tone === "warn" ? "bg-amber-500/10 text-amber-600"
    : "bg-brand/10 text-brand";
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Pill de status da folha do colaborador.
function StatusPill({ f }: { f: any }) {
  if (!f)
    return <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Não gerada</span>;
  if (f.status === "paga")
    return <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Pago{f.paga_em ? ` · ${format(parseISO(f.paga_em), "dd/MM")}` : ""}</span>;
  if (f.status === "fechada")
    return <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Fechada</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Em aberto</span>;
}

// Card de um colaborador na folha (substitui a linha da tabela).
function ColaboradorCard({ p, cfg, f, onConfigurar, onCalcular, onFechar, onReabrir, onMarcarPago, onHolerite, onDetalhes }: any) {
  const iniciais = String(p.nome ?? "").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
  const formaLabel = FORMAS_REPASSE.find((x) => x.value === cfg?.forma_repasse)?.label ?? "Não configurado";

  const primary = !cfg
    ? { label: "Configurar", Icon: Settings2, onClick: onConfigurar, className: "flex-1 gradient-brand text-brand-foreground", variant: "default" as const }
    : !f
    ? { label: "Calcular", Icon: Calculator, onClick: onCalcular, className: "flex-1 gradient-brand text-brand-foreground", variant: "default" as const }
    : f.status !== "paga"
    ? { label: "Marcar pago", Icon: CheckCircle2, onClick: () => onMarcarPago(f), className: "flex-1 bg-emerald-600 text-white hover:bg-emerald-700", variant: "default" as const }
    : { label: "Holerite", Icon: Printer, onClick: () => onHolerite(f), className: "flex-1", variant: "outline" as const };

  return (
    <Card className="glass flex flex-col gap-3 p-4 transition hover:shadow-elegant">
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="gradient-brand text-sm text-brand-foreground">{iniciais}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{p.nome}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase">{cfg?.vinculo ?? "sem vínculo"}</Badge>
            <span className="truncate text-xs text-muted-foreground">{formaLabel}</span>
          </div>
        </div>
        <StatusPill f={f} />
      </div>

      <div className="rounded-xl bg-muted/40 p-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Líquido no mês</p>
            <p className="text-2xl font-semibold leading-tight">{f ? currency(Number(f.liquido)) : "—"}</p>
          </div>
          {f && (
            <div className="text-right text-[11px] leading-snug text-muted-foreground">
              {Number(f.salario_base) > 0 && <div>Salário {currency(Number(f.salario_base))}</div>}
              {Number(f.comissoes) > 0 && <div>Comissões {currency(Number(f.comissoes))}</div>}
              {Number(f.qtd_sessoes) > 0 && <div>{f.qtd_sessoes} sessões</div>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Button size="sm" variant={primary.variant} className={primary.className} onClick={primary.onClick}>
          <primary.Icon className="mr-1.5 h-3.5 w-3.5" />{primary.label}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDetalhes(cfg)} title="Detalhe por paciente">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onConfigurar}><Settings2 className="mr-2 h-4 w-4" />Configurar</DropdownMenuItem>
            {cfg && <DropdownMenuItem onClick={onCalcular}><Calculator className="mr-2 h-4 w-4" />Recalcular</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => onDetalhes(cfg)}><Eye className="mr-2 h-4 w-4" />Detalhe por paciente</DropdownMenuItem>
            {f && f.status !== "fechada" && f.status !== "paga" && (
              <DropdownMenuItem onClick={() => onFechar(f)}><Lock className="mr-2 h-4 w-4" />Fechar folha</DropdownMenuItem>
            )}
            {f && (f.status === "fechada" || f.status === "paga") && (
              <DropdownMenuItem onClick={() => onReabrir(f)}><Unlock className="mr-2 h-4 w-4" />Reabrir para editar</DropdownMenuItem>
            )}
            {f && (
              <DropdownMenuItem onClick={() => onMarcarPago(f)}>
                {f.status === "paga"
                  ? <><AlertTriangle className="mr-2 h-4 w-4" />Marcar não pago</>
                  : <><CheckCircle2 className="mr-2 h-4 w-4" />Marcar pago</>}
              </DropdownMenuItem>
            )}
            {f && <DropdownMenuSeparator />}
            {f && <DropdownMenuItem onClick={() => onHolerite(f)}><Printer className="mr-2 h-4 w-4" />Holerite</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
