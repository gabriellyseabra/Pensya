import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sintetizarSessao } from "@/lib/sessao.functions";
import { HABILIDADES_SUGERIDAS } from "@/lib/habilidades";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mic, Square, Sparkles, Loader2, FileAudio, ChevronDown, ChevronUp,
  Target, FlaskConical, X, Plus, ImageIcon, Film, Upload, Trash2, Paperclip,
} from "lucide-react";
import { RecursoPicker } from "@/components/prontuario/RecursoPicker";
import { AplicarResultadoDialog } from "@/components/prontuario/AplicarResultadoDialog";
import { COR_STATUS_ITEM, DOT_STATUS_ITEM, ordenarSessoesPlano } from "@/components/prontuario/AvaliacaoTab";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

export const NIVEIS_SUPORTE = [
  { value: "independente", label: "Independente" },
  { value: "verbal", label: "Suporte verbal" },
  { value: "gestual", label: "Suporte gestual" },
  { value: "fisico_parcial", label: "Físico parcial" },
  { value: "fisico_total", label: "Físico total" },
];

export const ENGAJAMENTO_OPTIONS = [
  { value: "1", label: "Muito baixo" },
  { value: "2", label: "Baixo" },
  { value: "3", label: "Moderado" },
  { value: "4", label: "Alto" },
  { value: "5", label: "Muito alto" },
];

export const AUTORREGULACAO_OPTIONS = [
  { value: "1", label: "Muito baixa" },
  { value: "2", label: "Baixa" },
  { value: "3", label: "Moderada" },
  { value: "4", label: "Boa" },
  { value: "5", label: "Muito boa" },
];

type Habilidade = { habilidade: string; sub_habilidade: string };

function CardOptionGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-2 py-1.5 text-[11px] text-center leading-tight transition-all ${
            value === o.value
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border hover:bg-muted/50 text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const GAS_OPTIONS = [
  { value: "-2", label: "−2 muito abaixo" },
  { value: "-1", label: "−1 abaixo" },
  { value: "0", label: " 0 esperado" },
  { value: "1", label: "+1 acima" },
  { value: "2", label: "+2 muito acima" },
];

type Tipo = "avaliacao" | "intervencao";

type MetaState = {
  meta_id: string;
  desempenho?: string;
  engajamento?: string;
  nivel_suporte?: string;
  nivel_gas_observado?: string;
  observacoes_meta?: string;
  // Fase 2 — raciocínio clínico da sessão
  componentes_trabalhados?: string[];
  evidencias_clinicas?: string;
  houve_progresso?: string;
  ajuste_plano?: string;
};

const PROGRESSO_OPTIONS = [
  { value: "regressao", label: "Regrediu" },
  { value: "sem_mudanca", label: "Sem mudança" },
  { value: "parcial", label: "Progresso parcial" },
  { value: "sim", label: "Progrediu" },
];

// Remove identificadores técnicos (UUIDs / "ID ...") que a IA eventualmente insira no texto.
function limparIds(t?: string | null): string | undefined {
  if (t == null) return undefined;
  return String(t)
    .replace(/\(?\s*ID[:\s]*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\s*\)?/g, "")
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const DESEMPENHO_LABELS = [
  { value: "1", label: "1 Muito abaixo" },
  { value: "2", label: "2 Abaixo" },
  { value: "3", label: "3 Esperado" },
  { value: "4", label: "4 Acima" },
  { value: "5", label: "5 Muito acima" },
];

export interface SessaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  tipo: Tipo;
  /** Quando passado, abre em modo edição. */
  sessaoId?: string | null;
  /** Pré-preenche a data da sessão (YYYY-MM-DD). */
  dataInicial?: string;
  /** Duração inicial em minutos (sobrescreve 50). */
  duracaoInicial?: number;
  /** Atendimento de origem (agenda), vincula o registro de frequência a este horário. */
  atendimentoId?: string | null;
  onSaved?: () => void;
}

export function SessaoDialog({
  open, onOpenChange, pacienteId, tipo, sessaoId, dataInicial, duracaoInicial, atendimentoId, onSaved,
}: SessaoDialogProps) {
  const editing = !!sessaoId;
  const isAvaliacao = tipo === "avaliacao";
  const qc = useQueryClient();

  // Metas ativas/planejamento
  const { data: metas = [] } = useQuery({
    queryKey: ["sessao-metas-paciente", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas_terapeuticas")
        .select("id, titulo, dominio_cognitivo, status")
        .eq("paciente_id", pacienteId)
        .order("ordem", { ascending: true });
      return (data ?? []).filter((m: any) => ["ativa", "planejamento"].includes(m.status));
    },
  });

  // Mapa da Meta (Fase 2): componentes clínicos + plano_meta_id por meta_terapeutica.
  const { data: planoMetaMap = {} } = useQuery({
    queryKey: ["sessao-plano-meta-map", pacienteId],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos_terapeuticos").select("id").eq("paciente_id", pacienteId);
      const ids = (planos ?? []).map((p: any) => p.id);
      if (!ids.length) return {} as Record<string, { planoMetaId: string; componentes: string[] }>;
      const { data } = await supabase
        .from("plano_metas")
        .select("id, meta_terapeutica_id, plano_meta_componentes(nome, ordem)")
        .in("plano_id", ids);
      const map: Record<string, { planoMetaId: string; componentes: string[] }> = {};
      for (const pm of (data ?? []) as any[]) {
        if (!pm.meta_terapeutica_id) continue;
        map[pm.meta_terapeutica_id] = {
          planoMetaId: pm.id,
          componentes: [...(pm.plano_meta_componentes ?? [])].sort((a: any, b: any) => a.ordem - b.ordem).map((c: any) => c.nome),
        };
      }
      return map;
    },
  });

  // Sessão para editar
  const { data: sessaoExist } = useQuery({
    enabled: open && !!sessaoId,
    queryKey: ["sessao-edit", sessaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("*, sessao_metas(*)")
        .eq("id", sessaoId as string)
        .maybeSingle();
      return data as any;
    },
  });

  // Mídias já anexadas a esta sessão (galeria)
  const { data: midiasSessao = [], refetch: refetchMidias } = useQuery({
    enabled: open && !!sessaoId,
    queryKey: ["sessao-midias", sessaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("paciente_documentos")
        .select("id, titulo, storage_path, mime_type")
        .eq("sessao_id", sessaoId as string)
        .eq("galeria", true)
        .order("created_at", { ascending: true });
      return (data ?? []) as { id: string; titulo: string | null; storage_path: string; mime_type: string | null }[];
    },
  });

  // Lembrete deixado na última sessão (nota para a próxima) — destaque ao abrir
  const { data: ultimaNota = null } = useQuery({
    enabled: open,
    queryKey: ["sessao-ultima-nota", pacienteId, sessaoId ?? "nova"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prontuario_sessoes")
        .select("id, data_sessao, nota_proxima_sessao")
        .eq("paciente_id", pacienteId)
        .not("nota_proxima_sessao", "is", null)
        .order("data_sessao", { ascending: false })
        .limit(3);
      const row = (data ?? []).find((r: any) => r.id !== sessaoId && (r.nota_proxima_sessao ?? "").trim());
      return (row ?? null) as { id: string; data_sessao: string; nota_proxima_sessao: string } | null;
    },
  });

  // Planejamento vinculado a este atendimento (conecta planejamento → registro)
  const { data: planejamentoAtend = null } = useQuery({
    enabled: open && !!atendimentoId && !sessaoId,
    queryKey: ["sessao-planejamento-atend", atendimentoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessao_planejamentos")
        .select("id, metas_foco, foco, recursos, estrategias, status")
        .eq("atendimento_id", atendimentoId as string)
        .maybeSingle();
      return (data ?? null) as any;
    },
  });

  // Form
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [duracao, setDuracao] = useState<number | "">(50);
  const [engajamento, setEngajamento] = useState<string>("3");
  const [autorregulacao, setAutorregulacao] = useState<string>("3");
  const [nivelSuporte, setNivelSuporte] = useState<string>("independente");
  const [recursos, setRecursos] = useState("");
  const [evolucao, setEvolucao] = useState("");
  const [habilidades, setHabilidades] = useState<Habilidade[]>([]);
  const [novaHabilidade, setNovaHabilidade] = useState("");
  const [novaSubHabilidade, setNovaSubHabilidade] = useState("");
  const [orientacaoCasa, setOrientacaoCasa] = useState(false);
  const [orientacaoTexto, setOrientacaoTexto] = useState("");
  const [portalOcultar, setPortalOcultar] = useState(false);
  const [notaProximaSessao, setNotaProximaSessao] = useState("");
  const [metasState, setMetasState] = useState<Record<string, MetaState>>({});
  // metas pré-marcadas a partir do planejamento (a IA pode desmarcá-las se não foram trabalhadas)
  const planoPreselRef = useRef<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Fotos/vídeos da sessão → alimentam a Galeria do paciente
  const [novasMidias, setNovasMidias] = useState<File[]>([]);
  const midiaInputRef = useRef<HTMLInputElement>(null);

  // Avaliação vinculada + checklist de testes administrados (somente sessão de avaliação)
  const [avaliacaoSelId, setAvaliacaoSelId] = useState<string>("");
  const [testesAdmin, setTestesAdmin] = useState<Record<string, boolean>>({}); // bateria_item id -> aplicado hoje
  const [obsComportamental, setObsComportamental] = useState("");
  const [resultadoDlg, setResultadoDlg] = useState<{ open: boolean; testeId: string | null }>({ open: false, testeId: null });

  const { data: avaliacoesPac = [] } = useQuery({
    enabled: open && isAvaliacao,
    queryKey: ["avaliacoes-sessao", pacienteId],
    queryFn: async () => (await supabase
      .from("avaliacoes")
      .select("id, titulo, status, data_inicio")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: bateriaSel = [] } = useQuery({
    enabled: open && isAvaliacao && !!avaliacaoSelId,
    queryKey: ["bateria", avaliacaoSelId],
    queryFn: async () => (await supabase
      .from("bateria_itens")
      .select("*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("avaliacao_id", avaliacaoSelId)
      .order("ordem")).data ?? [],
  });

  const [sessaoPlanoSelId, setSessaoPlanoSelId] = useState<string>("");
  const { data: planoSessoesSel = [] } = useQuery({
    enabled: open && isAvaliacao && !!avaliacaoSelId,
    queryKey: ["avaliacao-plano-sessoes", avaliacaoSelId],
    queryFn: async () => (await supabase
      .from("avaliacao_sessoes_plano")
      .select("*")
      .eq("avaliacao_id", avaliacaoSelId)
      .order("ordem")).data ?? [],
  });

  // Anexos por teste (PNG/JPEG/PDF) no checklist da sessão
  const anexoInputRef = useRef<HTMLInputElement>(null);
  const uploadTesteRef = useRef<string | null>(null);
  const [anexando, setAnexando] = useState(false);
  const { data: docsTestes = [] } = useQuery({
    enabled: open && isAvaliacao && !!avaliacaoSelId,
    queryKey: ["avaliacao-docs-testes", avaliacaoSelId],
    queryFn: async () => (await supabase
      .from("avaliacao_documentos")
      .select("id, teste_id, nome, storage_path")
      .eq("avaliacao_id", avaliacaoSelId)
      .not("teste_id", "is", null)).data ?? [],
  });

  async function onAnexoTesteSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const testeId = uploadTesteRef.current;
    if (!file || !testeId || !avaliacaoSelId) { if (e.target) e.target.value = ""; return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); e.target.value = ""; return; }
    setAnexando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `avaliacoes/${avaliacaoSelId}/testes/${testeId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("prontuario-docs").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { error: e2 } = await supabase.from("avaliacao_documentos").insert({
        avaliacao_id: avaliacaoSelId, teste_id: testeId, sessao_id: sessaoId ?? null,
        nome: file.name, storage_path: path, tamanho: file.size, tipo: file.type, uploaded_by: u.user?.id ?? null,
      });
      if (e2) throw e2;
      toast.success("Arquivo anexado ao teste");
      qc.invalidateQueries({ queryKey: ["avaliacao-docs-testes", avaliacaoSelId] });
    } catch (err: any) {
      toast.error("Falha ao anexar", { description: err.message });
    } finally {
      setAnexando(false);
      uploadTesteRef.current = null;
      if (anexoInputRef.current) anexoInputRef.current.value = "";
    }
  }

  // Ao escolher uma sessão planejada, pré-marca os testes atribuídos a ela (editável)
  function aplicarSessaoPlanejada(planoId: string) {
    setSessaoPlanoSelId(planoId);
    if (!planoId) return;
    const doPlano = (bateriaSel as any[]).filter((b) => b.sessao_plano_id === planoId);
    setTestesAdmin((prev) => {
      const next = { ...prev };
      for (const b of doPlano) if (b.status !== "aplicado") next[b.id] = true;
      return next;
    });
    const plano = (planoSessoesSel as any[]).find((s) => s.id === planoId);
    if (plano?.data_prevista && !editing) setData(plano.data_prevista);
  }

  // IA / áudio
  const [transcricao, setTranscricao] = useState("");
  const [resumoIA, setResumoIA] = useState("");
  const [iaOpen, setIaOpen] = useState(true);
  const [sintetizando, setSintetizando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recogRef = useRef<any>(null);
  const tickRef = useRef<any>(null);
  const baseTranscRef = useRef<string>("");

  const sintetizar = useServerFn(sintetizarSessao);

  // Hidratar quando abre / muda sessão
  useEffect(() => {
    if (!open) return;
    setNovasMidias([]);
    if (sessaoExist) {
      setData(sessaoExist.data_sessao ?? format(new Date(), "yyyy-MM-dd"));
      setDuracao(sessaoExist.duracao_min ?? 50);
      setEngajamento(sessaoExist.engajamento != null ? String(sessaoExist.engajamento) : "3");
      setAutorregulacao(sessaoExist.autorregulacao != null ? String(sessaoExist.autorregulacao) : "3");
      setNivelSuporte(sessaoExist.nivel_suporte ?? "independente");
      setRecursos((sessaoExist.recursos_utilizados ?? []).join(", "));
      setEvolucao(sessaoExist.evolucao ?? "");
      setHabilidades(Array.isArray(sessaoExist.habilidades_trabalhadas) ? sessaoExist.habilidades_trabalhadas : []);
      setOrientacaoCasa(!!sessaoExist.orientacao_casa);
      setOrientacaoTexto(sessaoExist.orientacao_texto ?? "");
      setPortalOcultar(!!sessaoExist.portal_ocultar);
      setNotaProximaSessao(sessaoExist.nota_proxima_sessao ?? "");
      setTranscricao(sessaoExist.transcricao ?? "");
      setResumoIA(sessaoExist.ia_resumo ?? "");
      setAvaliacaoSelId((sessaoExist as any).avaliacao_id ?? "");
      setObsComportamental((sessaoExist as any).observacoes ?? "");
      setTestesAdmin({});
      setSessaoPlanoSelId("");
      const ms: Record<string, MetaState> = {};
      (sessaoExist.sessao_metas ?? []).forEach((sm: any) => {
        ms[sm.meta_id] = {
          meta_id: sm.meta_id,
          desempenho: sm.desempenho != null ? String(sm.desempenho) : undefined,
          engajamento: sm.engajamento != null ? String(sm.engajamento) : undefined,
          nivel_suporte: sm.nivel_suporte ?? undefined,
          nivel_gas_observado: sm.nivel_gas_observado != null ? String(sm.nivel_gas_observado) : undefined,
          observacoes_meta: sm.observacoes_meta ?? undefined,
          componentes_trabalhados: Array.isArray(sm.componentes_trabalhados) ? sm.componentes_trabalhados : undefined,
          evidencias_clinicas: sm.evidencias_clinicas ?? undefined,
          houve_progresso: sm.houve_progresso ?? undefined,
          ajuste_plano: sm.ajuste_plano ?? undefined,
        };
      });
      setMetasState(ms);
    } else if (!editing) {
      // reset para criação
      setData(dataInicial ?? format(new Date(), "yyyy-MM-dd"));
      setDuracao(duracaoInicial ?? 50);
      setEngajamento("3"); setAutorregulacao("3"); setNivelSuporte("independente");
      setRecursos(""); setEvolucao(""); setHabilidades([]); setOrientacaoCasa(false); setOrientacaoTexto("");
      setPortalOcultar(false); setNotaProximaSessao(""); planoPreselRef.current = new Set();
      setTranscricao("");
      setResumoIA(""); setAudioBlob(null); setAudioSegundos(0); setMetasState({});
      setAvaliacaoSelId(""); setObsComportamental(""); setTestesAdmin({}); setSessaoPlanoSelId("");
    }
  }, [open, sessaoExist?.id]);

  // Auto-seleciona a avaliação ao criar uma sessão de avaliação (mais recente não arquivada)
  useEffect(() => {
    if (!open || !isAvaliacao || editing || avaliacaoSelId) return;
    const lista = avaliacoesPac as any[];
    if (!lista.length) return;
    const preferida = lista.find((a) => a.status !== "arquivada") ?? lista[0];
    setAvaliacaoSelId(preferida.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAvaliacao, editing, avaliacoesPac]);

  useEffect(() => () => pararGravacao(), []);

  // Conecta o planejamento ao registro: pré-seleciona metas-foco e recursos planejados
  useEffect(() => {
    if (!open || editing || !planejamentoAtend) return;
    const foco: string[] = Array.isArray(planejamentoAtend.metas_foco) ? planejamentoAtend.metas_foco : [];
    planoPreselRef.current = new Set(foco);
    if (foco.length) {
      setMetasState((prev) => {
        const next = { ...prev };
        for (const id of foco) if (!next[id]) next[id] = { meta_id: id };
        return next;
      });
    }
    if (planejamentoAtend.recursos) setRecursos((r) => r || planejamentoAtend.recursos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planejamentoAtend?.id, open]);

  function toggleMeta(meta_id: string, checked: boolean) {
    setMetasState((prev) => {
      const next = { ...prev };
      if (checked) {
        next[meta_id] = next[meta_id] ?? { meta_id };
      } else {
        delete next[meta_id];
      }
      return next;
    });
  }

  function updateMeta(meta_id: string, patch: Partial<MetaState>) {
    setMetasState((prev) => ({
      ...prev,
      [meta_id]: { ...(prev[meta_id] ?? { meta_id }), ...patch },
    }));
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setAudioSegundos(0);
      tickRef.current = setInterval(() => setAudioSegundos((s) => s + 1), 1000);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
        baseTranscRef.current = transcricao ? transcricao.trim() + " " : "";
        r.onresult = (ev: any) => {
          let finals = ""; let interim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const t = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finals += t + " ";
            else interim += t;
          }
          if (finals) baseTranscRef.current += finals;
          setTranscricao((baseTranscRef.current + interim).trim());
        };
        r.onerror = () => { /* silencioso */ };
        r.start();
        recogRef.current = r;
      } else {
        toast.info("Transcrição automática indisponível neste navegador.");
      }
      setGravando(true);
    } catch (e: any) {
      toast.error("Não foi possível acessar o microfone", { description: e.message });
    }
  }

  function pararGravacao() {
    try { mediaRef.current?.state !== "inactive" && mediaRef.current?.stop(); } catch {}
    try { recogRef.current?.stop(); } catch {}
    mediaRef.current = null; recogRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setGravando(false);
  }

  async function rodarIA() {
    if (transcricao.trim().length < 20) { toast.error("Transcrição muito curta"); return; }
    setSintetizando(true);
    try {
      // Envia TODAS as metas ativas — a IA identifica quais foram trabalhadas
      const metasAtivas = metas.map((m: any) => ({ meta_id: m.id, titulo: m.titulo }));
      const out: any = await sintetizar({
        data: { paciente_id: pacienteId, transcricao, metas: metasAtivas },
      });
      setResumoIA(limparIds(out.resumo) ?? "");
      if (out.sintese) {
        // Na avaliação, a síntese vai para "Observações comportamentais durante a testagem"
        if (isAvaliacao) {
          if (!obsComportamental) setObsComportamental(limparIds(out.sintese) ?? "");
        } else if (!evolucao) {
          setEvolucao(limparIds(out.sintese) ?? "");
        }
      }
      // Registros quantitativos (autorregulação/recursos/engajamento/suporte) só na intervenção
      if (!isAvaliacao) {
        if (out.autorregulacao_sugerida) setAutorregulacao(String(out.autorregulacao_sugerida));
        if (Array.isArray(out.recursos_detectados) && out.recursos_detectados.length && !recursos) {
          setRecursos(out.recursos_detectados.join(", "));
        }
      }
      if (out.orientacao_casa_sugerida) {
        setOrientacaoCasa(true);
        if (!orientacaoTexto) setOrientacaoTexto(out.orientacao_casa_sugerida);
      }
      // Fase 2 — auto-seleciona as metas trabalhadas e preenche todos os campos por meta
      const analise: any[] = Array.isArray(out.metas_analise) ? out.metas_analise : [];
      const trabalhadas = new Set<string>(analise.map((ma) => ma?.meta_id).filter(Boolean));
      let metasPreenchidas = 0;
      let metasRemovidas = 0;
      if (analise.length) {
        setMetasState((prev) => {
          const next = { ...prev };
          for (const ma of analise) {
            if (!ma?.meta_id) continue;
            const cur = next[ma.meta_id] ?? { meta_id: ma.meta_id }; // auto-seleção
            next[ma.meta_id] = {
              ...cur,
              componentes_trabalhados: Array.isArray(ma.componentes_trabalhados) && ma.componentes_trabalhados.length
                ? ma.componentes_trabalhados : cur.componentes_trabalhados,
              evidencias_clinicas: limparIds(ma.evidencias_clinicas) ?? cur.evidencias_clinicas,
              houve_progresso: ma.houve_progresso ?? cur.houve_progresso,
              nivel_gas_observado: ma.nivel_gas_sugerido != null ? String(ma.nivel_gas_sugerido) : cur.nivel_gas_observado,
              engajamento: ma.engajamento != null ? String(ma.engajamento) : cur.engajamento,
              nivel_suporte: ma.nivel_suporte ?? cur.nivel_suporte,
              ajuste_plano: limparIds(ma.ajuste_plano) ?? cur.ajuste_plano,
              observacoes_meta: limparIds(ma.observacoes_meta) ?? cur.observacoes_meta,
            };
            metasPreenchidas++;
          }
          // Metas apenas pré-selecionadas do planejamento que a IA NÃO identificou como
          // trabalhadas e que continuam vazias (sem edição manual) são desmarcadas.
          for (const id of planoPreselRef.current) {
            if (trabalhadas.has(id)) continue;
            const m = next[id];
            const vazia = m && (m.nivel_gas_observado == null || m.nivel_gas_observado === "")
              && !(m.componentes_trabalhados && m.componentes_trabalhados.length)
              && !m.evidencias_clinicas && !m.houve_progresso && !m.observacoes_meta && !m.engajamento;
            if (vazia) { delete next[id]; metasRemovidas++; }
          }
          return next;
        });
      }
      const partes = [
        metasPreenchidas > 0 ? `${metasPreenchidas} meta(s) trabalhada(s)` : "",
        metasRemovidas > 0 ? `${metasRemovidas} planejada(s) não trabalhada(s) removida(s)` : "",
      ].filter(Boolean);
      toast.success(partes.length ? `IA: ${partes.join(" · ")}` : "Síntese aplicada — nenhuma meta identificada na transcrição");
    } catch (e: any) {
      toast.error("Falha ao sintetizar", { description: e.message });
    } finally {
      setSintetizando(false);
    }
  }

  async function salvar() {
    // Validação (antes de qualquer escrita): GAS obrigatório por meta marcada
    const metasArr = Object.values(metasState).filter(m => m.meta_id);
    const semGas = metasArr.filter(m => m.nivel_gas_observado == null || m.nivel_gas_observado === "");
    if (semGas.length > 0) {
      toast.error(`Registre o nível GAS observado em ${semGas.length} meta(s) marcada(s).`);
      return;
    }
    // Engajamento geral da sessão: na intervenção deriva da média por meta (sem campo duplicado)
    const engajamentosMeta = metasArr.map(m => Number(m.engajamento)).filter(n => !Number.isNaN(n) && n > 0);
    const engajamentoSessao = isAvaliacao
      ? null
      : (engajamentosMeta.length ? Math.round(engajamentosMeta.reduce((a, b) => a + b, 0) / engajamentosMeta.length) : null);

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let audioPath: string | null = sessaoExist?.audio_path ?? null;
      if (audioBlob) {
        const fname = `${pacienteId}/${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage.from("sessoes-audio").upload(fname, audioBlob, {
          contentType: "audio/webm",
        });
        if (upErr) throw upErr;
        audioPath = fname;
      }

      // Reabre o acompanhamento (status "pendente") quando a orientação é criada ou alterada
      const orientacaoCasaMudou = sessaoExist ? !!sessaoExist.orientacao_casa !== orientacaoCasa : orientacaoCasa;
      const orientacaoTextoMudou = sessaoExist ? (sessaoExist.orientacao_texto ?? "") !== (orientacaoCasa ? orientacaoTexto : "") : orientacaoCasa;
      const reabrirOrientacao = !editing || orientacaoCasaMudou || orientacaoTextoMudou;

      const payload: any = {
        paciente_id: pacienteId,
        tipo,
        atendimento_id: atendimentoId ?? sessaoExist?.atendimento_id ?? null,
        data_sessao: data,
        duracao_min: typeof duracao === "number" ? duracao : null,
        engajamento: engajamentoSessao,
        autorregulacao: isAvaliacao ? null : (autorregulacao ? Number(autorregulacao) : null),
        nivel_suporte: null,
        nota_proxima_sessao: notaProximaSessao || null,
        recursos_utilizados: isAvaliacao ? null : (recursos ? recursos.split(",").map((r) => r.trim()).filter(Boolean) : null),
        evolucao: isAvaliacao ? null : (evolucao || null),
        habilidades_trabalhadas: isAvaliacao ? [] : habilidades.filter((h) => h.habilidade.trim()),
        orientacao_casa: orientacaoCasa,
        orientacao_texto: orientacaoCasa ? orientacaoTexto : null,
        portal_ocultar: portalOcultar,
        ...(reabrirOrientacao ? { orientacao_status: "pendente", orientacao_atualizado_em: null } : {}),
        audio_path: audioPath,
        audio_duracao_seg: audioBlob ? audioSegundos : sessaoExist?.audio_duracao_seg ?? null,
        transcricao: transcricao || null,
        ia_resumo: resumoIA || null,
        ia_processado_em: resumoIA ? new Date().toISOString() : null,
        ...(isAvaliacao ? {
          avaliacao_id: avaliacaoSelId || null,
          observacoes: obsComportamental || null,
        } : {}),
      };

      let sessaoIdFinal = sessaoId;
      if (editing && sessaoId) {
        const { error } = await supabase.from("prontuario_sessoes")
          .update(payload).eq("id", sessaoId);
        if (error) throw error;
        // Substituir vínculos
        await supabase.from("sessao_metas").delete().eq("sessao_id", sessaoId);
      } else {
        payload.created_by = user?.id;
        const { data: ins, error } = await supabase
          .from("prontuario_sessoes")
          .insert(payload).select("id").single();
        if (error) throw error;
        sessaoIdFinal = ins!.id;
        // Frequência presente automática — reaproveita o registro do atendimento
        // (ou do dia) se já existir, para não duplicar com o lançamento manual.
        let freqExistente: { id: string } | null = null;
        if (atendimentoId) {
          const { data: f } = await supabase
            .from("frequencia").select("id").eq("atendimento_id", atendimentoId).limit(1).maybeSingle();
          freqExistente = f ?? null;
        }
        if (!freqExistente) {
          const { data: f } = await supabase
            .from("frequencia").select("id")
            .eq("paciente_id", pacienteId).eq("data_referencia", data).is("sessao_id", null).limit(1).maybeSingle();
          freqExistente = f ?? null;
        }
        if (freqExistente?.id) {
          await supabase.from("frequencia")
            .update({ tipo: "presente", sessao_id: sessaoIdFinal, atendimento_id: atendimentoId ?? null })
            .eq("id", freqExistente.id);
        } else {
          await supabase.from("frequencia").insert({
            paciente_id: pacienteId,
            sessao_id: sessaoIdFinal,
            atendimento_id: atendimentoId ?? null,
            data_referencia: data,
            tipo: "presente",
            created_by: user?.id,
          });
        }
        // Conecta o planejamento desta sessão: marca como realizado e vincula a sessão
        if (planejamentoAtend?.id) {
          await supabase.from("sessao_planejamentos")
            .update({ status: "realizada", sessao_id: sessaoIdFinal })
            .eq("id", planejamentoAtend.id);
        }
      }

      const linhas = metasArr.map((m) => ({
        sessao_id: sessaoIdFinal!,
        meta_id: m.meta_id,
        plano_meta_id: (planoMetaMap as any)[m.meta_id]?.planoMetaId ?? null,
        desempenho: m.desempenho ? Number(m.desempenho) : null,
        engajamento: m.engajamento ? Number(m.engajamento) : null,
        nivel_suporte: m.nivel_suporte ?? null,
        nivel_gas_observado: m.nivel_gas_observado != null && m.nivel_gas_observado !== ""
          ? Number(m.nivel_gas_observado) : null,
        observacoes_meta: m.observacoes_meta || null,
        componentes_trabalhados: m.componentes_trabalhados?.length ? m.componentes_trabalhados : null,
        evidencias_clinicas: m.evidencias_clinicas || null,
        houve_progresso: m.houve_progresso || null,
        ajuste_plano: m.ajuste_plano || null,
      }));
      if (linhas.length) {
        const { error } = await supabase.from("sessao_metas").insert(linhas);
        if (error) throw error;
      }

      // Sessão de avaliação: marca como "aplicado" os testes administrados hoje
      // (atualiza o status no planejamento automaticamente).
      if (isAvaliacao && sessaoIdFinal) {
        const marcados = (bateriaSel as any[]).filter((b) => testesAdmin[b.id] && b.status !== "aplicado");
        for (const b of marcados) {
          await supabase.from("bateria_itens")
            .update({ status: "aplicado", sessao_aplicacao_id: sessaoIdFinal })
            .eq("id", b.id);
        }
        if (marcados.length && avaliacaoSelId) {
          qc.invalidateQueries({ queryKey: ["bateria", avaliacaoSelId] });
        }
      }

      // Fotos/vídeos anexados à sessão → Galeria do paciente
      if (novasMidias.length && sessaoIdFinal) {
        for (const file of novasMidias) {
          const ehImagem = file.type.startsWith("image/");
          const ehVideo = file.type.startsWith("video/");
          if (!ehImagem && !ehVideo) { toast.error(`${file.name}: envie imagem ou vídeo`); continue; }
          if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name}: máximo 25MB`); continue; }
          const ext = file.name.split(".").pop()?.toLowerCase() ?? (ehVideo ? "mp4" : "jpg");
          const path = `pacientes/${pacienteId}/galeria/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type });
          if (upErr) { toast.error(upErr.message); continue; }
          await supabase.from("paciente_documentos").insert({
            paciente_id: pacienteId,
            categoria: "Galeria",
            titulo: file.name,
            storage_path: path,
            mime_type: file.type,
            tamanho_bytes: file.size,
            galeria: true,
            origem: "sessao",
            sessao_id: sessaoIdFinal,
          });
        }
      }

      // Auto-criar tarefa quando há orientação para casa (encaminhamento)
      if (orientacaoCasa && orientacaoTexto.trim() && !editing) {
        const prazo = new Date(); prazo.setDate(prazo.getDate() + 7);
        await supabase.from("tarefas").insert({
          paciente_id: pacienteId,
          sessao_id: sessaoIdFinal,
          titulo: `Acompanhar orientação para casa (sessão ${data})`,
          descricao: orientacaoTexto.slice(0, 1000),
          prazo: prazo.toISOString().slice(0, 10),
          prioridade: "media",
          status: "a_fazer",
          origem: "sessao",
          criador_id: user?.id ?? null,
          created_by: user?.id,
        } as any);
      }

      toast.success(editing ? "Sessão atualizada" : "Sessão registrada");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) pararGravacao(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="order-1">
          <DialogTitle className="flex items-center gap-2">
            {isAvaliacao
              ? <><FlaskConical className="h-5 w-5 text-brand" /> {editing ? "Editar" : "Nova"} sessão de avaliação</>
              : <><Target className="h-5 w-5 text-brand" /> {editing ? "Editar" : "Nova"} sessão de intervenção</>}
            <Badge variant="outline" className="ml-2 text-[10px] uppercase">{tipo}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Lembrete deixado na última sessão */}
        {ultimaNota?.nota_proxima_sessao && (
          <div className="order-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <Sparkles className="h-3.5 w-3.5" /> Lembrete da última sessão ({format(new Date(ultimaNota.data_sessao), "dd/MM/yyyy")})
            </p>
            <p className="text-amber-900 dark:text-amber-100">{ultimaNota.nota_proxima_sessao}</p>
          </div>
        )}

        {/* Planejado para esta sessão (referência) */}
        {!editing && planejamentoAtend && ((planejamentoAtend.metas_foco?.length ?? 0) > 0 || planejamentoAtend.foco || planejamentoAtend.recursos) && (
          <div className="order-1 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Target className="h-3.5 w-3.5" /> Planejado para esta sessão
            </p>
            {(planejamentoAtend.metas_foco?.length ?? 0) > 0 && (
              <p className="text-xs"><strong>{planejamentoAtend.metas_foco.length}</strong> meta(s)-foco pré-selecionada(s) abaixo.</p>
            )}
            {planejamentoAtend.foco && <p className="text-xs text-muted-foreground"><strong>Foco:</strong> {planejamentoAtend.foco}</p>}
            {planejamentoAtend.recursos && <p className="text-xs text-muted-foreground"><strong>Recursos:</strong> {planejamentoAtend.recursos}</p>}
          </div>
        )}

        {/* Avaliação vinculada + checklist de testes aplicados hoje */}
        {isAvaliacao && (
          <Card className="order-2 border-brand/30 bg-brand/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand" /> Testagem desta sessão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Avaliação</Label>
                  <Select value={avaliacaoSelId} onValueChange={(v) => { setAvaliacaoSelId(v); setTestesAdmin({}); setSessaoPlanoSelId(""); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar avaliação" /></SelectTrigger>
                    <SelectContent>
                      {(avaliacoesPac as any[]).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>
                      ))}
                      {(avaliacoesPac as any[]).length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma avaliação criada. Crie uma na aba Avaliação do paciente.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {avaliacaoSelId && (planoSessoesSel as any[]).length > 0 && (
                  <div>
                    <Label className="text-xs">Sessão planejada</Label>
                    <Select value={sessaoPlanoSelId} onValueChange={aplicarSessaoPlanejada}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Pré-marcar testes de…" /></SelectTrigger>
                      <SelectContent>
                        {ordenarSessoesPlano(planoSessoesSel as any[]).map((s, idx) => (
                          <SelectItem key={s.id} value={s.id}>{s.titulo || `Sessão ${idx + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {avaliacaoSelId && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Testes aplicados hoje</Label>
                    <span className="text-[10px] text-muted-foreground">marque os administrados nesta sessão</span>
                  </div>
                  <div className="rounded-md border divide-y max-h-56 overflow-auto">
                    {(bateriaSel as any[]).length === 0 && (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        Esta avaliação não tem testes na bateria planejada.
                      </div>
                    )}
                    {(bateriaSel as any[]).map((b) => {
                      const jaAplicado = b.status === "aplicado";
                      const marcado = jaAplicado || !!testesAdmin[b.id];
                      return (
                        <div key={b.id} className="flex items-center gap-2 px-3 py-2">
                          <Checkbox
                            checked={marcado}
                            disabled={jaAplicado}
                            onCheckedChange={(v) => setTestesAdmin((prev) => ({ ...prev, [b.id]: !!v }))}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{b.teste?.nome}</div>
                            <div className="text-[10px] text-muted-foreground">{b.teste?.dominio?.nome ?? "—"}</div>
                          </div>
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", COR_STATUS_ITEM[b.status])}>
                            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", DOT_STATUS_ITEM[b.status])} />
                            {b.status}
                          </span>
                          {(() => {
                            const nDocs = (docsTestes as any[]).filter((d) => d.teste_id === b.teste_id).length;
                            return (
                              <Button
                                type="button" size="icon" variant="ghost" className="h-7 w-7 relative"
                                disabled={anexando}
                                title="Anexar arquivo (PNG, JPEG ou PDF)"
                                onClick={() => { uploadTesteRef.current = b.teste_id; anexoInputRef.current?.click(); }}
                              >
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                {nDocs > 0 && (
                                  <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand text-[8px] font-semibold text-brand-foreground">{nDocs}</span>
                                )}
                              </Button>
                            );
                          })()}
                          <Button
                            type="button" size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => setResultadoDlg({ open: true, testeId: b.teste_id })}
                          >
                            <FlaskConical className="h-3 w-3 mr-1" />Resultado
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={anexoInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    className="hidden"
                    onChange={onAnexoTesteSelected}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Ao salvar, os testes marcados passam a "aplicado" no planejamento. Você pode lançar os
                    escores agora (botão "Resultado") ou depois, na aba Testagem &amp; Resultados.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs">Observações comportamentais durante a testagem</Label>
                <Textarea rows={3} value={obsComportamental} onChange={(e) => setObsComportamental(e.target.value)}
                  placeholder="Postura frente às tarefas, tolerância à frustração, atenção, fadiga, estratégias observadas…" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bloco IA + áudio */}
        <Card className="order-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Assistente clínico (áudio + IA)
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIaOpen((v) => !v)}>
              {iaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {iaOpen && (
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {!gravando ? (
                  <Button type="button" onClick={iniciarGravacao} size="sm">
                    <Mic className="mr-2 h-4 w-4" /> Iniciar gravação
                  </Button>
                ) : (
                  <Button type="button" onClick={pararGravacao} size="sm" variant="destructive">
                    <Square className="mr-2 h-4 w-4" /> Parar ({mmss(audioSegundos)})
                  </Button>
                )}
                {audioBlob && !gravando && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileAudio className="h-3 w-3" /> {mmss(audioSegundos)} gravados
                  </span>
                )}
                <Button type="button" size="sm" variant="secondary"
                  onClick={rodarIA} disabled={sintetizando || transcricao.trim().length < 20}>
                  {sintetizando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Sintetizar com IA
                </Button>
              </div>
              <div>
                <Label className="text-xs">Transcrição (editável)</Label>
                <Textarea rows={4} value={transcricao}
                  onChange={(e) => { setTranscricao(e.target.value); baseTranscRef.current = e.target.value; }}
                  placeholder="Fale durante a gravação ou cole a transcrição..." />
              </div>
              {resumoIA && (
                <p className="text-xs text-muted-foreground">
                  {isAvaliacao
                    ? 'A síntese foi aplicada ao campo "Observações comportamentais durante a testagem" — revise e ajuste se necessário.'
                    : 'A síntese foi aplicada ao campo "Evolução / observações" abaixo — revise e ajuste se necessário.'}
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Data / duração */}
        <div className="order-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Duração (min)</Label>
            <Input type="number" value={duracao}
              onChange={(e) => setDuracao(e.target.value ? Number(e.target.value) : "")} />
          </div>
        </div>

        {/* Registro geral (secundário) — as metas ficam ACIMA (meta-primeiro).
            Na avaliação, esses campos foram removidos: a testagem é qualitativa e
            as observações ficam na "Testagem desta sessão". */}
        {!isAvaliacao && (
        <div className="order-5 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Registro geral da sessão — complementa o registro por meta acima; não substitui as evidências clínicas.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Autorregulação</Label>
            <div className="mt-1"><CardOptionGroup options={AUTORREGULACAO_OPTIONS} value={autorregulacao} onChange={setAutorregulacao} /></div>
          </div>
          <div className="sm:col-span-2">
            <Label>Recursos utilizados (vírgula)</Label>
            <div className="flex items-center gap-2">
              <Input value={recursos} onChange={(e) => setRecursos(e.target.value)}
                placeholder="Ex: blocos lógicos, jogo da memória" />
              <RecursoPicker
                sugestaoTags={Object.values(metasState).flatMap((m) => m.componentes_trabalhados ?? [])}
                onAdd={(nome) => setRecursos((r) => (r.trim() ? r.replace(/,\s*$/, "") + ", " + nome : nome))}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Evolução / observações</Label>
            <Textarea rows={4} value={evolucao} onChange={(e) => setEvolucao(e.target.value)} />
          </div>
          </div>
        </div>
        )}

        {/* Fotos e vídeos da sessão → Galeria do paciente (apenas intervenção) */}
        {!isAvaliacao && (
        <Card className="order-6 glass">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-brand" /> Fotos e vídeos da sessão
            </CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => midiaInputRef.current?.click()}>
              <Upload className="mr-2 h-3.5 w-3.5" /> Anexar
            </Button>
            <input
              ref={midiaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                if (fs.length) setNovasMidias((p) => [...p, ...fs]);
                if (midiaInputRef.current) midiaInputRef.current.value = "";
              }}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enviadas ao salvar a sessão e disponíveis em <strong>Arquivos → Galeria</strong> (até 25&nbsp;MB cada).
            </p>
            {midiasSessao.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {midiasSessao.map((m) => (
                  <MidiaSalva key={m.id} midia={m} onRemoved={() => refetchMidias()} />
                ))}
              </div>
            )}
            {novasMidias.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {novasMidias.map((f, i) => (
                  <div key={i} className="relative rounded-lg border border-dashed border-border/60 bg-background/40 p-1">
                    {f.type.startsWith("video/") ? (
                      <div className="flex aspect-square items-center justify-center rounded bg-black/70 text-white">
                        <Film className="h-5 w-5" />
                      </div>
                    ) : (
                      <img src={URL.createObjectURL(f)} alt="" className="aspect-square w-full rounded object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setNovasMidias((p) => p.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{f.name}</p>
                  </div>
                ))}
              </div>
            )}
            {midiasSessao.length === 0 && novasMidias.length === 0 && (
              <p className="text-xs text-muted-foreground/60">Nenhuma foto ou vídeo anexado.</p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Metas trabalhadas — meta-primeiro (renderizado logo após data/duração) */}
        {!isAvaliacao && (
          <Card className="order-4 glass border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-brand" /> Metas trabalhadas — raciocínio clínico
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Não registre só a atividade: registre as <strong>evidências clínicas</strong> e como a sessão aproximou a criança da meta.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {metas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma meta ativa cadastrada. Crie e <strong>Aprove</strong> um plano na aba <strong>Plano</strong> — as metas aprovadas aparecem aqui para registrar o raciocínio clínico (componentes, evidências, progresso).
                </p>
              ) : metas.map((m: any) => {
                const ms = metasState[m.id];
                const ativa = !!ms;
                return (
                  <div key={m.id} className={`rounded-md border p-3 ${ativa ? "border-primary/40 bg-primary/5" : ""}`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={ativa}
                        onChange={(e) => toggleMeta(m.id, e.target.checked)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.titulo}</p>
                        {m.dominio_cognitivo && (
                          <Badge variant="outline" className="mt-1 text-[10px]">{m.dominio_cognitivo}</Badge>
                        )}
                      </div>
                    </label>
                    {ativa && (
                      <div className="grid gap-2 mt-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <Label className="text-[11px]">Nível GAS observado <span className="text-rose-600">*</span></Label>
                          <Select value={ms.nivel_gas_observado ?? ""} onValueChange={(v) => updateMeta(m.id, { nivel_gas_observado: v })}>
                            <SelectTrigger className={`h-8 text-xs ${ms.nivel_gas_observado == null || ms.nivel_gas_observado === "" ? "border-rose-300" : ""}`}><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {GAS_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px]">Engajamento (1-5)</Label>
                          <Select value={ms.engajamento ?? ""} onValueChange={(v) => updateMeta(m.id, { engajamento: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px]">Suporte</Label>
                          <Select value={ms.nivel_suporte ?? ""} onValueChange={(v) => updateMeta(m.id, { nivel_suporte: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {NIVEIS_SUPORTE.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Label className="text-[11px]">Componentes clínicos abordados</Label>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {((planoMetaMap as any)[m.id]?.componentes ?? []).map((nome: string) => {
                              const sel = (ms.componentes_trabalhados ?? []).includes(nome);
                              return (
                                <button
                                  key={nome}
                                  type="button"
                                  onClick={() => {
                                    const atual = ms.componentes_trabalhados ?? [];
                                    updateMeta(m.id, { componentes_trabalhados: sel ? atual.filter((c) => c !== nome) : [...atual, nome] });
                                  }}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                    sel ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted/50"
                                  }`}
                                >
                                  {nome}
                                </button>
                              );
                            })}
                            {((planoMetaMap as any)[m.id]?.componentes ?? []).length === 0 && (
                              <span className="text-[11px] text-muted-foreground/70">Sem componentes no Mapa da Meta — gere/edite o plano para tê-los.</span>
                            )}
                          </div>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Label className="text-[11px]">Evidências clínicas observadas</Label>
                          <Textarea rows={2} className="text-xs"
                            value={ms.evidencias_clinicas ?? ""}
                            onChange={(e) => updateMeta(m.id, { evidencias_clinicas: e.target.value })}
                            placeholder="Comportamentos observáveis que surgiram (não a atividade em si)..." />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px]">Houve progresso?</Label>
                          <Select value={ms.houve_progresso ?? ""} onValueChange={(v) => updateMeta(m.id, { houve_progresso: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {PROGRESSO_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Label className="text-[11px]">Ajuste no planejamento (se necessário)</Label>
                          <Textarea rows={2} className="text-xs"
                            value={ms.ajuste_plano ?? ""}
                            onChange={(e) => updateMeta(m.id, { ajuste_plano: e.target.value })}
                            placeholder="O que ajustar no plano a partir desta sessão (deixe vazio para manter)..." />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Label className="text-[11px]">Observação da meta</Label>
                          <Textarea rows={2} className="text-xs"
                            value={ms.observacoes_meta ?? ""}
                            onChange={(e) => updateMeta(m.id, { observacoes_meta: e.target.value })}
                            placeholder="Observações adicionais..." />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Nota para a próxima sessão + orientação casa */}
        <div className="order-7 space-y-3">
          <div>
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Nota para a próxima sessão
            </Label>
            <Textarea rows={2} value={notaProximaSessao}
              onChange={(e) => setNotaProximaSessao(e.target.value)}
              placeholder="Algo importante para lembrar na próxima sessão (aparece em destaque ao abrir o próximo registro)..." />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={orientacaoCasa} onCheckedChange={setOrientacaoCasa} id="orient" />
            <Label htmlFor="orient">Orientação para casa</Label>
          </div>
          {orientacaoCasa && (
            <Textarea rows={3} value={orientacaoTexto}
              onChange={(e) => setOrientacaoTexto(e.target.value)}
              placeholder="Material/atividade para casa..." />
          )}
          <div className="flex items-center gap-3">
            <Switch checked={portalOcultar} onCheckedChange={setPortalOcultar} id="portal-ocultar" />
            <Label htmlFor="portal-ocultar" className="text-muted-foreground">
              Ocultar esta sessão do Portal da Família
            </Label>
          </div>
        </div>

        <DialogFooter className="order-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : editing ? "Atualizar sessão" : "Salvar sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {isAvaliacao && avaliacaoSelId && (
      <AplicarResultadoDialog
        open={resultadoDlg.open}
        onOpenChange={(v) => setResultadoDlg((s) => ({ ...s, open: v }))}
        avaliacaoId={avaliacaoSelId}
        sessaoId={sessaoId ?? null}
        testeIdInicial={resultadoDlg.testeId}
        onSaved={() => { if (avaliacaoSelId) qc.invalidateQueries({ queryKey: ["bateria", avaliacaoSelId] }); }}
      />
    )}
    </>
  );
}

function MidiaSalva({
  midia, onRemoved,
}: {
  midia: { id: string; titulo: string | null; storage_path: string; mime_type: string | null };
  onRemoved: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const video = (midia.mime_type ?? "").startsWith("video/");
  useEffect(() => {
    let cancel = false;
    supabase.storage.from("pacientes-docs").createSignedUrl(midia.storage_path, 3600).then(({ data }) => {
      if (!cancel) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancel = true; };
  }, [midia.storage_path]);
  const remover = async () => {
    await supabase.storage.from("pacientes-docs").remove([midia.storage_path]);
    await supabase.from("paciente_documentos").delete().eq("id", midia.id);
    onRemoved();
  };
  return (
    <div className="group relative rounded-lg border border-border/50 bg-background/40 p-1">
      {!url ? (
        <div className="aspect-square w-full animate-pulse rounded bg-muted" />
      ) : video ? (
        <video src={url} className="aspect-square w-full rounded bg-black object-cover" muted preload="metadata" />
      ) : (
        <img src={url} alt={midia.titulo ?? ""} className="aspect-square w-full rounded object-cover" />
      )}
      <button
        type="button"
        onClick={remover}
        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition group-hover:opacity-100"
        title="Remover"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

