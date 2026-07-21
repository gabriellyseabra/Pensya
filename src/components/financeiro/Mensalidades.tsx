import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseISO, isAfter, startOfDay, format, addMonths, endOfMonth } from "date-fns";
import { Loader2, CalendarPlus, TrendingUp, Wallet, AlertTriangle, DollarSign, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

type Paciente = { id: string; nome: string; status: string; foto_url: string | null };

/** Entrada normalizada, vinda de `pagamentos` (mensalidade) ou `lancamentos_financeiros` (receita c/ paciente). */
type Entrada = {
  id: string;
  origem: "pagamento" | "lancamento";
  paciente_id: string;
  mes: number;
  valor: number;
  status: string;
  vencimento: string;
};

type CelulaStatus = "pago" | "atrasado" | "previsto" | "isento" | "cancelado" | "vazio";
type Celula = { itens: Entrada[]; valor: number; status: CelulaStatus };

function statusEntrada(status: string, vencimento: string, hoje: Date): CelulaStatus {
  if (status === "pago") return "pago";
  if (status === "isento") return "isento";
  if (status === "cancelado") return "cancelado";
  if (status === "atrasado" || isAfter(hoje, parseISO(vencimento))) return "atrasado";
  return "previsto";
}

const PRIORIDADE: CelulaStatus[] = ["atrasado", "previsto", "pago", "isento", "cancelado"];

function agregarCelula(itens: Entrada[], hoje: Date): Celula {
  if (itens.length === 0) return { itens, valor: 0, status: "vazio" };
  const statuses = itens.map((i) => statusEntrada(i.status, i.vencimento, hoje));
  const status = PRIORIDADE.find((s) => statuses.includes(s)) ?? "vazio";
  const valor = itens.reduce((s, i, idx) => s + (statuses[idx] !== "cancelado" ? i.valor : 0), 0);
  return { itens, valor, status };
}

const CHIP_CLASSES: Record<CelulaStatus, string> = {
  pago: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  atrasado: "bg-destructive/15 text-destructive font-semibold",
  previsto: "bg-brand-yellow/30 text-foreground",
  isento: "bg-secondary text-muted-foreground line-through",
  cancelado: "bg-secondary/50 text-muted-foreground line-through",
  vazio: "",
};

const STATUS_LABEL: Record<CelulaStatus, string> = {
  pago: "Pago",
  atrasado: "Atrasado",
  previsto: "A vencer",
  isento: "Isento",
  cancelado: "Cancelado",
  vazio: "—",
};

/** Item de cobrança dentro do popover da célula — marcar pago/reverter e remover (com confirmação inline). */
function CobrancaPopoverItem({
  item, hoje, onToggle, onRemover, pendingToggle, pendingRemover,
}: {
  item: Entrada;
  hoje: Date;
  onToggle: () => void;
  onRemover: () => void;
  pendingToggle: boolean;
  pendingRemover: boolean;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const st = statusEntrada(item.status, item.vencimento, hoje);
  const pago = st === "pago";
  const podeAlternar = st !== "isento" && st !== "cancelado";
  return (
    <div className="rounded-lg border border-border/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{currency(item.valor)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${CHIP_CLASSES[st]}`}>{STATUS_LABEL[st]}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {item.origem === "pagamento" ? "Mensalidade" : "Receita avulsa"} · vence {format(parseISO(item.vencimento), "dd/MM/yyyy")}
      </p>
      {!confirmar ? (
        <div className="flex gap-1.5">
          {podeAlternar && (
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" disabled={pendingToggle} onClick={onToggle}>
              <Check className="h-3.5 w-3.5 mr-1" />{pago ? "Reverter" : "Marcar pago"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setConfirmar(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Remover esta cobrança? Não pode ser desfeito.</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="destructive" className="h-7 flex-1 text-xs" disabled={pendingRemover} onClick={onRemover}>
              {pendingRemover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remover"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmar(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "brand" }: { icon: any; label: string; value: string; tone?: "brand" | "success" | "danger" | "warning" | "muted" }) {
  const toneClasses: Record<string, string> = {
    brand: "gradient-brand text-white",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-destructive/15 text-destructive",
    warning: "bg-brand-yellow/40 text-foreground",
    muted: "bg-secondary text-foreground",
  };
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-soft shrink-0 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GerarMensalidades({ onGerado }: { onGerado: () => void }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mesAlvo, setMesAlvo] = useState(() => format(new Date(), "yyyy-MM"));

  const gerar = useMutation({
    mutationFn: async (mes: string) => {
      const competencia = `${mes}-01`;
      const fimMes = format(addMonths(parseISO(competencia), 1), "yyyy-MM-dd");

      const { data: ativos, error: errAtivos } = await supabase
        .from("pacientes").select("id, modelo_pagamento, valor_acordado, dia_vencimento").eq("status", "ativo");
      if (errAtivos) throw errAtivos;

      const ultimoDiaDoMes = Number(format(endOfMonth(parseISO(competencia)), "d"));
      const diaVencimentoPorPaciente = new Map((ativos ?? []).map((p) => [p.id, p.dia_vencimento]));
      function vencimentoDe(pacienteId: string): string {
        const dia = diaVencimentoPorPaciente.get(pacienteId);
        const diaValido = Math.min(dia && dia > 0 ? dia : 5, ultimoDiaDoMes);
        return `${mes}-${String(diaValido).padStart(2, "0")}`;
      }

      const { data: existentes, error: errExist } = await supabase
        .from("pagamentos").select("paciente_id").eq("competencia", competencia);
      if (errExist) throw errExist;
      const jaTem = new Set((existentes ?? []).map((e) => e.paciente_id));

      const faltantes = (ativos ?? []).filter((p) => !jaTem.has(p.id));
      if (faltantes.length === 0) {
        return { geradas: 0, semHistorico: 0, semSessao: 0, jaExistiam: (ativos ?? []).length };
      }

      const porSessao = faltantes.filter((p) => p.modelo_pagamento === "sessao");
      const porMensal = faltantes.filter((p) => p.modelo_pagamento !== "sessao");

      // Pacientes por mensalidade fixa: reaproveita o último valor pago/lançado.
      const { data: historico, error: errHist } = porMensal.length
        ? await supabase
            .from("pagamentos")
            .select("paciente_id, valor, competencia")
            .in("paciente_id", porMensal.map((p) => p.id))
            .lt("competencia", competencia)
            .order("competencia", { ascending: false })
        : { data: [], error: null };
      if (errHist) throw errHist;
      const ultimoValor = new Map<string, number>();
      for (const h of historico ?? []) {
        if (!ultimoValor.has(h.paciente_id)) ultimoValor.set(h.paciente_id, Number(h.valor));
      }
      const insertsMensal = porMensal
        .filter((p) => ultimoValor.has(p.id))
        .map((p) => ({
          paciente_id: p.id,
          competencia,
          valor: ultimoValor.get(p.id)!,
          vencimento: vencimentoDe(p.id),
          status: "pendente",
          observacoes: "Gerado automaticamente (mensalidade recorrente)",
        }));

      // Pacientes por sessão: projeta pela quantidade de atendimentos planejados no mês.
      const contagemSessoes = new Map<string, number>();
      if (porSessao.length) {
        const { data: atendimentos, error: errAt } = await supabase
          .from("atendimentos")
          .select("paciente_id, status_frequencia:status_frequencia(conta_presenca)")
          .in("paciente_id", porSessao.map((p) => p.id))
          .gte("inicio", competencia)
          .lt("inicio", fimMes);
        if (errAt) throw errAt;
        for (const a of atendimentos ?? []) {
          if ((a as any).status_frequencia?.conta_presenca === false) continue;
          contagemSessoes.set(a.paciente_id, (contagemSessoes.get(a.paciente_id) ?? 0) + 1);
        }
      }
      const insertsSessao = porSessao
        .map((p) => {
          const n = contagemSessoes.get(p.id) ?? 0;
          if (n === 0 || !p.valor_acordado) return null;
          return {
            paciente_id: p.id,
            competencia,
            valor: n * Number(p.valor_acordado),
            vencimento: vencimentoDe(p.id),
            status: "pendente" as const,
            observacoes: `Gerado automaticamente — projeção de ${n} sessão(ões) × ${currency(Number(p.valor_acordado))}`,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const inserts = [...insertsMensal, ...insertsSessao];
      if (inserts.length) {
        const { error } = await supabase.from("pagamentos").insert(inserts);
        if (error) throw error;
      }

      return {
        geradas: inserts.length,
        semHistorico: porMensal.length - insertsMensal.length,
        semSessao: porSessao.length - insertsSessao.length,
        jaExistiam: jaTem.size,
      };
    },
    onSuccess: (r) => {
      onGerado();
      setPopoverOpen(false);
      const partes = [`${r.geradas} mensalidade(s) gerada(s)`];
      if (r.jaExistiam) partes.push(`${r.jaExistiam} já existiam`);
      if (r.semHistorico) partes.push(`${r.semHistorico} sem histórico de valor (adicione manualmente)`);
      if (r.semSessao) partes.push(`${r.semSessao} sem sessão planejada no mês (não geradas)`);
      toast.success(partes.join(", "));
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar mensalidades"),
  });

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-9">
          <CalendarPlus className="w-4 h-4 mr-1" />
          Gerar mensalidades
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div>
          <Label className="text-xs">Gerar para pacientes ativos na competência</Label>
          <Input type="month" value={mesAlvo} onChange={(e) => setMesAlvo(e.target.value)} className="h-9 mt-1" />
        </div>
        <Button size="sm" disabled={gerar.isPending} onClick={() => gerar.mutate(mesAlvo)} className="gradient-brand text-white w-full">
          {gerar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarPlus className="w-4 h-4 mr-1" />}
          Gerar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function Mensalidades() {
  const qc = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [filtroPacientes, setFiltroPacientes] = useState<"ativos" | "todos">("ativos");
  const hoje = startOfDay(new Date());

  const { data: pacientes } = useQuery({
    queryKey: ["mensalidades-pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacientes").select("id, nome, status, foto_url").order("nome");
      if (error) throw error;
      return (data ?? []) as Paciente[];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["mensalidades-pagamentos", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, paciente_id, competencia, valor, status, vencimento")
        .gte("competencia", `${ano}-01-01`).lte("competencia", `${ano}-12-31`);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Receitas avulsas vinculadas a um paciente (sessão avulsa, pacote mensal, etc.) também entram na grade.
  const { data: lancPaciente } = useQuery({
    queryKey: ["mensalidades-lancamentos", ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("id, paciente_id, competencia, valor, status, vencimento")
        .eq("tipo", "receita").not("paciente_id", "is", null).neq("status", "cancelado")
        .gte("competencia", `${ano}-01-01`).lte("competencia", `${ano}-12-31`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alternarStatus = useMutation({
    mutationFn: async (e: Entrada) => {
      const vaiPagar = e.status !== "pago" && e.status !== "confirmado";
      if (e.origem === "pagamento") {
        const { error } = await supabase.from("pagamentos").update({
          status: vaiPagar ? "pago" : "pendente",
          pago_em: vaiPagar ? new Date().toISOString().slice(0, 10) : null,
        }).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lancamentos_financeiros").update({
          status: vaiPagar ? "confirmado" : "previsto",
          pago_em: vaiPagar ? new Date().toISOString().slice(0, 10) : null,
        }).eq("id", e.id);
        if (error) throw error;
      }
      return vaiPagar;
    },
    onSuccess: (vaiPagar) => {
      invalidarFinanceiro(qc);
      toast.success(vaiPagar ? "Marcado como pago" : "Revertido para pendente");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const removerCobranca = useMutation({
    mutationFn: async (e: Entrada) => {
      const tabela = e.origem === "pagamento" ? "pagamentos" : "lancamentos_financeiros";
      const { error } = await supabase.from(tabela).delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFinanceiro(qc);
      toast.success("Cobrança removida");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover cobrança"),
  });

  const { linhas, totaisMes, totalGeral, resumo } = useMemo(() => {
    const entradas: Entrada[] = [
      ...(pagamentos ?? []).map((p) => ({
        id: p.id, origem: "pagamento" as const, paciente_id: p.paciente_id,
        mes: parseISO(p.competencia).getMonth(), valor: Number(p.valor), status: p.status, vencimento: p.vencimento,
      })),
      ...(lancPaciente ?? []).map((l) => ({
        id: l.id, origem: "lancamento" as const, paciente_id: l.paciente_id as string,
        mes: parseISO(l.competencia).getMonth(), valor: Number(l.valor),
        status: l.status === "confirmado" ? "pago" : "pendente", vencimento: l.vencimento,
      })),
    ];

    const grupos = new Map<string, Entrada[]>();
    for (const e of entradas) {
      const key = `${e.paciente_id}-${e.mes}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(e);
    }

    const idsComEntrada = new Set(entradas.map((e) => e.paciente_id));
    const relevantes = (pacientes ?? []).filter((pac) =>
      filtroPacientes === "todos"
        ? pac.status === "ativo" || idsComEntrada.has(pac.id)
        : pac.status === "ativo",
    );

    const linhas = relevantes.map((pac) => {
      const meses = Array.from({ length: 12 }, (_, m) => agregarCelula(grupos.get(`${pac.id}-${m}`) ?? [], hoje));
      const total = meses.reduce((s, c) => s + c.valor, 0);
      return { paciente: pac, meses, total };
    });

    const totaisMes = Array.from({ length: 12 }, (_, m) => linhas.reduce((s, l) => s + l.meses[m].valor, 0));
    const totalGeral = totaisMes.reduce((s, v) => s + v, 0);

    const resumo = { recebido: 0, aReceber: 0, atrasado: 0 };
    for (const l of linhas) {
      for (const c of l.meses) {
        if (c.status === "pago") resumo.recebido += c.valor;
        else if (c.status === "previsto") resumo.aReceber += c.valor;
        else if (c.status === "atrasado") resumo.atrasado += c.valor;
      }
    }

    return { linhas, totaisMes, totalGeral, resumo };
  }, [pacientes, pagamentos, lancPaciente, hoje, filtroPacientes]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label={`Recebido em ${ano}`} value={currency(resumo.recebido)} tone="success" />
        <Kpi icon={Wallet} label="A receber" value={currency(resumo.aReceber)} tone="brand" />
        <Kpi icon={AlertTriangle} label="Atrasado" value={currency(resumo.atrasado)} tone="danger" />
        <Kpi icon={DollarSign} label="Total do ano" value={currency(totalGeral)} tone="muted" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[ano - 1, ano, ano + 1].filter((v, i, arr) => arr.indexOf(v) === i).sort().map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <GerarMensalidades onGerado={() => invalidarFinanceiro(qc)} />
          <Select value={filtroPacientes} onValueChange={(v) => setFiltroPacientes(v as "ativos" | "todos")}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Somente ativos</SelectItem>
              <SelectItem value="todos">Todos os pacientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60 inline-block" />Pago</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-yellow/70 inline-block" />A vencer</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive/60 inline-block" />Atrasado</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-secondary inline-block" />Isento/cancelado</span>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Paciente</TableHead>
                {MESES.map((m) => <TableHead key={m} className="text-center min-w-[84px] text-xs">{m}</TableHead>)}
                <TableHead className="text-center min-w-[100px] text-xs">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ paciente, meses, total }) => (
                <TableRow key={paciente.id}>
                  <TableCell className="sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Link to="/pacientes/$id" params={{ id: paciente.id }} className="flex items-center gap-2 group min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          {paciente.foto_url && <AvatarImage src={paciente.foto_url} />}
                          <AvatarFallback className="gradient-brand text-brand-foreground text-[10px]">
                            {iniciais(paciente.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[150px] group-hover:underline">{paciente.nome}</span>
                      </Link>
                      {paciente.status !== "ativo" && (
                        <Badge variant="outline" className="shrink-0 border-muted-foreground/40 text-[10px] text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {meses.map((celula, mi) => (
                    <TableCell key={mi} className="text-center p-1.5">
                      {celula.itens.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              title="Ver / gerenciar cobrança"
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition cursor-pointer hover:opacity-75 ${CHIP_CLASSES[celula.status]}`}
                            >
                              {currency(celula.valor)}
                              {celula.itens.length > 1 && <span className="opacity-70">×{celula.itens.length}</span>}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 space-y-2 p-2" align="center">
                            <p className="px-1 text-xs font-medium">
                              {MESES[mi]} · <span className="text-muted-foreground">{paciente.nome}</span>
                            </p>
                            {celula.itens.map((item) => (
                              <CobrancaPopoverItem
                                key={`${item.origem}-${item.id}`}
                                item={item}
                                hoje={hoje}
                                onToggle={() => alternarStatus.mutate(item)}
                                onRemover={() => removerCobranca.mutate(item)}
                                pendingToggle={alternarStatus.isPending}
                                pendingRemover={removerCobranca.isPending}
                              />
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-sm font-semibold">{total > 0 ? currency(total) : "—"}</TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={14} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum paciente ou pagamento encontrado para {ano}.
                </TableCell></TableRow>
              )}
            </TableBody>
            {linhas.length > 0 && (
              <TableFooter>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="sticky left-0 bg-secondary/30 z-10 text-xs">Total do mês</TableHead>
                  {totaisMes.map((t, i) => (
                    <TableHead key={i} className="text-center text-xs font-normal text-muted-foreground">{t > 0 ? currency(t) : "—"}</TableHead>
                  ))}
                  <TableHead className="text-center text-xs font-semibold">{currency(totalGeral)}</TableHead>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
