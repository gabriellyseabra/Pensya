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
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calculator, Settings2, Lock, Printer, AlertTriangle } from "lucide-react";
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

      const salario = Number(cfg.salario_base || 0);
      const beneficios = Number(cfg.beneficios || 0);
      // comissão: prioriza valor/sessão se > 0; senão usa % sobre receita do mês desse profissional
      let comissoes = 0;
      if (Number(cfg.valor_por_sessao) > 0) {
        comissoes = sessoesContadas * Number(cfg.valor_por_sessao);
      } else if (Number(cfg.comissao_percentual) > 0) {
        const { data: pacientesIds } = await supabase
          .from("paciente_profissionais").select("paciente_id").eq("profissional_id", profId);
        const ids = (pacientesIds ?? []).map((x) => x.paciente_id);
        if (ids.length) {
          const { data: pags } = await supabase
            .from("pagamentos").select("valor")
            .in("paciente_id", ids)
            .eq("status", "pago")
            .gte("pago_em", ini.slice(0, 10))
            .lte("pago_em", fim.slice(0, 10));
          const receita = (pags ?? []).reduce((s, p) => s + Number(p.valor), 0);
          comissoes = receita * (Number(cfg.comissao_percentual) / 100);
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
        detalhes: { vinculo, encargos_pct: ENCARGOS[vinculo], regra: Number(cfg.valor_por_sessao) > 0 ? "valor_por_sessao" : "percentual_receita" },
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

  const totalLiquido = (folhas ?? []).reduce((s, f) => s + Number(f.liquido || 0), 0);
  const totalEncargos = (folhas ?? []).reduce((s, f) => s + Number(f.encargos || 0), 0);

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={refMonth}
          onChange={(e) => setRefMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <div className="flex-1" />
        <Badge variant="outline">Líquido total: {currency(totalLiquido)}</Badge>
        <Badge variant="outline">Encargos: {currency(totalEncargos)}</Badge>
      </div>

      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead className="text-right">Salário</TableHead>
                <TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-72 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profs ?? []).map((p) => {
                const cfg = configByProf(p.id);
                const f = folhaByProf(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell><Badge variant="outline">{cfg?.vinculo ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right">{currency(Number(cfg?.salario_base || 0))}</TableCell>
                    <TableCell className="text-right">{f ? currency(Number(f.comissoes)) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{f ? currency(Number(f.liquido)) : "—"}</TableCell>
                    <TableCell>
                      {f ? <Badge variant={f.status === "fechada" ? "default" : "secondary"}>{f.status}</Badge> : <span className="text-xs text-muted-foreground">não gerada</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => { setConfigProf(p); setConfigOpen(true); }}>
                        <Settings2 className="w-3 h-3 mr-1" />Configurar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => gerar.mutate(p.id)} disabled={!cfg}>
                        <Calculator className="w-3 h-3 mr-1" />Calcular
                      </Button>
                      {f && f.status !== "fechada" && (
                        <Button size="sm" onClick={() => fechar.mutate(f)}>
                          <Lock className="w-3 h-3 mr-1" />Fechar
                        </Button>
                      )}
                      {f && (
                        <Button size="sm" variant="ghost" onClick={() => setHolerite({ ...f, profissional: p })}>
                          <Printer className="w-3 h-3 mr-1" />Holerite
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!profs || profs.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum colaborador cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ColaboradorConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        profissional={configProf}
        config={configProf ? configByProf(configProf.id) : null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["folha-configs"] })}
      />

      <HoleriteDialog folha={holerite} onClose={() => setHolerite(null)} />
    </div>
  );
}

function ColaboradorConfigDialog({ open, onOpenChange, profissional, config, onSaved }: any) {
  const defaults = { vinculo: "autonomo", salario_base: 0, comissao_percentual: 0, valor_por_sessao: 0, beneficios: 0, descontos_fixos: 0, dependentes: 0 };
  const [form, setForm] = useState<any>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(config ?? defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profissional?.id, config?.id]);

  async function salvar() {
    if (!profissional) return;
    setSaving(true);
    try {
      const payload = {
        profissional_id: profissional.id,
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
      <DialogContent>
        <DialogHeader><DialogTitle>Configurar {profissional?.nome}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <Label>Salário base (R$)</Label>
            <Input type="number" step="0.01" value={form.salario_base ?? 0} onChange={(e) => setForm({ ...form, salario_base: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Benefícios (R$)</Label>
            <Input type="number" step="0.01" value={form.beneficios ?? 0} onChange={(e) => setForm({ ...form, beneficios: Number(e.target.value) })} />
          </div>
          <div>
            <Label>% Comissão sobre receita</Label>
            <Input type="number" step="0.01" value={form.comissao_percentual ?? 0} onChange={(e) => setForm({ ...form, comissao_percentual: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor por sessão (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_por_sessao ?? 0} onChange={(e) => setForm({ ...form, valor_por_sessao: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Descontos fixos (R$)</Label>
            <Input type="number" step="0.01" value={form.descontos_fixos ?? 0} onChange={(e) => setForm({ ...form, descontos_fixos: Number(e.target.value) })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se "Valor por sessão" &gt; 0, ele é usado e a comissão % é ignorada.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
