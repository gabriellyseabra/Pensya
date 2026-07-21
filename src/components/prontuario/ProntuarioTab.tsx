import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatData } from "@/lib/datas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Target, Activity, TrendingUp, CheckCircle2, Pencil, Trash2,
  Plus, FlaskConical, FileAudio, CalendarCheck2, Clock, XCircle,
} from "lucide-react";
import { SessaoDialog } from "@/components/prontuario/SessaoDialog";
import { PlanejamentoSessoes } from "@/components/prontuario/PlanejamentoSessoes";
import { ImportarSessoesDialog } from "@/components/prontuario/ImportarSessoesDialog";

const NIVEIS_SUPORTE = [
  { value: "independente", label: "Independente" },
  { value: "verbal", label: "Suporte verbal" },
  { value: "gestual", label: "Suporte gestual" },
  { value: "fisico_parcial", label: "Físico parcial" },
  { value: "fisico_total", label: "Físico total" },
];

const ENGAJAMENTO_LABELS = [
  { value: "1", label: "Muito baixo" },
  { value: "2", label: "Baixo" },
  { value: "3", label: "Moderado" },
  { value: "4", label: "Alto" },
  { value: "5", label: "Muito alto" },
];

const TIPOS_FREQUENCIA = [
  { value: "presente", label: "Presente", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "falta_justificada", label: "Falta justificada", cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "falta_nao_justificada", label: "Falta não justificada", cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { value: "reposicao", label: "Reposição", cor: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "cancelado_profissional", label: "Cancelado pelo profissional", cor: "bg-muted text-muted-foreground" },
];

const STATUS_META = [
  { value: "planejamento", label: "Em planejamento" },
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
  { value: "arquivada", label: "Arquivada" },
];

const DOMINIOS = [
  "Atenção", "Memória", "Funções executivas", "Linguagem",
  "Visuoespacial", "Velocidade de processamento", "Cognição social",
  "Acadêmico - Leitura", "Acadêmico - Escrita", "Acadêmico - Matemática",
];

export function ProntuarioTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [novaSessaoTipo, setNovaSessaoTipo] = useState<null | "avaliacao" | "intervencao">(null);
  const [novaSessaoAtend, setNovaSessaoAtend] = useState<{ atendimentoId: string; data: string } | null>(null);
  const [editSessaoId, setEditSessaoId] = useState<string | null>(null);
  const [editSessaoTipo, setEditSessaoTipo] = useState<"avaliacao" | "intervencao">("intervencao");

  const { data: sessoes = [] } = useQuery({
    queryKey: ["prontuario-sessoes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("*, sessao_metas(meta_id, engajamento, nivel_suporte, nivel_gas_observado, meta:metas_terapeuticas(titulo))")
        .eq("paciente_id", pacienteId)
        .order("data_sessao", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["metas", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas_terapeuticas")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("ordem", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: frequencia = [] } = useQuery({
    queryKey: ["frequencia", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_referencia", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  // KPIs
  const totalSessoes = sessoes.length;
  const presencas = frequencia.filter((f) => f.tipo === "presente" || f.tipo === "reposicao").length;
  const taxaPresenca = frequencia.length
    ? Math.round((presencas / frequencia.length) * 100)
    : 0;
  const metasAtivas = metas.filter((m) => m.status === "ativa").length;
  const metasPlanejamento = metas.filter((m) => m.status === "planejamento").length;
  const arquivadasCount = metas.filter((m) => m.status === "arquivada").length;
  const metasVisiveis = mostrarArquivadas ? metas : metas.filter((m) => m.status !== "arquivada");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prontuario-sessoes", pacienteId] });
    qc.invalidateQueries({ queryKey: ["frequencia", pacienteId] });
    qc.invalidateQueries({ queryKey: ["evolucao-sessoes", pacienteId] });
  };

  async function excluirSessao(id: string) {
    if (!confirm("Excluir esta sessão? Os vínculos com metas também serão removidos.")) return;
    const { error } = await supabase.from("prontuario_sessoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    toast.success("Sessão excluída");
    invalidate();
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Sessões registradas" value={String(totalSessoes)} />
        <KpiCard icon={<CalendarCheck2 className="h-4 w-4" />} label="Taxa de presença" value={`${taxaPresenca}%`} />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Metas ativas" value={String(metasAtivas)} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Em planejamento" value={String(metasPlanejamento)} />
      </div>

      {/* Ações: criação de meta (sessão e frequência ficam no workflow do header) */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setNovaSessaoTipo("intervencao")}>
          <Target className="mr-2 h-4 w-4" /> Sessão intervenção
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setNovaSessaoTipo("avaliacao")}>
          <FlaskConical className="mr-2 h-4 w-4" /> Sessão avaliação
        </Button>
        <NovaMetaDialog pacienteId={pacienteId} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["metas", pacienteId] });
        }} />
        <ImportarSessoesDialog pacienteId={pacienteId} onDone={invalidate} />
      </div>

      {/* Planejamento das próximas sessões */}
      <PlanejamentoSessoes
        pacienteId={pacienteId}
        onRegistrar={(atendimentoId, dataISO) => {
          setNovaSessaoAtend({ atendimentoId, data: dataISO.slice(0, 10) });
          setNovaSessaoTipo("intervencao");
        }}
      />

      {/* Metas em andamento */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Metas terapêuticas</CardTitle>
          {arquivadasCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={mostrarArquivadas} onCheckedChange={setMostrarArquivadas} />
              Mostrar arquivadas ({arquivadasCount})
            </label>
          )}
        </CardHeader>
        <CardContent>
          {metasVisiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {metas.length === 0 ? "Nenhuma meta cadastrada ainda." : "Nenhuma meta ativa. Ative “Mostrar arquivadas” para ver as arquivadas."}
            </p>
          ) : (
            <div className="space-y-2">
              {metasVisiveis.map((m) => (
                <MetaRow key={m.id} meta={m} onChanged={() => qc.invalidateQueries({ queryKey: ["metas", pacienteId] })} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de sessões */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Sessões recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {sessoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Eng.</TableHead>
                  <TableHead>Suporte</TableHead>
                  <TableHead>Metas / GAS</TableHead>
                  <TableHead>Mídia</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessoes.slice(0, 15).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(s.data_sessao, "dd/MM/yy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.tipo === "avaliacao" ? "secondary" : "outline"} className="text-[10px]">
                        {s.tipo === "avaliacao" ? "Avaliação" : "Intervenção"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {ENGAJAMENTO_LABELS.find((e) => e.value === String(s.engajamento))?.label ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {NIVEIS_SUPORTE.find((n) => n.value === s.nivel_suporte)?.label ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      {(s.sessao_metas ?? []).length === 0 ? "—" : (s.sessao_metas ?? []).map((sm: any) => (
                        <span key={sm.meta_id} className="inline-block mr-2">
                          {sm.meta?.titulo}
                          {sm.nivel_gas_observado != null && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              GAS {sm.nivel_gas_observado > 0 ? "+" : ""}{sm.nivel_gas_observado}
                            </Badge>
                          )}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" title={s.orientacao_casa ? `Orientação de casa: ${s.orientacao_status === "feita" ? "feita" : s.orientacao_status === "nao_feita" ? "não feita" : "pendente"}` : undefined}>
                        {s.audio_path && <FileAudio className="h-4 w-4 text-brand" />}
                        {s.orientacao_casa && s.orientacao_status === "feita" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {s.orientacao_casa && s.orientacao_status === "nao_feita" && <XCircle className="h-4 w-4 text-red-600" />}
                        {s.orientacao_casa && (!s.orientacao_status || s.orientacao_status === "pendente") && <Clock className="h-4 w-4 text-amber-600" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditSessaoTipo((s.tipo as any) ?? "intervencao");
                        setEditSessaoId(s.id);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => excluirSessao(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Frequência recente */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Frequência recente</CardTitle>
        </CardHeader>
        <CardContent>
          {frequencia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de frequência.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {frequencia.slice(0, 20).map((f) => {
                const tipo = TIPOS_FREQUENCIA.find((t) => t.value === f.tipo);
                return (
                  <div key={f.id} className={`rounded-md px-2 py-1 text-xs ${tipo?.cor ?? "bg-muted"}`}>
                    {formatData(f.data_referencia, "dd/MM")} · {tipo?.label ?? f.tipo}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogos */}
      {novaSessaoTipo && (
        <SessaoDialog
          open={!!novaSessaoTipo}
          onOpenChange={(v) => { if (!v) { setNovaSessaoTipo(null); setNovaSessaoAtend(null); } }}
          pacienteId={pacienteId}
          tipo={novaSessaoTipo}
          atendimentoId={novaSessaoAtend?.atendimentoId ?? null}
          dataInicial={novaSessaoAtend?.data}
          onSaved={invalidate}
        />
      )}
      {editSessaoId && (
        <SessaoDialog
          open={!!editSessaoId}
          onOpenChange={(v) => !v && setEditSessaoId(null)}
          pacienteId={pacienteId}
          tipo={editSessaoTipo}
          sessaoId={editSessaoId}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

// =================== Nova Meta ===================
function NovaMetaDialog({
  pacienteId, onSaved,
}: { pacienteId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dominio, setDominio] = useState<string>("");
  const [prioridade, setPrioridade] = useState("3");
  const [status, setStatus] = useState("planejamento");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Informe o título da meta"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("metas_terapeuticas").insert({
        paciente_id: pacienteId,
        titulo,
        descricao: descricao || null,
        dominio_cognitivo: dominio || null,
        prioridade: Number(prioridade),
        status,
        iniciada_em: status === "ativa" ? format(new Date(), "yyyy-MM-dd") : null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Meta criada");
      setOpen(false); onSaved();
      setTitulo(""); setDescricao(""); setDominio("");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Target className="mr-2 h-4 w-4" /> Nova meta</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova meta terapêutica</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Aumentar tempo de atenção sustentada" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Domínio cognitivo</Label>
              <Select value={dominio} onValueChange={setDominio}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {DOMINIOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade (1=alta, 5=baixa)</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Criar meta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== Meta Row ===================
function MetaRow({ meta, onChanged }: { meta: any; onChanged: () => void }) {
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState(meta.status);

  const statusInfo = STATUS_META.find((s) => s.value === meta.status);
  const statusCor = {
    planejamento: "bg-muted text-muted-foreground",
    ativa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pausada: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    concluida: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  }[meta.status as string] ?? "bg-muted";

  async function atualizarStatus(novo: string) {
    const patch: any = { status: novo };
    if (novo === "ativa" && !meta.iniciada_em) patch.iniciada_em = format(new Date(), "yyyy-MM-dd");
    if (novo === "concluida") patch.concluida_em = format(new Date(), "yyyy-MM-dd");
    const { error } = await supabase.from("metas_terapeuticas").update(patch).eq("id", meta.id);
    if (error) { toast.error("Erro", { description: error.message }); return; }
    setStatus(novo);
    setEditando(false);
    onChanged();
  }

  async function excluir() {
    if (!confirm("Excluir esta meta?")) return;
    const { error } = await supabase.from("metas_terapeuticas").delete().eq("id", meta.id);
    if (error) { toast.error("Erro", { description: error.message }); return; }
    onChanged();
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{meta.titulo}</span>
          <Badge className={statusCor} variant="outline">{statusInfo?.label ?? meta.status}</Badge>
          {meta.dominio_cognitivo && <Badge variant="secondary">{meta.dominio_cognitivo}</Badge>}
          <span className="text-xs text-muted-foreground">P{meta.prioridade}</span>
        </div>
        {meta.descricao && <p className="text-sm text-muted-foreground mt-1">{meta.descricao}</p>}
      </div>
      <div className="flex items-center gap-1">
        {editando ? (
          <Select value={status} onValueChange={atualizarStatus}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Button size="icon" variant="ghost" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={excluir}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
