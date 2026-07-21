import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { PacienteCombobox } from "./PacienteCombobox";
import { padraoParaAprendizado } from "@/lib/extrato-matching";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ORIGEM_LABEL: Record<string, string> = {
  aprendido: "Aprendido",
  nome: "Por nome",
  fornecedor: "Fornecedor",
  categoria: "Categoria",
};

type Transacao = {
  id: string;
  conta_financeira_id: string | null;
  data: string;
  descricao: string;
  valor: number;
  natureza: "receita" | "despesa";
  sugestao_origem: string | null;
  paciente_id: string | null;
  plano_conta_id: string | null;
  fornecedor_id: string | null;
  tipo_servico_id: string | null;
};

type EditState = {
  pacienteId: string | null;
  naoEhPaciente: boolean;
  tipoServicoId: string | null; // receita avulsa / não-paciente
  planoContaId: string | null; // despesa
  fornecedorId: string | null; // despesa
  pagamentoAlvo: string | null; // id de `pagamentos` a quitar, "avulso", ou null (ainda não resolvido)
};

function edicaoValida(row: Transacao, edit: EditState): boolean {
  if (row.natureza === "despesa") return !!edit.planoContaId;
  if (edit.naoEhPaciente) return !!edit.tipoServicoId;
  return !!edit.pacienteId;
}

async function aprovarLinha(row: Transacao, edit: EditState) {
  let lancamentoId: string | null = null;
  let pagamentoIdUsado: string | null = null;

  const quitaParcela = row.natureza === "receita" && !edit.naoEhPaciente && edit.pacienteId && edit.pagamentoAlvo && edit.pagamentoAlvo !== "avulso";

  if (quitaParcela) {
    const { error } = await supabase.from("pagamentos").update({
      status: "pago",
      pago_em: row.data,
      forma_pagamento: "Extrato bancário",
    }).eq("id", edit.pagamentoAlvo!);
    if (error) throw error;
    pagamentoIdUsado = edit.pagamentoAlvo!;
  } else {
    const payload: any = {
      tipo: row.natureza,
      status: "confirmado",
      descricao: row.descricao,
      valor: Math.abs(row.valor),
      vencimento: row.data,
      competencia: row.data,
      pago_em: row.data,
      forma_pagamento: "Extrato bancário",
      conta_id: row.conta_financeira_id,
    };
    if (row.natureza === "receita") {
      payload.paciente_id = edit.naoEhPaciente ? null : edit.pacienteId;
      payload.tipo_servico_id = edit.naoEhPaciente ? edit.tipoServicoId : null;
    } else {
      payload.plano_conta_id = edit.planoContaId;
      payload.fornecedor_id = edit.fornecedorId;
    }
    const { data, error } = await supabase.from("lancamentos_financeiros").insert(payload).select("id").single();
    if (error) throw error;
    lancamentoId = data.id;
  }

  const padrao = padraoParaAprendizado(row.descricao, row.natureza);
  if (padrao) {
    const learnPayload = row.natureza === "receita"
      ? {
          paciente_id: edit.naoEhPaciente ? null : edit.pacienteId,
          tipo_servico_id: edit.naoEhPaciente ? edit.tipoServicoId : null,
          plano_conta_id: null,
          fornecedor_id: null,
        }
      : {
          plano_conta_id: edit.planoContaId,
          fornecedor_id: edit.fornecedorId,
          paciente_id: null,
          tipo_servico_id: null,
        };
    const { data: existente } = await supabase
      .from("extrato_identificadores")
      .select("id, ocorrencias")
      .eq("padrao", padrao).eq("natureza", row.natureza).maybeSingle();
    if (existente) {
      await supabase.from("extrato_identificadores")
        .update({ ...learnPayload, ocorrencias: existente.ocorrencias + 1 }).eq("id", existente.id);
    } else {
      await supabase.from("extrato_identificadores").insert({ padrao, natureza: row.natureza, ocorrencias: 1, ...learnPayload });
    }
  }

  const { error: upErr } = await supabase.from("extrato_transacoes").update({
    status: "aprovado",
    lancamento_id: lancamentoId,
    pagamento_id: pagamentoIdUsado,
    paciente_id: row.natureza === "receita" && !edit.naoEhPaciente ? edit.pacienteId : null,
    plano_conta_id: row.natureza === "despesa" ? edit.planoContaId : null,
    fornecedor_id: row.natureza === "despesa" ? edit.fornecedorId : null,
    tipo_servico_id: row.natureza === "receita" && edit.naoEhPaciente ? edit.tipoServicoId : null,
  }).eq("id", row.id);
  if (upErr) throw upErr;
}

export function RevisaoExtrato() {
  const qc = useQueryClient();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [processando, setProcessando] = useState<string | "bulk" | null>(null);

  const { data: linhas } = useQuery({
    queryKey: ["extrato-transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extrato_transacoes").select("*")
        .eq("status", "pendente").order("data", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Transacao[];
    },
  });

  const { data: pacientes } = useQuery({
    queryKey: ["extrato-ref-pacientes"],
    queryFn: async () => (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: planoContas } = useQuery({
    queryKey: ["extrato-ref-planos"],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome, tipo, parent_id").eq("ativo", true).order("codigo")).data ?? [],
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["extrato-ref-fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: tiposServico } = useQuery({
    queryKey: ["extrato-ref-tipos"],
    queryFn: async () => (await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const planoContasDespesa = (planoContas ?? []).filter((p: any) => p.tipo === "despesa" && p.parent_id);

  function getEdit(row: Transacao): EditState {
    return edits[row.id] ?? {
      pacienteId: row.paciente_id,
      naoEhPaciente: row.natureza === "receita" && !row.paciente_id && !!row.tipo_servico_id,
      tipoServicoId: row.tipo_servico_id,
      planoContaId: row.plano_conta_id,
      fornecedorId: row.fornecedor_id,
      pagamentoAlvo: null,
    };
  }
  function setEdit(row: Transacao, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [row.id]: { ...getEdit(row), ...patch } }));
  }

  function toggleSelecionado(id: string, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function invalidarTudo() {
    qc.invalidateQueries({ queryKey: ["extrato-transacoes"] });
    qc.invalidateQueries({ queryKey: ["fin-serie-6m"] });
    invalidarFinanceiro(qc);
  }

  async function aprovarUma(row: Transacao) {
    const edit = getEdit(row);
    if (!edicaoValida(row, edit)) { toast.error("Selecione o paciente/categoria antes de aprovar"); return; }
    setProcessando(row.id);
    try {
      await aprovarLinha(row, edit);
      toast.success("Lançamento aprovado");
      setSelecionados((prev) => { const n = new Set(prev); n.delete(row.id); return n; });
      await invalidarTudo();
    } catch (e: any) {
      toast.error("Erro ao aprovar: " + (e?.message ?? e));
    } finally { setProcessando(null); }
  }

  async function ignorarUma(row: Transacao) {
    setProcessando(row.id);
    try {
      const { error } = await supabase.from("extrato_transacoes").update({ status: "ignorado" }).eq("id", row.id);
      if (error) throw error;
      setSelecionados((prev) => { const n = new Set(prev); n.delete(row.id); return n; });
      await invalidarTudo();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally { setProcessando(null); }
  }

  async function aprovarSelecionadas() {
    const alvo = (linhas ?? []).filter((l) => selecionados.has(l.id));
    const validas = alvo.filter((l) => edicaoValida(l, getEdit(l)));
    if (validas.length === 0) { toast.error("Nenhuma linha selecionada está pronta para aprovar"); return; }
    setProcessando("bulk");
    let ok = 0, falhas = 0;
    for (const row of validas) {
      try { await aprovarLinha(row, getEdit(row)); ok++; } catch { falhas++; }
    }
    setProcessando(null);
    setSelecionados(new Set());
    await invalidarTudo();
    const pulados = alvo.length - validas.length;
    toast.success(`${ok} lançamento(s) aprovado(s)${falhas ? `, ${falhas} com erro` : ""}${pulados ? `, ${pulados} pulado(s) por faltar categoria/paciente` : ""}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {(linhas ?? []).length} transação(ões) aguardando revisão. Nada é lançado até você aprovar.
        </p>
        <Button
          size="sm"
          className="gradient-brand text-white"
          disabled={selecionados.size === 0 || processando === "bulk"}
          onClick={aprovarSelecionadas}
        >
          {processando === "bulk" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
          Aprovar selecionadas ({selecionados.size})
        </Button>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={!!linhas?.length && selecionados.size === linhas.length}
                    onCheckedChange={(v) => setSelecionados(v ? new Set((linhas ?? []).map((l) => l.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Sugestão</TableHead>
                <TableHead className="min-w-[260px]">Categorização</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(linhas ?? []).map((row) => {
                const edit = getEdit(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox checked={selecionados.has(row.id)} onCheckedChange={(v) => toggleSelecionado(row.id, !!v)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{format(parseISO(row.data), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm max-w-[240px]">
                      <span className="line-clamp-2">{row.descricao}</span>
                      <Badge variant={row.natureza === "receita" ? "default" : "destructive"} className="mt-1 text-[10px]">{row.natureza}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.sugestao_origem ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Sparkles className="w-3 h-3" />{ORIGEM_LABEL[row.sugestao_origem] ?? row.sugestao_origem}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Sem sugestão</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.natureza === "receita" ? (
                        <CelulaReceita
                          row={row} edit={edit} onChange={(patch) => setEdit(row, patch)}
                          pacientes={pacientes ?? []} tiposServico={tiposServico ?? []}
                        />
                      ) : (
                        <CelulaDespesa
                          edit={edit} onChange={(patch) => setEdit(row, patch)}
                          planoContas={planoContasDespesa} fornecedores={fornecedores ?? []}
                        />
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap ${row.natureza === "despesa" ? "text-destructive" : "text-emerald-600"}`}>
                      {currency(Math.abs(row.valor))}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" disabled={processando === row.id} onClick={() => aprovarUma(row)} title="Aprovar">
                        {processando === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={processando === row.id} onClick={() => ignorarUma(row)} title="Ignorar">
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!linhas || linhas.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma transação aguardando revisão. Importe um extrato na aba "Importar".
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CelulaReceita({
  row, edit, onChange, pacientes, tiposServico,
}: {
  row: Transacao;
  edit: EditState;
  onChange: (patch: Partial<EditState>) => void;
  pacientes: { id: string; nome: string }[];
  tiposServico: { id: string; nome: string }[];
}) {
  const { data: pagamentosAbertos } = useQuery({
    queryKey: ["extrato-pagamentos-abertos", edit.pacienteId],
    queryFn: async () => {
      if (!edit.pacienteId) return [];
      const { data } = await supabase.from("pagamentos")
        .select("id, valor, vencimento, competencia")
        .eq("paciente_id", edit.pacienteId).in("status", ["pendente", "atrasado"]).order("vencimento");
      return data ?? [];
    },
    enabled: !!edit.pacienteId && !edit.naoEhPaciente,
  });

  useEffect(() => {
    if (edit.naoEhPaciente || !edit.pacienteId) return;
    if (edit.pagamentoAlvo !== null) return;
    if (pagamentosAbertos === undefined) return;
    if (pagamentosAbertos.length === 0) { onChange({ pagamentoAlvo: "avulso" }); return; }
    const alvo = [...pagamentosAbertos].sort(
      (a, b) => Math.abs(differenceInCalendarDays(parseISO(a.vencimento), parseISO(row.data))) - Math.abs(differenceInCalendarDays(parseISO(b.vencimento), parseISO(row.data)))
    )[0];
    onChange({ pagamentoAlvo: alvo.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit.pacienteId, edit.naoEhPaciente, pagamentosAbertos]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={edit.naoEhPaciente}
          onCheckedChange={(v) => onChange({ naoEhPaciente: v, pacienteId: v ? null : edit.pacienteId, pagamentoAlvo: null })}
        />
        <span className="text-[11px] text-muted-foreground">Não é de um paciente</span>
      </div>
      {edit.naoEhPaciente ? (
        <Select value={edit.tipoServicoId ?? ""} onValueChange={(v) => onChange({ tipoServicoId: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria da receita" /></SelectTrigger>
          <SelectContent>
            {tiposServico.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <>
          <PacienteCombobox
            pacientes={pacientes}
            value={edit.pacienteId}
            onChange={(id) => onChange({ pacienteId: id, pagamentoAlvo: null })}
          />
          {edit.pacienteId && (
            <Select value={edit.pagamentoAlvo ?? "avulso"} onValueChange={(v) => onChange({ pagamentoAlvo: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Quitar parcela" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avulso">Lançar como receita avulsa</SelectItem>
                {(pagamentosAbertos ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Mensalidade {format(parseISO(p.competencia), "MM/yyyy")} — {currency(Number(p.valor))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      )}
    </div>
  );
}

function CelulaDespesa({
  edit, onChange, planoContas, fornecedores,
}: {
  edit: EditState;
  onChange: (patch: Partial<EditState>) => void;
  planoContas: { id: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Select value={edit.planoContaId ?? ""} onValueChange={(v) => onChange({ planoContaId: v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria (plano de contas)" /></SelectTrigger>
        <SelectContent>
          {planoContas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={edit.fornecedorId ?? ""} onValueChange={(v) => onChange({ fornecedorId: v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fornecedor (opcional)" /></SelectTrigger>
        <SelectContent>
          {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
