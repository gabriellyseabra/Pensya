import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, FlaskConical, FileText, Upload, Trash2, ChevronLeft,
  ClipboardList, Sparkles, Download, FileDown, ListChecks, Pencil, ChevronDown, ChevronRight, BarChart3,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ImpactosCIFEditor, type ImpactoCif, CIF_DIM_LABEL } from "./ImpactosCIFEditor";
import { VariaveisTesteEditor, type VariavelDef, normalizarResultado, classificarPorPercentil, classificarResultado, corClassificacaoBg } from "./VariaveisTesteEditor";
import { useRubricas } from "@/hooks/use-rubricas";
import { classificar, classificarRotulo, corDoRotulo } from "@/lib/avaliacao-classificacao";
import { GeradorGraficoAvaliacao } from "./GeradorGraficoAvaliacao";
import { AplicarBateriaModeloDialog } from "@/components/paciente/AplicarBateriaModeloDialog";
import { AplicarResultadoDialog } from "@/components/prontuario/AplicarResultadoDialog";
import { FORMULAS_AGREGACAO, type FormulaAgregacao } from "@/lib/baterias.functions";


const STATUS_AVALIACAO = [
  { value: "planejamento", label: "Em planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "arquivada", label: "Arquivada" },
];

const STATUS_ITEM = [
  { value: "planejado", label: "Planejado" },
  { value: "aplicado", label: "Aplicado" },
  { value: "pendente", label: "Pendente" },
  { value: "descartado", label: "Descartado" },
];

// Cores por status do item da bateria (legenda + destaque na tabela)
export const COR_STATUS_ITEM: Record<string, string> = {
  planejado: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  aplicado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  descartado: "bg-muted text-muted-foreground border-border",
};
export const DOT_STATUS_ITEM: Record<string, string> = {
  planejado: "bg-blue-500",
  aplicado: "bg-emerald-500",
  pendente: "bg-amber-500",
  descartado: "bg-muted-foreground/40",
};

// Ordena as sessões planejadas cronologicamente (por data prevista; sem data vão ao fim)
export function ordenarSessoesPlano(list: any[]): any[] {
  return [...(list ?? [])].sort((a, b) => {
    const da = a.data_prevista as string | null;
    const db = b.data_prevista as string | null;
    if (da && db) return da < db ? -1 : da > db ? 1 : (a.ordem ?? 0) - (b.ordem ?? 0);
    if (da && !db) return -1;
    if (!da && db) return 1;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
}

export function LegendaStatusBateria() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {STATUS_ITEM.map((s) => (
        <span key={s.value} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_STATUS_ITEM[s.value])} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function calcIdadeAnosMeses(nascISO: string | null | undefined, refISO: string | null | undefined): string {
  if (!nascISO || !refISO) return "";
  const n = new Date(nascISO); const r = new Date(refISO);
  if (isNaN(+n) || isNaN(+r)) return "";
  let anos = r.getFullYear() - n.getFullYear();
  let meses = r.getMonth() - n.getMonth();
  if (r.getDate() < n.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }
  if (anos < 0) return "";
  return `${anos}a ${meses}m`;
}

// Formata número: inteiros sem decimal, demais com até 2 casas (sem zeros à direita)
function fmtNum(v: any): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}


// Conta variáveis preenchidas (para badge na linha principal — NÃO inventa escore global)
function statsDeVariaveis(vv: any): { total: number; comClassif: number } {
  if (!vv || typeof vv !== "object") return { total: 0, comClassif: 0 };
  const objs = Object.values(vv).map((v: any) => normalizarResultado(v));
  const preenchidas = objs.filter(
    (r) => r.bruto != null || r.padrao != null || r.percentil != null || (r.impressoes && r.impressoes !== ""),
  );
  const comClassif = preenchidas.filter(
    (r) => classificarResultado(r.percentil ?? null, r.padrao ?? null) != null,
  ).length;
  return { total: preenchidas.length, comClassif };
}

// Aplica fórmula configurada no catálogo para agregar as variáveis em um escore global
function aplicarFormula(vv: any, formula: FormulaAgregacao | null | undefined):
  { bruto: number | null; padrao: number | null; percentil: number | null } | null {
  if (!formula || formula === "nenhuma") return null;
  if (!vv || typeof vv !== "object") return null;
  const objs = Object.values(vv).map((v: any) => normalizarResultado(v));
  const num = (x: any) => (x == null || x === "" || isNaN(Number(x)) ? null : Number(x));
  const brutos    = objs.map((r) => num(r.bruto)).filter((n): n is number => n != null);
  const padroes   = objs.map((r) => num(r.padrao)).filter((n): n is number => n != null);
  const percentis = objs.map((r) => num(r.percentil)).filter((n): n is number => n != null);
  const media = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  switch (formula) {
    case "soma_brutos":     return { bruto: brutos.length ? brutos.reduce((s, x) => s + x, 0) : null, padrao: null, percentil: null };
    case "media_padrao":    return { bruto: null, padrao: media(padroes), percentil: null };
    case "media_percentil": return { bruto: null, padrao: null, percentil: media(percentis) };
    case "min_percentil":   return { bruto: null, padrao: null, percentil: percentis.length ? Math.min(...percentis) : null };
    case "max_percentil":   return { bruto: null, padrao: null, percentil: percentis.length ? Math.max(...percentis) : null };
    default: return null;
  }
}

export function AvaliacaoTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openNova, setOpenNova] = useState(false);
  const [nova, setNova] = useState({ titulo: "", queixa: "", hipoteses: "", data_inicio: format(new Date(), "yyyy-MM-dd") });

  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes", pacienteId],
    queryFn: async () => (await supabase
      .from("avaliacoes")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!nova.titulo) throw new Error("Informe um título");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("avaliacoes").insert({
        paciente_id: pacienteId,
        titulo: nova.titulo,
        queixa: nova.queixa || null,
        hipoteses: nova.hipoteses || null,
        data_inicio: nova.data_inicio || null,
        profissional_id: u.user?.id ?? null,
        status: "planejamento",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success("Avaliação criada");
      setOpenNova(false);
      setNova({ titulo: "", queixa: "", hipoteses: "", data_inicio: format(new Date(), "yyyy-MM-dd") });
      qc.invalidateQueries({ queryKey: ["avaliacoes", pacienteId] });
      setSelectedId(d.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (selectedId) {
    return <AvaliacaoDetalhe id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Avaliações</h3>
          <p className="text-sm text-muted-foreground">Baterias de testes, escores e registros qualitativos.</p>
        </div>
        <Button onClick={() => setOpenNova(true)}><Plus className="w-4 h-4 mr-2" />Nova avaliação</Button>
      </div>

      {(!avaliacoes || avaliacoes.length === 0) ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma avaliação cadastrada ainda.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {avaliacoes.map((a: any) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setSelectedId(a.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{a.titulo}</CardTitle>
                  <Badge variant="outline">{STATUS_AVALIACAO.find(s => s.value === a.status)?.label ?? a.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {a.data_inicio && <div>Início: {format(parseISO(a.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</div>}
                {a.queixa && <div className="line-clamp-2">{a.queixa}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openNova} onOpenChange={setOpenNova}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={nova.titulo} onChange={e => setNova({ ...nova, titulo: e.target.value })} placeholder="Ex: Avaliação psicopedagógica - 2026/1" /></div>
            <div><Label>Data de início</Label><Input type="date" value={nova.data_inicio} onChange={e => setNova({ ...nova, data_inicio: e.target.value })} /></div>
            <div><Label>Queixa / demanda</Label><Textarea rows={2} value={nova.queixa} onChange={e => setNova({ ...nova, queixa: e.target.value })} /></div>
            <div><Label>Hipóteses</Label><Textarea rows={2} value={nova.hipoteses} onChange={e => setNova({ ...nova, hipoteses: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNova(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AvaliacaoDetalhe({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();

  const { data: aval } = useQuery({
    queryKey: ["avaliacao", id],
    queryFn: async () => (await supabase.from("avaliacoes").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: paciente } = useQuery({
    enabled: !!aval?.paciente_id,
    queryKey: ["paciente-mini", aval?.paciente_id],
    queryFn: async () => (await supabase
      .from("pacientes")
      .select("nome, data_nascimento")
      .eq("id", aval!.paciente_id)
      .maybeSingle()).data,
  });

  const { rubricaDeTeste } = useRubricas();

  const { data: catalogo } = useQuery({
    queryKey: ["testes-catalogo"],
    queryFn: async () => (await supabase
      .from("testes_catalogo")
      .select("id, nome, objetivo, cif_dimensoes, cif_descricao, variaveis, formula_agregacao, rubrica_id, dominio:dominios_cognitivos(id, nome)")
      .eq("ativo", true)
      .order("nome")).data ?? [],
  });

  const { data: dominios } = useQuery({
    queryKey: ["dominios-cognitivos"],
    queryFn: async () => (await supabase
      .from("dominios_cognitivos").select("id, nome").order("nome")).data ?? [],
  });


  const { data: bateria } = useQuery({
    queryKey: ["bateria", id],
    queryFn: async () => (await supabase
      .from("bateria_itens")
      .select("*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("avaliacao_id", id)
      .order("ordem")).data ?? [],
  });

  // Pré-planejamento das sessões da avaliação (Sessão 1, 2, 3…)
  const { data: planoSessoes } = useQuery({
    queryKey: ["avaliacao-plano-sessoes", id],
    queryFn: async () => (await supabase
      .from("avaliacao_sessoes_plano")
      .select("*")
      .eq("avaliacao_id", id)
      .order("ordem")).data ?? [],
  });
  // Ordenadas cronologicamente pela data prevista (reorganiza sozinho ao editar datas)
  const planoSessoesOrd = useMemo(() => ordenarSessoesPlano(planoSessoes ?? []), [planoSessoes]);

  const addSessaoPlano = useMutation({
    mutationFn: async () => {
      const ordem = planoSessoes?.length ?? 0;
      const { error } = await supabase.from("avaliacao_sessoes_plano").insert({
        avaliacao_id: id, ordem, titulo: `Sessão ${ordem + 1}`,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avaliacao-plano-sessoes", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updSessaoPlano = useMutation({
    mutationFn: async ({ sid, patch }: { sid: string; patch: any }) => {
      const { error } = await supabase.from("avaliacao_sessoes_plano").update(patch).eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avaliacao-plano-sessoes", id] }),
  });

  const delSessaoPlano = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from("avaliacao_sessoes_plano").delete().eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avaliacao-plano-sessoes", id] });
      qc.invalidateQueries({ queryKey: ["bateria", id] });
    },
  });

  const { data: aplicados } = useQuery({
    queryKey: ["testes-aplicados", id],
    queryFn: async () => (await supabase
      .from("testes_aplicados")
      .select("*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("avaliacao_id", id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: docs } = useQuery({
    queryKey: ["aval-docs", id],
    queryFn: async () => (await supabase
      .from("avaliacao_documentos")
      .select("*")
      .eq("avaliacao_id", id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const atualizarAval = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("avaliacoes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["avaliacao", id] }); qc.invalidateQueries({ queryKey: ["avaliacoes"] }); },
  });

  const [novoTesteBateria, setNovoTesteBateria] = useState("");
  const addBateria = useMutation({
    mutationFn: async () => {
      if (!novoTesteBateria) throw new Error("Selecione um teste");
      const { error } = await supabase.from("bateria_itens").insert({
        avaliacao_id: id, teste_id: novoTesteBateria, status: "planejado",
        ordem: (bateria?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovoTesteBateria(""); qc.invalidateQueries({ queryKey: ["bateria", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updBateria = useMutation({
    mutationFn: async ({ itemId, patch }: { itemId: string; patch: any }) => {
      const { error } = await supabase.from("bateria_itens").update(patch).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bateria", id] }),
  });

  const delBateria = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("bateria_itens").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bateria", id] }),
  });

  // Lançar teste aplicado — diálogo extraído (reutilizado também na sessão de avaliação)
  const [resultadoDlg, setResultadoDlg] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [openVars, setOpenVars] = useState<Set<string>>(new Set());
  const [openGrafico, setOpenGrafico] = useState(false);
  const toggleVars = (rowId: string) => setOpenVars(prev => {
    const n = new Set(prev);
    if (n.has(rowId)) n.delete(rowId); else n.add(rowId);
    return n;
  });
  const [openModelo, setOpenModelo] = useState(false);

  function abrirNovo() { setResultadoDlg({ open: true, editing: null }); }
  function abrirEdicao(a: any) { setResultadoDlg({ open: true, editing: a }); }

  // Cadastro rápido de novo instrumento direto na bateria do paciente
  const [openNovoTeste, setOpenNovoTeste] = useState(false);
  const [novoTeste, setNovoTeste] = useState({ nome: "", dominio_id: "" });
  const criarTesteRapido = useMutation({
    mutationFn: async () => {
      if (!novoTeste.nome.trim()) throw new Error("Informe o nome do teste");
      const { data: u } = await supabase.auth.getUser();
      const { data: t, error } = await supabase.from("testes_catalogo").insert({
        nome: novoTeste.nome.trim(),
        dominio_id: novoTeste.dominio_id || null,
        ativo: true,
        created_by: u.user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("bateria_itens").insert({
        avaliacao_id: id, teste_id: t.id, status: "planejado", ordem: (bateria?.length ?? 0),
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Teste cadastrado e adicionado à bateria");
      setOpenNovoTeste(false);
      setNovoTeste({ nome: "", dominio_id: "" });
      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
      qc.invalidateQueries({ queryKey: ["instrumentos-todos"] });
      qc.invalidateQueries({ queryKey: ["bateria", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delAplicado = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("testes_aplicados").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["testes-aplicados", id] }),
  });

  // Upload de documentos
  const [uploading, setUploading] = useState(false);
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Máx 20MB"); return; }
    setUploading(true);
    const path = `avaliacoes/${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("prontuario-docs").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("avaliacao_documentos").insert({
      avaliacao_id: id, nome: file.name, storage_path: path,
      tamanho: file.size, tipo: file.type, uploaded_by: u.user?.id ?? null,
    });
    toast.success("Documento anexado");
    setUploading(false);
    e.target.value = "";
    qc.invalidateQueries({ queryKey: ["aval-docs", id] });
  }

  async function baixar(d: any) {
    const { data } = await supabase.storage.from("prontuario-docs").createSignedUrl(d.storage_path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function deletarDoc(d: any) {
    await supabase.storage.from("prontuario-docs").remove([d.storage_path]);
    await supabase.from("avaliacao_documentos").delete().eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["aval-docs", id] });
  }

  const corClassificacao = (c?: string) => {
    switch (c) {
      case "Extremamente superior": return "bg-indigo-600 text-white";
      case "Superior à média":      return "bg-sky-500/20 text-sky-700 dark:text-sky-300";
      case "Média Superior":        return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
      case "Média":                 return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
      case "Média Inferior":        return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
      case "Inferior à média":      return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
      case "Extremamente inferior": return "bg-rose-600 text-white";
      case "Qualitativo":           return "bg-sky-500/20 text-sky-700 dark:text-sky-300";
      default:                      return "bg-muted text-muted-foreground";
    }
  };

  // Agrupa aplicados por domínio
  const porDominio = useMemo(() => {
    const m = new Map<string, any[]>();
    (aplicados ?? []).forEach((a: any) => {
      const d = a.teste?.dominio?.nome ?? "Sem domínio";
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    });
    return Array.from(m.entries());
  }, [aplicados]);

  if (!aval) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  function exportarPDF() {
    const a = aval;
    if (!a) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 48;

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Relatório de Avaliação", marginX, y);
    y += 8;
    doc.setDrawColor(180); doc.line(marginX, y, pageW - marginX, y); y += 18;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, marginX, y);
    y += 18;

    doc.setTextColor(20); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(a.titulo, marginX, y); y += 16;

    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const meta: string[] = [];
    if (paciente?.nome) meta.push(`Paciente: ${paciente.nome}`);
    if (paciente?.data_nascimento) meta.push(`Nasc.: ${format(parseISO(paciente.data_nascimento), "dd/MM/yyyy")}`);
    if (a.data_inicio) meta.push(`Início: ${format(parseISO(a.data_inicio), "dd/MM/yyyy")}`);
    if (a.data_fim) meta.push(`Fim: ${format(parseISO(a.data_fim), "dd/MM/yyyy")}`);
    meta.push(`Status: ${STATUS_AVALIACAO.find(s => s.value === a.status)?.label ?? a.status}`);
    meta.forEach(line => { doc.text(line, marginX, y); y += 14; });
    y += 6;

    const section = (titulo: string, texto?: string | null) => {
      if (!texto) return;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(titulo, marginX, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(texto, pageW - marginX * 2);
      doc.text(lines, marginX, y); y += lines.length * 12 + 10;
      if (y > 780) { doc.addPage(); y = 48; }
    };
    section("Queixa / demanda", a.queixa);
    section("Hipóteses", a.hipoteses);

    // Resultados por domínio
    if (porDominio.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Resultados aplicados", marginX, y); y += 8;
      porDominio.forEach(([dominio, lista]) => {
        autoTable(doc, {
          startY: y + 6,
          head: [[dominio, "Data", "Bruto", "Padrão", "Percentil", "Classificação"]],
          body: lista.map((a: any) => [
            a.teste?.nome ?? "—",
            a.data_aplicacao ? format(parseISO(a.data_aplicacao), "dd/MM/yyyy") : "—",
            a.escore_bruto ?? "—",
            a.escore_padrao ?? "—",
            a.percentil ?? "—",
            a.classificacao ?? "—",
          ]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [60, 60, 70], textColor: 255 },
          margin: { left: marginX, right: marginX },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
        // Observações qualitativas por teste
        lista.forEach((a: any) => {
          if (a.observacoes_qualitativas) {
            if (y > 760) { doc.addPage(); y = 48; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(9);
            doc.text(`${a.teste?.nome ?? "Teste"} — observações:`, marginX, y); y += 12;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(a.observacoes_qualitativas, pageW - marginX * 2);
            doc.text(lines, marginX, y); y += lines.length * 11 + 6;
          }
        });
        if (y > 760) { doc.addPage(); y = 48; }
      });
    }

    // Bateria planejada
    if (bateria && bateria.length > 0) {
      if (y > 700) { doc.addPage(); y = 48; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Bateria planejada", marginX, y);
      autoTable(doc, {
        startY: y + 8,
        head: [["Teste", "Domínio", "Status"]],
        body: bateria.map((b: any) => [
          b.teste?.nome ?? "—",
          b.teste?.dominio?.nome ?? "—",
          STATUS_ITEM.find(s => s.value === b.status)?.label ?? b.status,
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [60, 60, 70], textColor: 255 },
        margin: { left: marginX, right: marginX },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    if (a.conclusao) {
      if (y > 700) { doc.addPage(); y = 48; }
      section("Conclusão", a.conclusao);
    }

    // Anexos
    if (docs && docs.length > 0) {
      if (y > 720) { doc.addPage(); y = 48; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Documentos anexados", marginX, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      docs.forEach((d: any) => {
        if (y > 800) { doc.addPage(); y = 48; }
        doc.text(`• ${d.nome} (${format(parseISO(d.created_at), "dd/MM/yyyy")})`, marginX, y);
        y += 13;
      });
    }

    // Rodapé com paginação
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(140);
      doc.text(`Página ${i} de ${total}`, pageW - marginX, 820, { align: "right" });
    }

    const safeNome = (paciente?.nome ?? "paciente").replace(/[^a-z0-9\-_]+/gi, "_");
    doc.save(`avaliacao_${safeNome}_${format(new Date(), "yyyyMMdd")}.pdf`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" />Voltar para avaliações</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenGrafico(true)}><BarChart3 className="w-4 h-4 mr-2" />Gráficos</Button>
          <Button variant="outline" size="sm" onClick={exportarPDF}><FileDown className="w-4 h-4 mr-2" />Exportar PDF</Button>
        </div>
      </div>

      <GeradorGraficoAvaliacao
        open={openGrafico}
        onOpenChange={setOpenGrafico}
        titulo={aval?.titulo}
        aplicados={aplicados ?? []}
        rubricaDeTeste={rubricaDeTeste}
        catalogo={catalogo ?? []}
        avaliacaoId={id}
        onSalvou={() => qc.invalidateQueries({ queryKey: ["aval-docs", id] })}
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{aval.titulo}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {aval.data_inicio && `Início ${format(parseISO(aval.data_inicio), "dd/MM/yyyy")}`}
                {aval.data_fim && ` · Fim ${format(parseISO(aval.data_fim), "dd/MM/yyyy")}`}
              </p>
            </div>
            <Select value={aval.status} onValueChange={(v) => atualizarAval.mutate({ status: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_AVALIACAO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Queixa / demanda</Label>
            <Textarea rows={3} defaultValue={aval.queixa ?? ""} onBlur={(e) => e.target.value !== (aval.queixa ?? "") && atualizarAval.mutate({ queixa: e.target.value })} />
          </div>
          <div>
            <Label>Hipóteses</Label>
            <Textarea rows={3} defaultValue={aval.hipoteses ?? ""} onBlur={(e) => e.target.value !== (aval.hipoteses ?? "") && atualizarAval.mutate({ hipoteses: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Conclusão</Label>
            <Textarea rows={3} defaultValue={aval.conclusao ?? ""} onBlur={(e) => e.target.value !== (aval.conclusao ?? "") && atualizarAval.mutate({ conclusao: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* BATERIA */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="w-4 h-4" />Bateria planejada</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setOpenModelo(true)}>
              <ListChecks className="w-4 h-4 mr-2" />Bateria modelo + avulsos
            </Button>
          </div>
          <LegendaStatusBateria />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={novoTesteBateria} onValueChange={setNovoTesteBateria}>
              <SelectTrigger><SelectValue placeholder="Selecionar teste do catálogo" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {catalogo?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}{t.dominio?.nome ? ` — ${t.dominio.nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => addBateria.mutate()} disabled={!novoTesteBateria}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
            <Button variant="outline" onClick={() => setOpenNovoTeste(true)} title="Cadastrar um teste que ainda não existe no catálogo">
              <Plus className="w-4 h-4 mr-1" />Novo teste
            </Button>
          </div>

          {/* Pré-planejamento das sessões */}
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />Planejamento das sessões
              </Label>
              <Button size="sm" variant="outline" className="h-7" onClick={() => addSessaoPlano.mutate()}>
                <Plus className="w-3.5 h-3.5 mr-1" />Adicionar sessão
              </Button>
            </div>
            {(planoSessoes?.length ?? 0) === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Crie sessões (Sessão 1, 2, 3…) e atribua os testes de cada uma na coluna "Sessão" abaixo. No registro, o checklist já vem pré-marcado.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {planoSessoesOrd.map((s: any, idx: number) => (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">{idx + 1}.</span>
                    <Input
                      className="h-7 w-32 text-xs"
                      defaultValue={s.titulo ?? ""}
                      placeholder={`Sessão ${idx + 1}`}
                      onBlur={(e) => e.target.value !== (s.titulo ?? "") && updSessaoPlano.mutate({ sid: s.id, patch: { titulo: e.target.value || null } })}
                    />
                    <Input
                      type="date"
                      className="h-7 w-32 text-xs"
                      defaultValue={s.data_prevista ?? ""}
                      onBlur={(e) => e.target.value !== (s.data_prevista ?? "") && updSessaoPlano.mutate({ sid: s.id, patch: { data_prevista: e.target.value || null } })}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delSessaoPlano.mutate(s.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {bateria && bateria.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teste</TableHead>
                  <TableHead>Domínio</TableHead>
                  {(planoSessoes?.length ?? 0) > 0 && <TableHead>Sessão</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bateria.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.teste?.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{b.teste?.dominio?.nome ?? "—"}</TableCell>
                    {(planoSessoes?.length ?? 0) > 0 && (
                      <TableCell>
                        <Select
                          value={b.sessao_plano_id ?? "none"}
                          onValueChange={(v) => updBateria.mutate({ itemId: b.id, patch: { sessao_plano_id: v === "none" ? null : v } })}
                        >
                          <SelectTrigger className="w-32 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sem sessão</SelectItem>
                            {planoSessoesOrd.map((s: any, idx: number) => (
                              <SelectItem key={s.id} value={s.id}>{s.titulo || `Sessão ${idx + 1}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Select value={b.status} onValueChange={(v) => updBateria.mutate({ itemId: b.id, patch: { status: v } })}>
                        <SelectTrigger className={cn("w-40 h-8 border font-medium [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:whitespace-nowrap", COR_STATUS_ITEM[b.status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ITEM.map(s => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <span className={cn("inline-block h-2 w-2 rounded-full", DOT_STATUS_ITEM[s.value])} />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => delBateria.mutate(b.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CRONOGRAMA DAS SESSÕES */}
      {(planoSessoes?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="w-4 h-4" />Cronograma das sessões</CardTitle>
            <p className="text-xs text-muted-foreground">Visão do que está planejado para cada sessão e o andamento da aplicação.</p>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-border">
              {planoSessoesOrd.map((s: any, idx: number) => {
                const testes = (bateria ?? []).filter((b: any) => b.sessao_plano_id === s.id);
                const aplicados = testes.filter((b: any) => b.status === "aplicado").length;
                const todosAplicados = testes.length > 0 && aplicados === testes.length;
                return (
                  <li key={s.id} className="relative pl-8">
                    <span className={cn(
                      "absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full border-2 bg-background text-[11px] font-semibold",
                      todosAplicados ? "border-emerald-500 text-emerald-600" : "border-brand text-brand",
                    )}>
                      {idx + 1}
                    </span>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="font-medium text-sm">{s.titulo || `Sessão ${idx + 1}`}</div>
                        <div className="flex items-center gap-2">
                          {s.data_prevista && (
                            <Badge variant="outline" className="text-[10px]">{format(parseISO(s.data_prevista), "dd/MM/yyyy")}</Badge>
                          )}
                          <Badge variant="outline" className={cn("text-[10px]", todosAplicados && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300")}>
                            {aplicados}/{testes.length} aplicados
                          </Badge>
                        </div>
                      </div>
                      {testes.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground mt-2">Nenhum teste atribuído a esta sessão.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {testes.map((b: any) => (
                            <li key={b.id} className="flex items-center gap-2 text-xs">
                              <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", DOT_STATUS_ITEM[b.status])} />
                              <span className="flex-1 min-w-0 truncate">{b.teste?.nome}</span>
                              <span className="text-muted-foreground text-[10px]">{STATUS_ITEM.find((x) => x.value === b.status)?.label ?? b.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
              {(() => {
                const semSessao = (bateria ?? []).filter((b: any) => !b.sessao_plano_id);
                if (semSessao.length === 0) return null;
                return (
                  <li className="relative pl-8">
                    <span className="absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
                      <ClipboardList className="h-3 w-3" />
                    </span>
                    <div className="rounded-lg border border-dashed p-3">
                      <div className="font-medium text-sm text-muted-foreground">Sem sessão atribuída</div>
                      <ul className="mt-2 space-y-1">
                        {semSessao.map((b: any) => (
                          <li key={b.id} className="flex items-center gap-2 text-xs">
                            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", DOT_STATUS_ITEM[b.status])} />
                            <span className="flex-1 min-w-0 truncate">{b.teste?.nome}</span>
                            <span className="text-muted-foreground text-[10px]">{STATUS_ITEM.find((x) => x.value === b.status)?.label ?? b.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })()}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* TESTES APLICADOS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="w-4 h-4" />Resultados aplicados</CardTitle>
            <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Lançar resultado</Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!aplicados || aplicados.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum resultado lançado.</p>
          ) : (
            <div className="space-y-6">
              {porDominio.map(([dominio, lista]) => (
                <div key={dominio}>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{dominio}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teste</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Bruto</TableHead>
                        <TableHead>Padrão</TableHead>
                        <TableHead>Percentil</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lista.map((a: any) => {
                        const temGlobal = a.escore_bruto != null || a.escore_padrao != null || a.percentil != null;
                        const cat: any = catalogo?.find((c: any) => c.id === a.teste_id);
                        const rubricaDoTeste = rubricaDeTeste(a.teste_id);
                        const formula: FormulaAgregacao | null = (cat?.formula_agregacao as any) ?? null;
                        const agregado = !temGlobal ? aplicarFormula(a.variaveis_valores, formula) : null;
                        const stats = !temGlobal ? statsDeVariaveis(a.variaveis_valores) : { total: 0, comClassif: 0 };
                        const apenasVariaveis = !temGlobal && !agregado && stats.total > 0;
                        const isQualitativo = !temGlobal && !agregado && stats.total === 0
                          && (a.classificacao === "Qualitativo" || !!a.observacoes_qualitativas || !!a.interpretacao_clinica);
                        const brutoCell = a.escore_bruto != null ? fmtNum(a.escore_bruto) : (agregado?.bruto != null ? fmtNum(agregado.bruto) : "—");
                        const padraoCell = a.escore_padrao != null ? fmtNum(a.escore_padrao) : (agregado?.padrao != null ? fmtNum(agregado.padrao) : "—");
                        const percCell = a.percentil != null ? fmtNum(a.percentil) : (agregado?.percentil != null ? fmtNum(agregado.percentil) : "—");
                        const classifAgregada = agregado ? classificarRotulo(rubricaDoTeste, { percentil: agregado.percentil, escorePadrao: agregado.padrao }) : null;
                        const classifCell = a.classificacao ?? classifAgregada ?? (isQualitativo ? "Qualitativo" : null);
                        const formulaLabel = agregado ? FORMULAS_AGREGACAO.find(f => f.value === formula)?.label : null;
                        return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {(() => {
                              const temVars = a.variaveis_valores && typeof a.variaveis_valores === "object" && Object.keys(a.variaveis_valores).length > 0;
                              const aberto = openVars.has(a.id);
                              return (
                                <div className="flex items-center gap-1">
                                  {temVars ? (
                                    <Button size="icon" variant="ghost" className="h-5 w-5 -ml-1" onClick={() => toggleVars(a.id)} title={aberto ? "Recolher variáveis" : "Expandir variáveis"}>
                                      {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </Button>
                                  ) : <span className="inline-block w-5" />}
                                  <span>{a.teste?.nome}</span>
                                </div>
                              );
                            })()}
                            {isQualitativo && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-300">qualitativo</Badge>
                            )}
                            {apenasVariaveis && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300" title="Cada variável tem seu próprio escore/percentil/classificação. O teste não tem escore global agregado.">
                                {stats.total} variáve{stats.total === 1 ? "l" : "is"}
                              </Badge>
                            )}
                            {formulaLabel && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300" title={`Escore global calculado por: ${formulaLabel}`}>
                                ∑ {formulaLabel}
                              </Badge>
                            )}
                            {a.observacoes_qualitativas && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.observacoes_qualitativas}</div>
                            )}
                            {openVars.has(a.id) && a.variaveis_valores && typeof a.variaveis_valores === "object" && Object.keys(a.variaveis_valores).length > 0 && (() => {
                              const cat: any = catalogo?.find((c: any) => c.id === a.teste_id);
                              const schema: any[] = Array.isArray(cat?.variaveis) ? cat.variaveis : [];
                              return (
                                <div className="mt-2 space-y-0.5 pl-5 border-l-2 border-border/40">
                                  {Object.entries(a.variaveis_valores).map(([k, raw]) => {
                                    const def = schema.find((s) => s.key === k);
                                    const r = normalizarResultado(raw as any);
                                    const cl = classificar(rubricaDoTeste, { percentil: r.percentil ?? null, escorePadrao: r.padrao ?? null });
                                    return (
                                      <div key={k} className="flex items-center gap-2 text-[11px] flex-wrap">
                                        <span className="font-medium text-foreground/80 min-w-[120px]">{def?.label ?? k}</span>
                                        {r.bruto != null && r.bruto !== "" && <span className="text-muted-foreground">bruto <b className="text-foreground">{fmtNum(r.bruto)}</b></span>}
                                        {r.padrao != null && <span className="text-muted-foreground">padrão <b className="text-foreground">{fmtNum(r.padrao)}</b></span>}
                                        {r.percentil != null && <span className="text-muted-foreground">P <b className="text-foreground">{fmtNum(r.percentil)}</b></span>}
                                        {cl && <span className="px-1.5 py-px rounded text-[10px]" style={{ backgroundColor: `${cl.cor}26`, color: cl.cor }}>{cl.rotulo}</span>}
                                        {r.impressoes && <span className="text-muted-foreground italic">— {r.impressoes}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            {Array.isArray(a.impactos_cif) && a.impactos_cif.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {a.impactos_cif.map((imp: any, i: number) => (
                                  <Badge key={i} variant="outline" className={
                                    "text-[10px] " +
                                    (imp.tipo === "forca" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                      : imp.tipo === "fragilidade" ? "border-rose-500/40 text-rose-700 dark:text-rose-300"
                                      : "border-sky-500/40 text-sky-700 dark:text-sky-300")
                                  }>
                                    {CIF_DIM_LABEL[imp.dim as keyof typeof CIF_DIM_LABEL] ?? imp.dim}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">{a.data_aplicacao ? format(parseISO(a.data_aplicacao), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>{isQualitativo ? "—" : brutoCell}</TableCell>
                          <TableCell>{isQualitativo ? "—" : padraoCell}</TableCell>
                          <TableCell>{isQualitativo ? "—" : percCell}</TableCell>
                          <TableCell>
                            {classifCell
                              ? (() => {
                                  const cor = classifCell === "Qualitativo" ? null : corDoRotulo(rubricaDoTeste, classifCell);
                                  return cor
                                    ? <Badge className="border-transparent" style={{ backgroundColor: `${cor}26`, color: cor }}>{classifCell}</Badge>
                                    : <Badge className={corClassificacao(classifCell)}>{classifCell}</Badge>;
                                })()
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => abrirEdicao(a)} title="Editar resultado">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => delAplicado.mutate(a.id)} title="Excluir">
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DOCUMENTOS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" />Documentos</CardTitle>
            <Label className="cursor-pointer">
              <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80">
                <Upload className="w-4 h-4" />{uploading ? "Enviando..." : "Anexar"}
              </span>
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          {(!docs || docs.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum documento anexado.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">{format(parseISO(d.created_at), "dd/MM/yyyy HH:mm")}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => baixar(d)}><Download className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deletarDoc(d)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />Na Fase 3, a IA lerá esses PDFs para sugerir o plano de intervenção.
          </p>
        </CardContent>
      </Card>

      {/* DIALOG: lançar resultado (componente extraído/reutilizável) */}
      <AplicarResultadoDialog
        open={resultadoDlg.open}
        onOpenChange={(v) => setResultadoDlg((s) => ({ ...s, open: v }))}
        avaliacaoId={id}
        editing={resultadoDlg.editing}
      />

      <AplicarBateriaModeloDialog
        open={openModelo}
        onOpenChange={setOpenModelo}
        avaliacaoId={id}
        jaPlanejados={(bateria ?? []).map((b: any) => b.teste_id)}
      />

      {/* DIALOG: cadastro rápido de novo instrumento */}
      <Dialog open={openNovoTeste} onOpenChange={setOpenNovoTeste}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo teste / instrumento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do teste</Label>
              <Input value={novoTeste.nome} onChange={(e) => setNovoTeste({ ...novoTeste, nome: e.target.value })} placeholder="Ex: Figuras Complexas de Rey" />
            </div>
            <div>
              <Label>Domínio cognitivo (opcional)</Label>
              <Select value={novoTeste.dominio_id} onValueChange={(v) => setNovoTeste({ ...novoTeste, dominio_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar domínio" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(dominios ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O teste será criado no catálogo e já adicionado à bateria. Você pode detalhar variáveis e CIF depois em Configurações → Instrumentos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovoTeste(false)}>Cancelar</Button>
            <Button onClick={() => criarTesteRapido.mutate()} disabled={criarTesteRapido.isPending}>Cadastrar e adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
