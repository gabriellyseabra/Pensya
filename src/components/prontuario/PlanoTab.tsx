import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import {
  Sparkles, Search, Plus, FileText, Trash2, CheckCircle2, BookOpen, Upload, Printer, Target, RotateCw,
  Info, Network, Lightbulb, FlaskConical, ListPlus, TrendingUp,
  Layers, Compass, ListOrdered, Brain, Waypoints, Archive, MoreHorizontal, Wand2,
} from "lucide-react";
import { gerarPlanoIA, buscarPubMed, extrairPdfAvaliacao, adicionarMetasIA } from "@/lib/plano.functions";
import { imprimirPlano } from "@/lib/plano-documento";
import { RevisaoCicloDialog } from "./RevisaoCicloDialog";
import { FormulacaoEditor } from "./FormulacaoEditor";
import { FontesDocumentais } from "./FontesDocumentais";
import { ObjetivosEditor, type Objetivo } from "./ObjetivosEditor";
import { MetaSparkline } from "@/components/paciente/MetaProgressChart";
import { SectionCard } from "@/components/shared/SectionCard";

const FONTE_LABEL: Record<string, string> = {
  anamnese: "Anamnese", entrevista_familiar: "Entrevista familiar", avaliacao: "Avaliação",
  teste: "Teste", protocolo: "Protocolo", observacao: "Observação clínica",
  sessao_avaliacao: "Sessão de avaliação", reuniao_escolar: "Reunião escolar",
  relatorio_escolar: "Relatório escolar", relatorio_medico: "Relatório médico",
  arquivo: "Arquivo", complementar: "Complementar",
};

const CONFIANCA_LABEL: Record<string, { label: string; cls: string }> = {
  alta: { label: "Confiança alta", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" },
  media: { label: "Confiança média", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" },
  baixa: { label: "Confiança baixa", cls: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200" },
};

const STATUS_PLANO = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "finalizado", label: "Finalizado" },
];

const IMPACTO = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
];

const GAS_LABELS: Record<number, { label: string; cls: string }> = {
  [-2]: { label: "−2 Estagnação", cls: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200" },
  [-1]: { label: "−1 Progresso insuficiente", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" },
  [0]: { label: "0 Meta atingida", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" },
  [1]: { label: "+1 Acima do esperado", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" },
  [2]: { label: "+2 Generalização", cls: "bg-teal-100 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200" },
};

export function PlanoTab({ pacienteId, onVerMonitoramento }: { pacienteId: string; onVerMonitoramento?: () => void }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos_terapeuticos")
        .select("id, titulo, status, ciclo_semanas, data_inicio, data_revisao_prevista, ai_gerado_em, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!selectedId && planos[0]) setSelectedId(planos[0].id);
  }, [planos, selectedId]);

  async function criarPlano() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("planos_terapeuticos")
      .insert({
        paciente_id: pacienteId,
        titulo: `Plano — ${format(new Date(), "MMM/yyyy", { locale: ptBR })}`,
        ciclo_semanas: 12,
        data_inicio: format(new Date(), "yyyy-MM-dd"),
        criado_por: user?.id,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Plano criado");
    qc.invalidateQueries({ queryKey: ["planos", pacienteId] });
    setSelectedId(data.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plano Terapêutico</h2>
          <p className="text-xs text-muted-foreground">CIF · GAS · Metas SMART funcionais</p>
        </div>
        <Button onClick={criarPlano}><Plus className="mr-2 h-4 w-4" />Novo plano</Button>
      </div>

      {planos.length === 0 ? (
        <Card className="glass"><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum plano cadastrado. Crie um plano para começar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="glass h-fit">
            <CardHeader><CardTitle className="text-sm">Planos</CardTitle></CardHeader>
            <CardContent className="space-y-1 p-2">
              {planos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === p.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium line-clamp-1">{p.titulo}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_PLANO.find((s) => s.value === p.status)?.label ?? p.status}
                    </Badge>
                    {p.ai_gerado_em && <Sparkles className="h-3 w-3 text-purple-500" />}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {selectedId && (
            <div className="min-w-0">
              <PlanoDetalhe pacienteId={pacienteId} planoId={selectedId} onDeleted={() => setSelectedId(null)} onVerMonitoramento={onVerMonitoramento} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanoDetalhe({ pacienteId, planoId, onDeleted, onVerMonitoramento }: { pacienteId: string; planoId: string; onDeleted: () => void; onVerMonitoramento?: () => void }) {
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarPlanoIA);
  const pubmedFn = useServerFn(buscarPubMed);
  const extrairFn = useServerFn(extrairPdfAvaliacao);
  const adicionarMetasFn = useServerFn(adicionarMetasIA);

  const { data: dominiosCognitivos = [] } = useQuery({
    queryKey: ["dominios-cognitivos"],
    queryFn: async () => {
      const { data } = await supabase.from("dominios_cognitivos").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: plano } = useQuery({
    queryKey: ["plano", planoId],
    queryFn: async () => {
      const { data } = await supabase.from("planos_terapeuticos").select("*").eq("id", planoId).single();
      return data as any;
    },
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["plano-metas", planoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plano_metas")
        .select("*, plano_gas(nivel, descricao), plano_estrategias(*), plano_meta_componentes(*), plano_meta_fontes(*)")
        .eq("plano_id", planoId)
        .order("ordem");
      return (data ?? []) as any[];
    },
  });

  const { data: objetivos = [] } = useQuery({
    queryKey: ["plano-objetivos", planoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plano_objetivos")
        .select("*")
        .eq("plano_id", planoId)
        .order("ordem");
      return (data ?? []) as Objetivo[];
    },
  });

  // Metas ativas do prontuário que não existem mais em nenhum plano (órfãs por regeneração)
  const { data: metasOrfas = [] } = useQuery({
    queryKey: ["metas-orfas", pacienteId],
    queryFn: async () => {
      const { data: mts } = await supabase
        .from("metas_terapeuticas")
        .select("id, titulo, status")
        .eq("paciente_id", pacienteId)
        .in("status", ["ativa", "planejamento"]);
      const ativos = (mts ?? []) as any[];
      if (!ativos.length) return [] as any[];
      const { data: pls } = await supabase.from("planos_terapeuticos").select("id").eq("paciente_id", pacienteId);
      const planoIds = (pls ?? []).map((p: any) => p.id);
      const linkados = new Set<string>();
      if (planoIds.length) {
        const { data: pm } = await supabase
          .from("plano_metas").select("meta_terapeutica_id").in("plano_id", planoIds).not("meta_terapeutica_id", "is", null);
        (pm ?? []).forEach((r: any) => r.meta_terapeutica_id && linkados.add(r.meta_terapeutica_id));
      }
      return ativos.filter((m) => !linkados.has(m.id));
    },
  });

  const { data: evidencias = [] } = useQuery({
    queryKey: ["plano-evidencias", planoId],
    queryFn: async () => {
      const { data } = await supabase.from("plano_evidencias").select("*").eq("plano_id", planoId).order("created_at");
      return (data ?? []) as any[];
    },
  });

  // Pontuações por meta (sparkline + progresso médio)
  const metaTerapeuticasIds = metas.map((m: any) => m.meta_terapeutica_id).filter(Boolean);
  const { data: pontuacoes = [] } = useQuery({
    enabled: metaTerapeuticasIds.length > 0,
    queryKey: ["plano-pontuacoes", planoId, metaTerapeuticasIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessao_metas")
        .select("meta_id, desempenho, nivel_gas_observado, sessao:prontuario_sessoes!inner(id, data_sessao, paciente_id)")
        .in("meta_id", metaTerapeuticasIds)
        .eq("sessao.paciente_id", pacienteId);
      return (data ?? []) as any[];
    },
  });

  const pontosPorMeta = new Map<string, any[]>();
  for (const p of pontuacoes) {
    const arr = pontosPorMeta.get(p.meta_id) ?? [];
    arr.push({ data: (p as any).sessao?.data_sessao, desempenho: p.desempenho, gas: p.nivel_gas_observado });
    pontosPorMeta.set(p.meta_id, arr);
  }
  for (const arr of pontosPorMeta.values()) arr.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

  const metasComProgresso = metas.filter((m: any) => (pontosPorMeta.get(m.meta_terapeutica_id) ?? []).length > 0);
  const metasSemVinculo = metas.filter((m: any) => !m.meta_terapeutica_id).length;

  const desempenhosTodos = pontuacoes.map((p: any) => p.desempenho).filter((n: any) => n != null);
  const progressoMedio = desempenhosTodos.length
    ? +(desempenhosTodos.reduce((a: number, b: number) => a + b, 0) / desempenhosTodos.length).toFixed(1)
    : null;

  const metasEmRisco = metas.filter((m: any) => {
    const pontos = pontosPorMeta.get(m.meta_terapeutica_id) ?? [];
    const recentes = pontos.slice(-4).map((p) => p.desempenho).filter((n) => n != null) as number[];
    if (recentes.length < 3) return false;
    const media = recentes.reduce((a, b) => a + b, 0) / recentes.length;
    return media < 2.5;
  }).length;

  const semanasDecorridas = plano?.data_inicio
    ? Math.floor((Date.now() - new Date(plano.data_inicio).getTime()) / (1000 * 60 * 60 * 24 * 7))
    : null;

  const [form, setForm] = useState<any>({});
  const [contextoExtra, setContextoExtra] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [showIaDialog, setShowIaDialog] = useState(false);
  const [showRevisaoDialog, setShowRevisaoDialog] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [showAddMetasDialog, setShowAddMetasDialog] = useState(false);
  const [dominiosFoco, setDominiosFoco] = useState<string[]>([]);
  const [dominioCustom, setDominioCustom] = useState("");
  const [contextoExtraNovasMetas, setContextoExtraNovasMetas] = useState("");
  const [addMetasLoading, setAddMetasLoading] = useState(false);

  useEffect(() => { if (plano) setForm(plano); }, [plano]);

  async function salvar() {
    const allowed = [
      "titulo", "ciclo_semanas", "data_inicio", "data_revisao_prevista", "status",
      "queixa_principal", "diagnostico_resumo", "medicacao", "frequencia_sessoes",
      "cif_funcoes", "cif_funcoes_impacto", "cif_atividades", "cif_atividades_impacto",
      "cif_participacao", "cif_participacao_impacto", "cif_ambientais", "cif_pessoais",
      "objetivo_participacao", "orientacoes_familia", "orientacoes_escola",
      "parceiros_clinicos", "observacoes_revisao", "data_revisao_realizada",
    ];
    const payload: any = {};
    for (const k of allowed) if (k in form) payload[k] = form[k] === "" ? null : form[k];
    const { error } = await supabase.from("planos_terapeuticos").update(payload).eq("id", planoId);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano salvo");
    qc.invalidateQueries({ queryKey: ["plano", planoId] });
    qc.invalidateQueries({ queryKey: ["planos", pacienteId] });
  }

  async function gerarIA() {
    setIaLoading(true);
    try {
      const result = await gerarFn({ data: { plano_id: planoId, contexto_extra: contextoExtra || undefined } });
      toast.success(`Plano gerado · ${result.metas_geradas} metas · ${result.objetivos_gerados ?? 0} objetivos`);
      setShowIaDialog(false);
      setContextoExtra("");
      qc.invalidateQueries({ queryKey: ["plano", planoId] });
      qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
      qc.invalidateQueries({ queryKey: ["plano-formulacao", planoId] });
      qc.invalidateQueries({ queryKey: ["plano-objetivos", planoId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar plano");
    } finally {
      setIaLoading(false);
    }
  }

  function toggleDominioFoco(nome: string) {
    setDominiosFoco((prev) => prev.includes(nome) ? prev.filter((d) => d !== nome) : [...prev, nome]);
  }

  function adicionarDominioCustom() {
    const nome = dominioCustom.trim();
    if (!nome) return;
    if (!dominiosFoco.includes(nome)) setDominiosFoco((prev) => [...prev, nome]);
    setDominioCustom("");
  }

  async function adicionarMetas() {
    if (dominiosFoco.length === 0) { toast.error("Selecione ao menos um domínio de foco"); return; }
    setAddMetasLoading(true);
    try {
      const result = await adicionarMetasFn({
        data: { plano_id: planoId, dominios_foco: dominiosFoco, contexto_extra: contextoExtraNovasMetas || undefined },
      });
      toast.success(`${result.metas_geradas} nova(s) meta(s) adicionada(s)`);
      setShowAddMetasDialog(false);
      setDominiosFoco([]);
      setContextoExtraNovasMetas("");
      qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar novas metas");
    } finally {
      setAddMetasLoading(false);
    }
  }

  // Cria metas_terapeuticas (que alimentam o registro de sessão) para cada
  // plano_meta ainda sem vínculo. Retorna quantas foram ativadas.
  async function bridgeMetas(): Promise<number> {
    let ativadas = 0;
    for (const m of metas) {
      if (m.meta_terapeutica_id) continue;
      const { data: novaMeta } = await supabase
        .from("metas_terapeuticas")
        .insert({
          paciente_id: pacienteId,
          titulo: m.titulo_smart,
          descricao: m.justificativa,
          dominio_cognitivo: m.dominio,
          status: "ativa",
          prioridade: 2,
        })
        .select("id")
        .single();
      if (novaMeta) {
        await supabase.from("plano_metas").update({ meta_terapeutica_id: novaMeta.id }).eq("id", m.id);
        ativadas++;
      }
    }
    return ativadas;
  }

  function invalidarMetas() {
    qc.invalidateQueries({ queryKey: ["plano", planoId] });
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
    qc.invalidateQueries({ queryKey: ["metas", pacienteId] });
    // usadas no registro de sessão / planejamento / monitoramento
    qc.invalidateQueries({ queryKey: ["sessao-metas-paciente", pacienteId] });
    qc.invalidateQueries({ queryKey: ["sessao-plano-meta-map", pacienteId] });
    qc.invalidateQueries({ queryKey: ["planejamento-metas", pacienteId] });
    qc.invalidateQueries({ queryKey: ["metas-orfas", pacienteId] });
  }

  // Arquiva (soft) metas do prontuário que não existem mais em nenhum plano.
  // Mantém o histórico de sessões e o monitoramento — apenas some do registro de sessão.
  async function arquivarOrfas() {
    if (metasOrfas.length === 0) return;
    if (!confirm(`Arquivar ${metasOrfas.length} meta(s) que não existem mais no plano? Elas somem do registro de sessão, mas o histórico e o monitoramento são preservados.`)) return;
    const ids = metasOrfas.map((m: any) => m.id);
    const { error } = await supabase.from("metas_terapeuticas").update({ status: "arquivada" }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} meta(s) arquivada(s)`);
    invalidarMetas();
  }

  async function aprovar() {
    if (!confirm("Aprovar plano e ativar as metas no prontuário?")) return;
    await supabase.from("planos_terapeuticos").update({
      status: "em_andamento",
      aprovado_em: new Date().toISOString(),
    }).eq("id", planoId);
    await bridgeMetas();
    toast.success("Plano aprovado · metas ativadas");
    invalidarMetas();
  }

  // Sincroniza metas novas (geradas por IA num plano já em andamento) com o prontuário.
  async function ativarMetas() {
    const n = await bridgeMetas();
    toast.success(n > 0 ? `${n} meta(s) ativada(s) no registro de sessão` : "As metas já estavam ativas");
    invalidarMetas();
  }

  async function excluir() {
    if (!confirm("Excluir este plano e todas as metas/GAS/estratégias?")) return;
    const { error } = await supabase.from("planos_terapeuticos").delete().eq("id", planoId);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano excluído");
    qc.invalidateQueries({ queryKey: ["planos", pacienteId] });
    onDeleted();
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("Máx 15MB"); return; }
    setPdfUploading(true);
    try {
      const path = `planos/${pacienteId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("prontuario-docs").upload(path, file);
      if (upErr) throw upErr;
      const result = await extrairFn({ data: { paciente_id: pacienteId, storage_path: path } });
      if (result.ok && result.dados) {
        const d = result.dados as any;
        const novaContext = [
          d.hipotese_diagnostica && `Hipótese diagnóstica extraída: ${d.hipotese_diagnostica}`,
          d.queixas_familia && `Queixas família: ${d.queixas_familia}`,
          d.queixas_escola && `Queixas escola: ${d.queixas_escola}`,
          d.perfil_cognitivo && `Perfil: ${typeof d.perfil_cognitivo === "string" ? d.perfil_cognitivo : JSON.stringify(d.perfil_cognitivo)}`,
          d.testes?.length && `Testes:\n${d.testes.map((t: any) => `- ${t.nome} (${t.dominio}): percentil ${t.percentil}, ${t.classificacao}`).join("\n")}`,
          d.recomendacoes && `Recomendações: ${d.recomendacoes}`,
        ].filter(Boolean).join("\n\n");
        setContextoExtra((prev) => (prev ? prev + "\n\n" : "") + novaContext);
        toast.success("PDF processado · dados adicionados ao contexto");
        setShowIaDialog(true);
      } else {
        toast.warning("PDF processado, mas dados não puderam ser estruturados");
      }
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setPdfUploading(false);
      e.target.value = "";
    }
  }

  if (!plano) return <Card className="glass"><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <Select value={form.status ?? "rascunho"} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_PLANO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={form.ciclo_semanas ?? 12} onChange={(e) => setForm({ ...form, ciclo_semanas: parseInt(e.target.value, 10) || 12 })} />
          <span className="text-xs text-muted-foreground">semanas</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button onClick={salvar} variant="outline" size="sm">Salvar</Button>
            <Button onClick={() => setShowIaDialog(true)} size="sm" className="gradient-brand text-brand-foreground">
              <Sparkles className="mr-2 h-4 w-4" />Gerar com IA
            </Button>
            {plano.status === "em_andamento" && metas.length > 0 && (
              <Button onClick={() => setShowRevisaoDialog(true)} size="sm" variant="secondary">
                <RotateCw className="mr-2 h-4 w-4" />Revisar ciclo
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {metas.length > 0 && (
                  <DropdownMenuItem onClick={() => setShowAddMetasDialog(true)}>
                    <ListPlus className="mr-2 h-4 w-4" />Adicionar metas com IA
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { imprimirPlano(planoId).catch((e) => toast.error(e.message || "Falha ao gerar documento")); }}>
                  <Printer className="mr-2 h-4 w-4" />Imprimir / PDF
                </DropdownMenuItem>
                {plano.status === "em_andamento" && metasSemVinculo > 0 && (
                  <DropdownMenuItem onClick={ativarMetas}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Ativar metas no prontuário ({metasSemVinculo})
                  </DropdownMenuItem>
                )}
                {metasOrfas.length > 0 && (
                  <DropdownMenuItem onClick={arquivarOrfas}>
                    <Archive className="mr-2 h-4 w-4" />Arquivar metas fora do plano ({metasOrfas.length})
                  </DropdownMenuItem>
                )}
                {plano.status !== "em_andamento" && plano.status !== "finalizado" && metas.length > 0 && (
                  <DropdownMenuItem onClick={aprovar}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Aprovar plano
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={excluir} className="text-rose-600 focus:text-rose-600">
                  <Trash2 className="mr-2 h-4 w-4" />Excluir plano
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Destaque: não comece do zero — importe fontes e gere com IA */}
      <Card className="glass overflow-hidden border-brand/30">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-brand text-brand-foreground">
            <Wand2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Não precisa escrever do zero</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A IA cruza o que já existe no sistema (anamnese, avaliações e testes) com os documentos
              que você anexar (laudos, relatórios, registros antigos) e monta a formulação e as metas.
              Revise e ajuste — o trabalho braçal é da IA.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfUploading} />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="mr-2 h-4 w-4" />{pdfUploading ? "Processando…" : "Anexar laudo"}</span>
              </Button>
            </label>
            <Button onClick={() => setShowIaDialog(true)} size="sm" className="gradient-brand text-brand-foreground">
              <Sparkles className="mr-2 h-4 w-4" />Gerar com IA
            </Button>
          </div>
        </div>
      </Card>

      {/* Header de progresso */}
      {plano.status === "em_andamento" && metas.length > 0 && (
        <Card className="glass border-brand/30">
          <CardContent className="p-4 grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Desempenho médio</p>
              <p className="text-2xl font-semibold">{progressoMedio ?? "—"}<span className="text-xs text-muted-foreground">/5</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ciclo</p>
              <p className="text-2xl font-semibold">{semanasDecorridas ?? 0}<span className="text-xs text-muted-foreground">/{plano.ciclo_semanas} sem</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Metas em risco</p>
              <p className={`text-2xl font-semibold ${metasEmRisco > 0 ? "text-rose-600" : "text-emerald-600"}`}>{metasEmRisco}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revisão prevista</p>
              <p className="text-sm font-medium mt-1">{plano.data_revisao_prevista ? format(new Date(plano.data_revisao_prevista), "dd/MM/yyyy") : "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {metas.length > 0 && onVerMonitoramento && (
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            A evolução das metas (desempenho e GAS a cada sessão) vive no <strong className="text-foreground">Monitoramento</strong>.
          </p>
          <Button size="sm" variant="outline" onClick={onVerMonitoramento}>
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />Ver evolução
          </Button>
        </div>
      )}

      <SectionCard title="Contexto clínico" description="Queixa, hipóteses, medicação e objetivo do ciclo" icon={Info} defaultOpen={false}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Queixa principal"><Textarea rows={2} value={form.queixa_principal ?? ""} onChange={(e) => setForm({ ...form, queixa_principal: e.target.value })} /></Field>
          <Field label="Hipótese diagnóstica"><Textarea rows={2} value={form.diagnostico_resumo ?? ""} onChange={(e) => setForm({ ...form, diagnostico_resumo: e.target.value })} /></Field>
          <Field label="Medicação"><Input value={form.medicacao ?? ""} onChange={(e) => setForm({ ...form, medicacao: e.target.value })} /></Field>
          <Field label="Frequência de sessões"><Input placeholder="ex: 1x/semana, 50min" value={form.frequencia_sessoes ?? ""} onChange={(e) => setForm({ ...form, frequencia_sessoes: e.target.value })} /></Field>
          <Field label="Data início"><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></Field>
          <Field label="Revisão prevista"><Input type="date" value={form.data_revisao_prevista ?? ""} onChange={(e) => setForm({ ...form, data_revisao_prevista: e.target.value })} /></Field>
          <Field className="md:col-span-2" label="Objetivo de participação (o que muda na vida real ao final do ciclo)">
            <Textarea rows={3} value={form.objetivo_participacao ?? ""} onChange={(e) => setForm({ ...form, objetivo_participacao: e.target.value })} />
          </Field>
        </div>
      </SectionCard>

      <FontesDocumentais pacienteId={pacienteId} />

      <FontesIntegradas raciocinio={plano.raciocinio_clinico} />

      <SectionCard title="Formulação Clínica" description="ETAPA 2 · Restrições, limitações, funções (hipóteses) e fatores — CIF estruturada e priorizável" icon={Network} defaultOpen={false}>
        <FormulacaoEditor planoId={planoId} />
        <LegadoCif form={form} setForm={setForm} onSalvar={salvar} />
      </SectionCard>

      <RaciocinioSecao planoId={planoId} raciocinio={plano.raciocinio_clinico} onSaved={() => qc.invalidateQueries({ queryKey: ["plano", planoId] })} />

      <PriorizacaoSecao raciocinio={plano.raciocinio_clinico} />

      <SectionCard title={`Objetivos & Metas (${objetivos.length} obj · ${metas.length} metas)`} description="ETAPA 5-8 · Poucos objetivos funcionais; cada meta traz seu Mapa (componentes, fontes, confiança) e plano" icon={Compass}>
        <GasExplicador />
        {objetivos.length === 0 && metas.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Nenhum objetivo ou meta. Use <strong>Gerar com IA</strong> ou adicione manualmente.
            <div className="mt-3 flex justify-center gap-2">
              <NovaMetaButton planoId={planoId} objetivoId={null} onSaved={() => qc.invalidateQueries({ queryKey: ["plano-metas", planoId] })} />
            </div>
          </div>
        ) : (
          <ObjetivosEditor
            planoId={planoId}
            objetivos={objetivos}
            renderMetas={(objetivoId) =>
              metas.filter((m: any) => m.objetivo_id === objetivoId).map((m: any) => (
                <MetaCard key={m.id} planoId={planoId} meta={m} pubmedFn={pubmedFn} objetivos={objetivos} pontos={pontosPorMeta.get(m.meta_terapeutica_id) ?? []} />
              ))
            }
            novaMetaSlot={(objetivoId) => (
              <NovaMetaButton planoId={planoId} objetivoId={objetivoId} onSaved={() => qc.invalidateQueries({ queryKey: ["plano-metas", planoId] })} />
            )}
            metasSemObjetivo={(() => {
              const semObj = metas.filter((m: any) => !m.objetivo_id);
              if (semObj.length === 0) return null;
              return (
                <div className="rounded-lg border border-dashed border-border/60 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Metas sem objetivo</p>
                  <div className="space-y-3">
                    {semObj.map((m: any) => (
                      <MetaCard key={m.id} planoId={planoId} meta={m} pubmedFn={pubmedFn} objetivos={objetivos} pontos={pontosPorMeta.get(m.meta_terapeutica_id) ?? []} />
                    ))}
                  </div>
                </div>
              );
            })()}
          />
        )}
      </SectionCard>

      <SectionCard title="Orientações" description="Família, escola e articulações" icon={Lightbulb} defaultOpen={false}>
        <div className="grid gap-3">
          <Field label="Orientações para a família"><Textarea rows={5} value={form.orientacoes_familia ?? ""} onChange={(e) => setForm({ ...form, orientacoes_familia: e.target.value })} /></Field>
          <Field label="Orientações para a escola"><Textarea rows={5} value={form.orientacoes_escola ?? ""} onChange={(e) => setForm({ ...form, orientacoes_escola: e.target.value })} /></Field>
          <Field label="Parceiros clínicos / articulações"><Textarea rows={3} value={form.parceiros_clinicos ?? ""} onChange={(e) => setForm({ ...form, parceiros_clinicos: e.target.value })} /></Field>
          <Field label="Observações de revisão"><Textarea rows={3} value={form.observacoes_revisao ?? ""} onChange={(e) => setForm({ ...form, observacoes_revisao: e.target.value })} /></Field>
        </div>
      </SectionCard>

      <SectionCard title={`Evidências (${evidencias.length})`} description="Artigos PubMed anexados às metas" icon={FlaskConical} defaultOpen={false}>
        {evidencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma evidência anexada. Use o botão <BookOpen className="inline h-3 w-3" /> em cada meta para buscar artigos no PubMed.</p>
        ) : (
          <div className="space-y-2">
            {evidencias.map((e) => (
              <div key={e.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <a href={e.url} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">{e.titulo}</a>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await supabase.from("plano_evidencias").delete().eq("id", e.id);
                    qc.invalidateQueries({ queryKey: ["plano-evidencias", planoId] });
                  }}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="text-xs text-muted-foreground">{e.autores} · {e.journal} · {e.ano}</div>
                {e.resumo && <p className="mt-1 line-clamp-3 text-xs">{e.resumo}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={showIaDialog} onOpenChange={setShowIaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar plano com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A IA cruza a queixa, anamnese, avaliações, testes e os <strong>documentos-fonte anexados</strong> (com texto extraído) para construir a formulação clínica, os objetivos e as metas com Mapa da Meta. Anexe relatórios em <strong>Fontes documentais</strong> para pacientes antigos.
            </p>
            <Field label="Contexto adicional (opcional)">
              <Textarea rows={6} placeholder="Cole observações de reuniões, transcrições, ou contexto extra..." value={contextoExtra} onChange={(e) => setContextoExtra(e.target.value)} />
            </Field>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              ⚠️ Metas já revisadas (com nível GAS atingido) serão preservadas. Metas em rascunho serão substituídas.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowIaDialog(false)}>Cancelar</Button>
            <Button onClick={gerarIA} disabled={iaLoading}>
              <Sparkles className="mr-2 h-4 w-4" />{iaLoading ? "Gerando…" : "Gerar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMetasDialog} onOpenChange={setShowAddMetasDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar metas com IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A IA vai gerar metas novas, complementares às já existentes — sem apagar nem alterar o que já está no plano.
            </p>
            <Field label="Domínios de foco para as novas metas">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {dominiosCognitivos.map((d) => {
                  const ativo = dominiosFoco.includes(d.nome);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDominioFoco(d.nome)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        ativo ? "bg-brand text-brand-foreground border-brand" : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {d.nome}
                    </button>
                  );
                })}
                {dominiosFoco.filter((nome) => !dominiosCognitivos.some((d) => d.nome === nome)).map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => toggleDominioFoco(nome)}
                    className="rounded-full border px-2.5 py-1 text-xs bg-brand text-brand-foreground border-brand"
                  >
                    {nome}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Outro domínio…"
                  value={dominioCustom}
                  onChange={(e) => setDominioCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarDominioCustom(); } }}
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={adicionarDominioCustom}>Adicionar</Button>
              </div>
            </Field>
            <Field label="Contexto adicional (opcional)">
              <Textarea rows={4} placeholder="Cole observações de reuniões, transcrições, ou contexto extra..." value={contextoExtraNovasMetas} onChange={(e) => setContextoExtraNovasMetas(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddMetasDialog(false)}>Cancelar</Button>
            <Button onClick={adicionarMetas} disabled={addMetasLoading || dominiosFoco.length === 0}>
              <ListPlus className="mr-2 h-4 w-4" />{addMetasLoading ? "Gerando…" : "Gerar metas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RevisaoCicloDialog open={showRevisaoDialog} onOpenChange={setShowRevisaoDialog} planoId={planoId} />
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}

/**
 * Explica a lógica GAS em linguagem simples para reduzir a fricção do fluxo:
 * escada definida na meta → nível observado na sessão → gráfico → revisão do ciclo.
 */
function GasExplicador() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between font-medium"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-brand" /> Como funciona a escala GAS (guia rápido)</span>
        <span className="text-muted-foreground">{open ? "ocultar" : "ver"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-1.5 sm:grid-cols-5">
            {([
              [-2, "Regrediu em relação ao início"],
              [-1, "Ponto de partida / abaixo do esperado"],
              [0, "Resultado esperado — a meta em si"],
              [1, "Um pouco além do esperado"],
              [2, "Muito além · generalizou para outros contextos"],
            ] as const).map(([nivel, desc]) => (
              <div key={nivel} className={`rounded-md p-2 ${GAS_LABELS[nivel].cls}`}>
                <p className="font-semibold">{GAS_LABELS[nivel].label}</p>
                <p className="mt-0.5 opacity-90">{desc}</p>
              </div>
            ))}
          </div>
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li><strong className="text-foreground">Ao criar a meta:</strong> escreva o nível 0 como o resultado esperado do ciclo (a IA já preenche a escada; ajuste o que seria observável em cada nível).</li>
            <li><strong className="text-foreground">A cada sessão:</strong> no registro da sessão, marque o nível GAS observado da meta trabalhada — leva segundos e alimenta os gráficos.</li>
            <li><strong className="text-foreground">Durante o ciclo:</strong> acompanhe a evolução no Monitoramento; média recente abaixo do esperado aparece em “Metas em risco”.</li>
            <li><strong className="text-foreground">Na revisão do ciclo:</strong> defina o nível final atingido — 0 ou mais indica sucesso; ajuste ou gradue a meta.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function CifRow({ label, textKey, impactKey, form, setForm }: { label: string; textKey: string; impactKey: string; form: any; setForm: (v: any) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_140px]">
      <Field label={label}><Textarea rows={2} value={form[textKey] ?? ""} onChange={(e) => setForm({ ...form, [textKey]: e.target.value })} /></Field>
      <Field label="Impacto">
        <Select value={form[impactKey] ?? ""} onValueChange={(v) => setForm({ ...form, [impactKey]: v })}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{IMPACTO.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function MetaCard({ planoId, meta, pubmedFn, objetivos = [], pontos = [] }: { planoId: string; meta: any; pubmedFn: any; objetivos?: Objetivo[]; pontos?: any[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...meta });
  const [searchingPubmed, setSearchingPubmed] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState(false);

  const gasMap = new Map<number, string>();
  (meta.plano_gas ?? []).forEach((g: any) => gasMap.set(g.nivel, g.descricao));
  const componentes = [...(meta.plano_meta_componentes ?? [])].sort((a: any, b: any) => a.ordem - b.ordem);
  const fontes = [...(meta.plano_meta_fontes ?? [])].sort((a: any, b: any) => a.ordem - b.ordem);

  // Último nível GAS observado em sessão (status "vivo" da meta)
  const ultimoGas = [...pontos].reverse().find((p: any) => p.gas != null)?.gas ?? null;

  const invalidateMetas = () => qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });

  async function salvarMeta() {
    const { error } = await supabase.from("plano_metas").update({
      objetivo_id: form.objetivo_id ?? null,
      dominio: form.dominio, titulo_smart: form.titulo_smart, baseline: form.baseline,
      restricao_funcional: form.restricao_funcional ?? null,
      grau_confianca: form.grau_confianca ?? null,
      confianca_justificativa: form.confianca_justificativa ?? null,
      recursos: form.recursos ?? null,
      ordem_progressao: form.ordem_progressao != null && form.ordem_progressao !== "" ? Number(form.ordem_progressao) : null,
      criterios_progressao: form.criterios_progressao ?? null,
      criterios_alta: form.criterios_alta ?? null,
      prazo_semanas: form.prazo_semanas, justificativa: form.justificativa,
      nivel_gas_atingido: form.nivel_gas_atingido, data_revisao: form.data_revisao,
    }).eq("id", meta.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Meta atualizada");
    setEditing(false);
    invalidateMetas();
  }

  async function addComponente(nome: string) {
    const n = nome.trim();
    if (!n) return;
    await supabase.from("plano_meta_componentes").insert({ meta_id: meta.id, nome: n, ordem: componentes.length });
    invalidateMetas();
  }
  async function removeComponente(id: string) {
    await supabase.from("plano_meta_componentes").delete().eq("id", id);
    invalidateMetas();
  }
  async function addFonte(tipo: string, referencia: string) {
    if (!tipo) return;
    await supabase.from("plano_meta_fontes").insert({ meta_id: meta.id, tipo, referencia: referencia.trim() || null, ordem: fontes.length });
    invalidateMetas();
  }
  async function removeFonte(id: string) {
    await supabase.from("plano_meta_fontes").delete().eq("id", id);
    invalidateMetas();
  }

  async function atualizarGas(nivel: number, descricao: string) {
    const existing = (meta.plano_gas ?? []).find((g: any) => g.nivel === nivel);
    if (existing) {
      await supabase.from("plano_gas").update({ descricao }).eq("meta_id", meta.id).eq("nivel", nivel);
    } else {
      await supabase.from("plano_gas").insert({ meta_id: meta.id, nivel, descricao });
    }
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
  }

  async function excluirMeta() {
    if (!confirm("Excluir meta e tudo associado?")) return;
    await supabase.from("plano_metas").delete().eq("id", meta.id);
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
  }

  async function buscarEvidencias() {
    setSearchingPubmed(true);
    try {
      const q = `${meta.dominio ?? ""} ${meta.titulo_smart}`.trim();
      const result = await pubmedFn({ data: { query: q, max: 5 } });
      if (result.error) { toast.error(result.error); return; }
      if (!result.artigos?.length) { toast.info("Nenhum artigo encontrado"); return; }
      const rows = result.artigos.slice(0, 3).map((a: any) => ({
        plano_id: planoId, meta_id: meta.id,
        pmid: a.pmid, titulo: a.titulo, autores: a.autores, ano: a.ano,
        journal: a.journal, url: a.url, resumo: a.resumo,
      }));
      await supabase.from("plano_evidencias").insert(rows);
      toast.success(`${rows.length} evidências anexadas`);
      qc.invalidateQueries({ queryKey: ["plano-evidencias", planoId] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSearchingPubmed(false); }
  }

  async function addEstrategia() {
    await supabase.from("plano_estrategias").insert({
      meta_id: meta.id, ordem: (meta.plano_estrategias ?? []).length,
      nome: "Nova estratégia", justificativa: "", como_aplicar: "", referencia: "",
    });
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {editing ? (
              <Input value={form.titulo_smart} onChange={(e) => setForm({ ...form, titulo_smart: e.target.value })} />
            ) : (
              <CardTitle className="text-base flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 text-brand" />{meta.titulo_smart}</CardTitle>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {meta.dominio && <Badge variant="outline">{meta.dominio}</Badge>}
              {meta.grau_confianca && CONFIANCA_LABEL[meta.grau_confianca] && (
                <Badge className={CONFIANCA_LABEL[meta.grau_confianca].cls}>{CONFIANCA_LABEL[meta.grau_confianca].label}</Badge>
              )}
              {meta.status && meta.status !== "ativa" && (
                <Badge variant="secondary" className="capitalize">{meta.status}</Badge>
              )}
              {meta.ordem_progressao != null && <span>#{meta.ordem_progressao} na progressão</span>}
              {meta.prazo_semanas && <span>{meta.prazo_semanas} semanas</span>}
              {pontos.length > 0 && <span>{pontos.length} registros</span>}
              {ultimoGas != null && (
                <Badge className={GAS_LABELS[ultimoGas]?.cls}>Agora: {GAS_LABELS[ultimoGas]?.label}</Badge>
              )}
              {meta.nivel_gas_atingido != null && (
                <Badge className={GAS_LABELS[meta.nivel_gas_atingido]?.cls}>Revisão: {GAS_LABELS[meta.nivel_gas_atingido]?.label}</Badge>
              )}
            </div>
          </div>
          <div className="w-32 hidden md:block">
            <MetaSparkline points={pontos} height={36} />
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={buscarEvidencias} disabled={searchingPubmed}>
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); setForm({ ...meta }); }}>
              {editing ? "Cancelar" : "Editar"}
            </Button>
            {editing && <Button size="sm" onClick={salvarMeta}>Salvar</Button>}
            <Button variant="ghost" size="sm" onClick={excluirMeta}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Objetivo">
              <Select value={form.objetivo_id ?? "__none"} onValueChange={(v) => setForm({ ...form, objetivo_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sem objetivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem objetivo</SelectItem>
                  {objetivos.map((o) => <SelectItem key={o.id} value={o.id}>{o.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Domínio"><Input value={form.dominio ?? ""} onChange={(e) => setForm({ ...form, dominio: e.target.value })} /></Field>
            <Field label="Restrição funcional (qual problema resolve)" className="md:col-span-2"><Textarea rows={2} value={form.restricao_funcional ?? ""} onChange={(e) => setForm({ ...form, restricao_funcional: e.target.value })} /></Field>
            <Field label="Grau de confiança">
              <Select value={form.grau_confianca ?? "__none"} onValueChange={(v) => setForm({ ...form, grau_confianca: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ordem de progressão"><Input type="number" value={form.ordem_progressao ?? ""} onChange={(e) => setForm({ ...form, ordem_progressao: e.target.value })} /></Field>
            <Field label="Justificativa da confiança (quando baixa)" className="md:col-span-2"><Textarea rows={2} value={form.confianca_justificativa ?? ""} onChange={(e) => setForm({ ...form, confianca_justificativa: e.target.value })} /></Field>
            <Field label="Prazo / tempo estimado (semanas)"><Input type="number" value={form.prazo_semanas ?? ""} onChange={(e) => setForm({ ...form, prazo_semanas: parseInt(e.target.value, 10) })} /></Field>
            <Field label="Recursos"><Input value={form.recursos ?? ""} onChange={(e) => setForm({ ...form, recursos: e.target.value })} /></Field>
            <Field label="Critérios de progressão" className="md:col-span-2"><Textarea rows={2} value={form.criterios_progressao ?? ""} onChange={(e) => setForm({ ...form, criterios_progressao: e.target.value })} /></Field>
            <Field label="Critérios de alta" className="md:col-span-2"><Textarea rows={2} value={form.criterios_alta ?? ""} onChange={(e) => setForm({ ...form, criterios_alta: e.target.value })} /></Field>
            <Field label="Baseline" className="md:col-span-2"><Textarea rows={2} value={form.baseline ?? ""} onChange={(e) => setForm({ ...form, baseline: e.target.value })} /></Field>
            <Field label="Justificativa" className="md:col-span-2"><Textarea rows={2} value={form.justificativa ?? ""} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} /></Field>
            <Field label="Nível GAS atingido na revisão">
              <Select value={form.nivel_gas_atingido?.toString() ?? "__none"} onValueChange={(v) => setForm({ ...form, nivel_gas_atingido: v === "__none" ? null : parseInt(v, 10) })}>
                <SelectTrigger><SelectValue placeholder="Não revisada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Não revisada</SelectItem>
                  {[-2, -1, 0, 1, 2].map((n) => <SelectItem key={n} value={n.toString()}>{GAS_LABELS[n].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data revisão"><Input type="date" value={form.data_revisao ?? ""} onChange={(e) => setForm({ ...form, data_revisao: e.target.value })} /></Field>
          </div>
        ) : (
          <>
            {meta.restricao_funcional && <div className="rounded-md bg-sky-50 dark:bg-sky-950/30 p-2 text-xs"><strong>Restrição funcional:</strong> {meta.restricao_funcional}</div>}
            {meta.baseline && <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs"><strong>Baseline:</strong> {meta.baseline}</div>}
            {meta.justificativa && <p className="text-xs text-muted-foreground"><strong>Por quê:</strong> {meta.justificativa}</p>}
            {meta.recursos && <p className="text-xs text-muted-foreground"><strong>Recursos:</strong> {meta.recursos}</p>}
            {meta.criterios_progressao && <p className="text-xs text-muted-foreground"><strong>Critérios de progressão:</strong> {meta.criterios_progressao}</p>}
            {meta.criterios_alta && <p className="text-xs text-muted-foreground"><strong>Critérios de alta:</strong> {meta.criterios_alta}</p>}
            {meta.grau_confianca === "baixa" && meta.confianca_justificativa && (
              <p className="text-xs text-rose-700 dark:text-rose-300"><strong>Confiança baixa:</strong> {meta.confianca_justificativa}</p>
            )}
          </>
        )}

        {/* Mapa da Meta — componentes clínicos + fontes/evidências (ETAPA 7) */}
        <MapaDaMeta
          componentes={componentes}
          fontes={fontes}
          onAddComponente={addComponente}
          onRemoveComponente={removeComponente}
          onAddFonte={addFonte}
          onRemoveFonte={removeFonte}
        />

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border/50 bg-secondary/40 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowDetalhes(!showDetalhes)}
        >
          <span>
            Escada GAS{gasMap.size > 0 ? ` (${gasMap.size}/5 níveis descritos)` : " (não descrita)"} ·{" "}
            {(meta.plano_estrategias ?? []).length} estratégia{(meta.plano_estrategias ?? []).length === 1 ? "" : "s"}
          </span>
          <span className="font-medium">{showDetalhes ? "ocultar" : "abrir"}</span>
        </button>

        {showDetalhes && (
          <>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Escala GAS</div>
              <div className="space-y-1">
                {[2, 1, 0, -1, -2].map((nivel) => (
                  <div key={nivel} className={`grid grid-cols-[110px_1fr] rounded-md text-xs ${GAS_LABELS[nivel].cls}`}>
                    <div className="px-2 py-2 font-semibold">{GAS_LABELS[nivel].label}</div>
                    <Textarea
                      rows={1}
                      defaultValue={gasMap.get(nivel) ?? ""}
                      onBlur={(e) => { if (e.target.value !== (gasMap.get(nivel) ?? "")) atualizarGas(nivel, e.target.value); }}
                      className="m-1 bg-white/60 dark:bg-black/20 border-0 text-xs"
                      placeholder={nivel === 0 ? meta.titulo_smart : "Descreva o que seria observável neste nível…"}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Estratégias de intervenção</div>
                <Button size="sm" variant="ghost" onClick={addEstrategia}><Plus className="mr-1 h-3 w-3" />Adicionar</Button>
              </div>
              {(meta.plano_estrategias ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma estratégia.</p>
              ) : (
                <div className="space-y-2">
                  {(meta.plano_estrategias ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((e: any) => (
                    <EstrategiaRow key={e.id} estrategia={e} planoId={planoId} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** ETAPA 1 — resumo das fontes que a IA consolidou para o raciocínio. */
function FontesIntegradas({ raciocinio }: { raciocinio: any }) {
  const fontes: string[] = Array.isArray(raciocinio?.fontes_utilizadas) ? raciocinio.fontes_utilizadas : [];
  return (
    <SectionCard title="Fontes integradas" description="ETAPA 1 · Informações cruzadas para a formulação — nunca uma fonte isolada" icon={Layers} defaultOpen={false}>
      {fontes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fonte consolidada ainda. Gere o plano com IA para cruzar anamnese, avaliações, testes e observações.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fontes.map((f, i) => (
            <Badge key={`${f}-${i}`} variant="outline" className="text-xs">{FONTE_LABEL[f] ?? f}</Badge>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** ETAPA 3 — síntese do raciocínio clínico (editável), persistida em raciocinio_clinico.sintese. */
function RaciocinioSecao({ planoId, raciocinio, onSaved }: { planoId: string; raciocinio: any; onSaved: () => void }) {
  const [sintese, setSintese] = useState<string>(raciocinio?.sintese ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setSintese(raciocinio?.sintese ?? ""); setDirty(false); }, [raciocinio?.sintese]);

  async function salvar() {
    const merged = { ...(raciocinio && typeof raciocinio === "object" ? raciocinio : {}), sintese };
    const { error } = await supabase.from("planos_terapeuticos").update({ raciocinio_clinico: merged }).eq("id", planoId);
    if (error) { toast.error(error.message); return; }
    toast.success("Síntese salva");
    setDirty(false);
    onSaved();
  }

  return (
    <SectionCard title="Síntese do raciocínio clínico" description="ETAPA 3 · Hipóteses com mais evidência, fatores secundários e lacunas" icon={Brain} defaultOpen={false}>
      <Textarea
        rows={5}
        value={sintese}
        onChange={(e) => { setSintese(e.target.value); setDirty(true); }}
        placeholder="Explique o raciocínio: quais fatores parecem causar as dificuldades, quais hipóteses têm mais evidência, o que ainda é insuficiente…"
      />
      {dirty && <div className="mt-2"><Button size="sm" onClick={salvar}>Salvar síntese</Button></div>}
    </SectionCard>
  );
}

/** ETAPA 4 — priorização das dificuldades. */
function PriorizacaoSecao({ raciocinio }: { raciocinio: any }) {
  const itens: any[] = Array.isArray(raciocinio?.priorizacao) ? raciocinio.priorizacao : [];
  if (itens.length === 0) return null;
  const ordenados = [...itens].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
  return (
    <SectionCard title="Priorização" description="ETAPA 4 · Ordem por impacto funcional, urgência, potencial de mudança e frequência" icon={ListOrdered} defaultOpen={false}>
      <ol className="space-y-2">
        {ordenados.map((p, i) => (
          <li key={i} className="flex gap-2 rounded-md border border-border/50 p-2 text-sm">
            <Badge className="h-6 shrink-0">{p.ordem ?? i + 1}</Badge>
            <div>
              <p className="font-medium">{p.area ?? "—"}</p>
              {p.racional && <p className="text-xs text-muted-foreground">{p.racional}</p>}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

/** CIF texto-livre (legado) — só aparece quando o plano ainda tem esses campos preenchidos. */
function LegadoCif({ form, setForm, onSalvar }: { form: any; setForm: (v: any) => void; onSalvar: () => void }) {
  const [open, setOpen] = useState(false);
  const temConteudo = ["cif_funcoes", "cif_atividades", "cif_participacao", "cif_ambientais", "cif_pessoais"].some((k) => (form?.[k] ?? "").trim?.());
  if (!temConteudo) return null;
  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
      <button type="button" className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground" onClick={() => setOpen(!open)}>
        <span>Perfil CIF em texto livre (legado)</span>
        <span>{open ? "ocultar" : "ver"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          <CifRow label="🧠 Funções e Estruturas" textKey="cif_funcoes" impactKey="cif_funcoes_impacto" form={form} setForm={setForm} />
          <CifRow label="⚙️ Atividades" textKey="cif_atividades" impactKey="cif_atividades_impacto" form={form} setForm={setForm} />
          <CifRow label="🌍 Participação" textKey="cif_participacao" impactKey="cif_participacao_impacto" form={form} setForm={setForm} />
          <Field label="🏠 Fatores Ambientais"><Textarea rows={2} value={form.cif_ambientais ?? ""} onChange={(e) => setForm({ ...form, cif_ambientais: e.target.value })} /></Field>
          <Field label="⭐ Fatores Pessoais"><Textarea rows={2} value={form.cif_pessoais ?? ""} onChange={(e) => setForm({ ...form, cif_pessoais: e.target.value })} /></Field>
          <div><Button size="sm" variant="outline" onClick={onSalvar}>Salvar CIF legado</Button></div>
        </div>
      )}
    </div>
  );
}

/** ETAPA 7 — Mapa da Meta: componentes clínicos + fontes/evidências que originaram a meta. */
function MapaDaMeta({
  componentes, fontes, onAddComponente, onRemoveComponente, onAddFonte, onRemoveFonte,
}: {
  componentes: any[]; fontes: any[];
  onAddComponente: (nome: string) => void; onRemoveComponente: (id: string) => void;
  onAddFonte: (tipo: string, referencia: string) => void; onRemoveFonte: (id: string) => void;
}) {
  const [novoComp, setNovoComp] = useState("");
  const [novaFonteTipo, setNovaFonteTipo] = useState("");
  const [novaFonteRef, setNovaFonteRef] = useState("");

  return (
    <div className="rounded-md border border-border/50 bg-secondary/20 p-2 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Waypoints className="h-3.5 w-3.5" /> Mapa da Meta</p>

      <div>
        <p className="text-[11px] text-muted-foreground">Componentes clínicos (sustentam a meta — não são metas)</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {componentes.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 pr-1 text-xs">
              {c.nome}
              <button type="button" onClick={() => onRemoveComponente(c.id)}><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
          <Input
            className="h-7 w-40 text-xs"
            placeholder="+ componente"
            value={novoComp}
            onChange={(e) => setNovoComp(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddComponente(novoComp); setNovoComp(""); } }}
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground">Evidências / fontes que originaram a meta</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {fontes.map((f) => (
            <Badge key={f.id} variant="outline" className="gap-1 pr-1 text-xs">
              {FONTE_LABEL[f.tipo] ?? f.tipo}{f.referencia ? `: ${f.referencia}` : ""}
              <button type="button" onClick={() => onRemoveFonte(f.id)}><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Select value={novaFonteTipo} onValueChange={setNovaFonteTipo}>
            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Tipo de fonte" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FONTE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-7 w-44 text-xs" placeholder="Referência (opcional)" value={novaFonteRef} onChange={(e) => setNovaFonteRef(e.target.value)} />
          <Button size="sm" variant="outline" className="h-7" disabled={!novaFonteTipo} onClick={() => { onAddFonte(novaFonteTipo, novaFonteRef); setNovaFonteTipo(""); setNovaFonteRef(""); }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EstrategiaRow({ estrategia, planoId }: { estrategia: any; planoId: string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(estrategia);

  async function salvar() {
    await supabase.from("plano_estrategias").update({
      nome: form.nome, justificativa: form.justificativa, como_aplicar: form.como_aplicar, referencia: form.referencia,
    }).eq("id", estrategia.id);
    setEdit(false);
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
  }
  async function excluir() {
    await supabase.from("plano_estrategias").delete().eq("id", estrategia.id);
    qc.invalidateQueries({ queryKey: ["plano-metas", planoId] });
  }
  return (
    <div className="rounded-md border p-2 text-xs space-y-1">
      {edit ? (
        <div className="space-y-2">
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome" />
          <Textarea rows={2} value={form.justificativa ?? ""} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} placeholder="Justificativa clínica" />
          <Textarea rows={2} value={form.como_aplicar ?? ""} onChange={(e) => setForm({ ...form, como_aplicar: e.target.value })} placeholder="Como aplicar" />
          <Input value={form.referencia ?? ""} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Referência" />
          <div className="flex gap-1"><Button size="sm" onClick={salvar}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button></div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-brand">{estrategia.nome}</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setEdit(true); setForm(estrategia); }}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={excluir}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
            </div>
          </div>
          {estrategia.justificativa && <div><strong>Por quê:</strong> {estrategia.justificativa}</div>}
          {estrategia.como_aplicar && <div><strong>Como:</strong> {estrategia.como_aplicar}</div>}
          {estrategia.referencia && <div className="text-muted-foreground italic">{estrategia.referencia}</div>}
        </>
      )}
    </div>
  );
}

function NovaMetaButton({ planoId, objetivoId, onSaved }: { planoId: string; objetivoId: string | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  async function criar() {
    setSaving(true);
    const { data: maxMeta } = await supabase.from("plano_metas").select("ordem").eq("plano_id", planoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const ordem = (maxMeta?.ordem ?? -1) + 1;
    const { error } = await supabase.from("plano_metas").insert({
      plano_id: planoId, objetivo_id: objetivoId, ordem, titulo_smart: "Nova meta", prazo_semanas: 12,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }
  return <Button variant="outline" size="sm" onClick={criar} disabled={saving}><Plus className="mr-2 h-4 w-4" />Adicionar meta</Button>;
}
