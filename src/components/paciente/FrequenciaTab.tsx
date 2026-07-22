import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatData, parseDataLocal } from "@/lib/datas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Trash2, CalendarCheck, Eye } from "lucide-react";
import { SessaoDialog } from "@/components/prontuario/SessaoDialog";
import { consumirReposicaoPendente, listarFaltasPendentes } from "@/lib/frequencia";

const TIPOS = [
  { value: "presente", label: "Presente", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", presenca: true },
  { value: "falta_justificada", label: "Falta justificada", cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300", presenca: false },
  { value: "falta_nao_justificada", label: "Falta não justificada", cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300", presenca: false },
  { value: "reposicao", label: "Reposição", cor: "bg-blue-500/15 text-blue-700 dark:text-blue-300", presenca: true },
  { value: "cancelado_profissional", label: "Cancelado pelo profissional", cor: "bg-muted text-muted-foreground", presenca: false },
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Freq = {
  id: string; data_referencia: string; tipo: string; motivo: string | null;
  reposto_em: string | null; sessao_id: string | null; created_at: string;
  sessao?: { id: string; tipo: string } | null;
};

export function FrequenciaTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [mes, setMes] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Freq | null>(null);
  const [sessaoAberta, setSessaoAberta] = useState<{ id: string; tipo: "avaliacao" | "intervencao" } | null>(null);

  const ano = mes.getFullYear();
  const anoInicio = startOfYear(mes).toISOString().slice(0, 10);
  const anoFim = endOfYear(mes).toISOString().slice(0, 10);

  // Busca o ano inteiro de uma vez: alimenta tanto a tabela do mês quanto os gráficos.
  const { data: registrosAno = [] } = useQuery({
    queryKey: ["frequencia-paciente", pacienteId, ano],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("*, sessao:prontuario_sessoes(id, tipo)")
        .eq("paciente_id", pacienteId)
        .gte("data_referencia", anoInicio)
        .lte("data_referencia", anoFim)
        .order("data_referencia", { ascending: false });
      return (data ?? []) as Freq[];
    },
  });

  const inicioMes = startOfMonth(mes);
  const fimMes = endOfMonth(mes);
  const registrosMes = useMemo(
    () => registrosAno.filter((r) => {
      const d = parseDataLocal(r.data_referencia);
      return d && d >= inicioMes && d <= fimMes;
    }),
    [registrosAno, inicioMes, fimMes],
  );

  const stats = useMemo(() => {
    const total = registrosMes.length;
    const presentes = registrosMes.filter((r) => TIPOS.find((t) => t.value === r.tipo)?.presenca).length;
    return { total, presentes, faltas: total - presentes, taxa: total > 0 ? Math.round((presentes / total) * 100) : 0 };
  }, [registrosMes]);

  // Série mensal para o gráfico do ano.
  const dadosGrafico = useMemo(() => {
    return MESES_CURTOS.map((nome, idx) => {
      const doMes = registrosAno.filter((r) => parseDataLocal(r.data_referencia)?.getMonth() === idx);
      return {
        mes: nome,
        Presenças: doMes.filter((r) => r.tipo === "presente").length,
        Faltas: doMes.filter((r) => r.tipo === "falta_justificada" || r.tipo === "falta_nao_justificada").length,
        Reposições: doMes.filter((r) => r.tipo === "reposicao").length,
      };
    });
  }, [registrosAno]);

  const totaisAno = useMemo(() => ({
    presencas: registrosAno.filter((r) => r.tipo === "presente").length,
    faltas: registrosAno.filter((r) => r.tipo === "falta_justificada" || r.tipo === "falta_nao_justificada").length,
    reposicoes: registrosAno.filter((r) => r.tipo === "reposicao").length,
  }), [registrosAno]);

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("frequencia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); invalidar(); },
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["frequencia-paciente", pacienteId] });
    qc.invalidateQueries({ queryKey: ["frequencia", pacienteId] });
    qc.invalidateQueries({ queryKey: ["prontuario-sessoes", pacienteId] });
  }

  /** Abre o registro: sessão real (SessaoDialog) quando houver vínculo; senão o editor de falta/reposição. */
  function abrir(r: Freq) {
    if (r.sessao_id && r.sessao) {
      const tipo = r.sessao.tipo === "avaliacao" ? "avaliacao" : "intervencao";
      setSessaoAberta({ id: r.sessao_id, tipo });
    } else {
      setEditing(r);
      setOpen(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Registros no mês" value={String(stats.total)} icon={<CalendarCheck className="w-4 h-4" />} />
        <Stat label="Presenças" value={String(stats.presentes)} tone="success" />
        <Stat label="Faltas/cancelamentos" value={String(stats.faltas)} tone="danger" />
        <Stat label="Taxa de presença" value={`${stats.taxa}%`} tone="brand" />
      </div>

      {/* Gráfico anual */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Frequência em {ano}</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Dot className="bg-emerald-500" /> {totaisAno.presencas} presenças</span>
            <span className="flex items-center gap-1"><Dot className="bg-rose-500" /> {totaisAno.faltas} faltas</span>
            <span className="flex items-center gap-1"><Dot className="bg-blue-500" /> {totaisAno.reposicoes} reposições</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Presenças" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Faltas" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Reposições" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela do mês */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setMes(subMonths(mes, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <CardTitle className="text-base capitalize min-w-40 text-center">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setMes(addMonths(mes, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Registrar falta/reposição
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Reposto em</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrosMes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum registro neste mês.</TableCell></TableRow>
              )}
              {registrosMes.map((r) => {
                const t = TIPOS.find((x) => x.value === r.tipo);
                const temSessao = !!(r.sessao_id && r.sessao);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatData(r.data_referencia, "dd/MM/yyyy (EEE)")}</TableCell>
                    <TableCell><Badge className={t?.cor}>{t?.label ?? r.tipo}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{r.motivo ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatData(r.reposto_em)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{temSessao ? "Sessão" : "Manual"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => abrir(r)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> {temSessao ? "Ver sessão" : "Editar"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este registro de frequência?")) remover.mutate(r.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FreqDialog
        open={open} onOpenChange={setOpen} editing={editing} pacienteId={pacienteId}
        onSaved={invalidar}
      />

      {sessaoAberta && (
        <SessaoDialog
          open={!!sessaoAberta}
          onOpenChange={(v) => { if (!v) setSessaoAberta(null); }}
          pacienteId={pacienteId}
          tipo={sessaoAberta.tipo}
          sessaoId={sessaoAberta.id}
          onSaved={invalidar}
        />
      )}
    </div>
  );
}

function FreqDialog({
  open, onOpenChange, editing, pacienteId, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Freq | null; pacienteId: string; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Partial<Freq>>(editing ?? { data_referencia: today, tipo: "falta_justificada" });
  const [saving, setSaving] = useState(false);
  const [faltaAlvo, setFaltaAlvo] = useState<string>("");

  useMemo(() => {
    setForm(editing ?? { data_referencia: today, tipo: "falta_justificada" });
    setFaltaAlvo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open]);

  // Faltas justificadas pendentes, para escolher qual está sendo reposta.
  const { data: faltasPendentes } = useQuery({
    queryKey: ["faltas-pendentes", pacienteId],
    enabled: open && form.tipo === "reposicao",
    queryFn: () => listarFaltasPendentes(pacienteId),
  });

  async function salvar() {
    setSaving(true);
    try {
      const payload: any = {
        paciente_id: pacienteId,
        data_referencia: form.data_referencia,
        tipo: form.tipo,
        motivo: form.motivo || null,
        reposto_em: form.reposto_em || null,
      };
      const res = editing
        ? await supabase.from("frequencia").update(payload).eq("id", editing.id)
        : await supabase.from("frequencia").insert(payload);
      if (res.error) throw res.error;
      // Lançar uma reposição consome a falta justificada pendente mais antiga.
      if (form.tipo === "reposicao") {
        await consumirReposicaoPendente(
          pacienteId,
          form.reposto_em || form.data_referencia || new Date().toISOString().slice(0, 10),
          faltaAlvo || undefined,
        );
      }
      toast.success("Salvo");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar registro" : "Novo registro de frequência"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.data_referencia ?? ""} onChange={(e) => setForm({ ...form, data_referencia: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo ?? "falta_justificada"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.tipo === "reposicao" && (
            <>
              <div>
                <Label className="text-xs">Data da reposição</Label>
                <Input type="date" value={form.reposto_em ?? ""} onChange={(e) => setForm({ ...form, reposto_em: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Falta que está sendo reposta</Label>
                {(faltasPendentes?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhuma falta justificada pendente. A reposição será apenas registrada.
                  </p>
                ) : (
                  <Select value={faltaAlvo || "auto"} onValueChange={(v) => setFaltaAlvo(v === "auto" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Mais antiga pendente</SelectItem>
                      {(faltasPendentes ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {formatData(f.data_referencia, "dd/MM/yyyy")}{f.motivo ? ` — ${f.motivo}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Motivo / observações</Label>
            <Textarea rows={3} value={form.motivo ?? ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "success" | "danger" | "brand" }) {
  const toneClass = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : tone === "brand" ? "text-brand" : "";
  return (
    <Card className="glass">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Dot({ className }: { className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}
