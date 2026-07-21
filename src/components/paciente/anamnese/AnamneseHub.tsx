import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Upload, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { importarProntuario } from "@/lib/importar-prontuario.functions";
import { AnamneseEntradaCards } from "./AnamneseEntradaCards";
import { AnamneseFormularioInteligente } from "./AnamneseFormularioInteligente";
import { RadarAnamnese } from "./RadarAnamnese";
import { useAnamnese, useRadarAnamnese } from "@/hooks/use-anamnese";
import { ANAMNESE_SECOES } from "@/lib/anamnese-schema";
import { exportarAnamnesePDF } from "@/lib/anamnese-pdf";

type Modo = "manual" | "pre-preenchida" | "importada";

interface Props { pacienteId: string }

export function AnamneseHub({ pacienteId }: Props) {
  const { anamnese, isLoading } = useAnamnese(pacienteId);
  const [modo, setModo] = useState<Modo | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [dadosIniciais, setDadosIniciais] = useState<Record<string, any> | undefined>();
  const [importados, setImportados] = useState<Record<string, string[]> | undefined>();
  const [temPrePreenchida, setTemPrePreenchida] = useState(false);
  const [preparando, setPreparando] = useState(true);
  const importar = useServerFn(importarProntuario);
  const radar = useRadarAnamnese();

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("cadastro_publico")
        .select("id")
        .eq("paciente_id_criado", pacienteId)
        .limit(1);
      setTemPrePreenchida((data ?? []).length > 0);
    })();
  }, [pacienteId]);

  // Inicialização única: quando a anamnese termina de carregar, decide como abrir.
  // 1) Se já existe anamnese salva → abre direto no formulário (modo salvo).
  // 2) Se não existe e há um cadastro público → auto-preenche com o que a família respondeu.
  // 3) Caso contrário → mostra os cards de escolha de modo.
  const inicializou = useRef(false);
  useEffect(() => {
    if (inicializou.current || isLoading) return;
    inicializou.current = true;
    const temSalva = anamnese?.secoes_estruturadas && Object.keys(anamnese.secoes_estruturadas).length > 0;
    if (temSalva) {
      setModo((anamnese?.modo_entrada as Modo) ?? "manual");
      setPreparando(false);
      return;
    }
    void autoPreencherDoCadastro().finally(() => setPreparando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  /** Busca o cadastro público e, se houver dados aproveitáveis, entra já pré-preenchida. */
  async function autoPreencherDoCadastro() {
    try {
      const { data: cad } = await supabase
        .from("cadastro_publico")
        .select("dados_json")
        .eq("paciente_id_criado", pacienteId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const dj: any = cad?.dados_json ?? null;
      if (dj) {
        const { secoes, marcas } = mapearCadastroParaSecoes(dj);
        if (Object.keys(secoes).length > 0) {
          setDadosIniciais(secoes);
          setImportados(marcas);
          setModo("pre-preenchida");
        }
      }
    } catch {
      /* silencioso — cai na tela de escolha de modo */
    }
  }

  function trocarModo() {
    inicializou.current = true; // impede que o efeito reaplique o modo/auto-preenchimento
    setModo(null);
    setDadosIniciais(undefined);
    setImportados(undefined);
  }

  async function escolher(m: Modo) {
    if (m === "pre-preenchida") {
      setCarregando("Importando respostas do cadastro público…");
      try {
        const { data: cad } = await supabase
          .from("cadastro_publico")
          .select("dados_json")
          .eq("paciente_id_criado", pacienteId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const dj: any = cad?.dados_json ?? {};
        const { secoes, marcas } = mapearCadastroParaSecoes(dj);
        setDadosIniciais(secoes);
        setImportados(marcas);
        setModo(m);
      } catch (e: any) {
        toast.error(e.message ?? "Erro ao carregar cadastro");
      } finally {
        setCarregando(null);
      }
      return;
    }
    setModo(m);
  }

  async function uploadDoc(file: File) {
    setCarregando("Lendo documento com IA…");
    try {
      if (file.type === "application/pdf") {
        const b64 = await fileToBase64(file);
        const r: any = await importar({ data: { paciente_id: pacienteId, modo: "pdf", pdf_base64: b64, pdf_mime: file.type, filename: file.name } });
        const { secoes, marcas } = mapearExtraidoParaSecoes(r.extraido);
        setDadosIniciais(secoes);
        setImportados(marcas);
        setModo("importada");
      } else {
        const text = await file.text();
        const r: any = await importar({ data: { paciente_id: pacienteId, modo: "texto", texto: text, filename: file.name } });
        const { secoes, marcas } = mapearExtraidoParaSecoes(r.extraido);
        setDadosIniciais(secoes);
        setImportados(marcas);
        setModo("importada");
      }
      toast.success("Documento importado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha na importação");
    } finally {
      setCarregando(null);
    }
  }

  async function regerarRadar() {
    const r = await radar.mutateAsync({ paciente_id: pacienteId, secoes: (anamnese?.secoes_estruturadas as any) ?? {} });
    toast.success("Radar regenerado · salve a anamnese para persistir");
    return r;
  }

  async function exportarPDF() {
    const { data: pac } = await supabase
      .from("pacientes")
      .select("nome, data_nascimento")
      .eq("id", pacienteId)
      .maybeSingle();
    const nasc = pac?.data_nascimento ?? null;
    const idade = nasc ? Math.floor((Date.now() - new Date(nasc).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null;
    exportarAnamnesePDF({
      pacienteNome: pac?.nome ?? "Paciente",
      pacienteIdade: idade,
      pacienteNascimento: nasc ? new Date(nasc).toLocaleDateString("pt-BR") : null,
      secoes: (anamnese?.secoes_estruturadas as any) ?? {},
      resumos: (anamnese?.resumos_secao as any) ?? {},
    });
    toast.success("PDF gerado");
  }

  const temAnamnese = anamnese?.secoes_estruturadas && Object.keys(anamnese.secoes_estruturadas).length > 0;

  if (preparando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparando anamnese…
      </div>
    );
  }

  if (!modo) {
    return (
      <div className="space-y-4">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Nova Anamnese</CardTitle>
            {temAnamnese && (
              <Button size="sm" variant="outline" onClick={exportarPDF}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> Exportar PDF
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha como deseja iniciar. A IA acompanhará a construção em segundo plano, sugerindo correlações sempre validadas pela profissional.
            </p>
            <AnamneseEntradaCards onSelect={escolher} temPrePreenchida={temPrePreenchida} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle className="text-sm">Importar documento (PDF / Word / Excel)</CardTitle></CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 cursor-pointer">
              <Input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} className="max-w-md" />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </label>
            {carregando && <p className="mt-2 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> {carregando}</p>}
          </CardContent>
        </Card>

        {anamnese?.radar_scores && Object.keys(anamnese.radar_scores).length > 0 && (
          <RadarAnamnese scores={anamnese.radar_scores as any} onRegenerar={regerarRadar} loading={radar.isPending} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={trocarModo}><ArrowLeft className="h-3 w-3 mr-1" /> Trocar modo</Button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Modo: {modo === "manual" ? "Preenchimento manual" : modo === "pre-preenchida" ? "Pré-preenchida pela família" : "Importada de documento"}
          </span>
          <label>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])}
            />
            <span className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> Refazer upload
            </span>
          </label>
          <Button size="sm" variant="outline" onClick={exportarPDF}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> Exportar PDF
          </Button>
        </div>
      </div>
      {carregando && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> {carregando}</p>}
      <AnamneseFormularioInteligente
        pacienteId={pacienteId}
        modo={modo}
        dadosIniciais={dadosIniciais}
        importadosIniciais={importados}
      />
      {anamnese?.radar_scores && Object.keys(anamnese.radar_scores).length > 0 && (
        <RadarAnamnese scores={anamnese.radar_scores as any} />
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Mapeia as respostas do cadastro_publico (dados_json) para o schema de seções da anamnese.
 * A forma de `dj` segue exatamente o formulário público (converterCadastroEmPaciente):
 *   paciente, queixa, responsaveis, financeiro, contexto_familiar, gestacao, parto,
 *   desenvolvimento, saude, tratamentos.
 */
function mapearCadastroParaSecoes(dj: any): { secoes: Record<string, Record<string, any>>; marcas: Record<string, string[]> } {
  const secoes: Record<string, Record<string, any>> = {};
  const marcas: Record<string, string[]> = {};
  const opcoesDe = (sec: string, campo: string): string[] | undefined =>
    ANAMNESE_SECOES.find((s) => s.key === sec)?.campos.find((c) => c.key === campo)?.opcoes;

  /** Grava um valor, marcando o campo como "importado". */
  const set = (sec: string, campo: string, v: any) => {
    if (v == null || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    secoes[sec] = { ...(secoes[sec] ?? {}), [campo]: v };
    marcas[sec] = [...(marcas[sec] ?? []), campo];
  };
  /** Grava em campo com opções fixas (select/radio): só se o valor casar com uma opção. */
  const setOpcao = (sec: string, campo: string, v: any) => {
    if (v == null || v === "") return;
    const ops = opcoesDe(sec, campo);
    if (ops && !ops.includes(String(v))) return;
    set(sec, campo, v);
  };
  /** Grava em chips/multi: mantém só os valores que casam com as opções do schema. */
  const setMulti = (sec: string, campo: string, v: any) => {
    const lista = arr(v);
    if (!lista) return;
    const ops = opcoesDe(sec, campo);
    const filtrada = ops ? lista.filter((x: string) => ops.includes(x)) : lista;
    if (filtrada.length) set(sec, campo, filtrada);
  };

  const paciente = dj?.paciente ?? {};
  const queixa = dj?.queixa ?? {};
  const cf = dj?.contexto_familiar ?? {};
  const gest = dj?.gestacao ?? {};
  const parto = dj?.parto ?? {};
  const desenv = dj?.desenvolvimento ?? {};
  const saude = dj?.saude ?? {};
  const trat = dj?.tratamentos ?? {};

  // Identificação
  const genero = paciente.genero === "Prefere não dizer" ? "Prefere não informar" : paciente.genero;
  set("identificacao", "nome_completo", paciente.nome);
  set("identificacao", "data_nascimento", paciente.data_nascimento);
  setOpcao("identificacao", "genero", genero);

  // Queixa principal
  set("queixa_principal", "queixa", queixa.queixa_principal);
  set("queixa_principal", "expectativas", queixa.expectativas);

  // Escola
  set("escolar", "escola_atual", paciente.escola);
  set("escolar", "serie", paciente.serie_curso);

  // Contexto familiar
  set("contexto_familiar", "estrutura_familiar", cf.com_quem_mora || juntar(cf.com_quem_mora_lista));
  setOpcao("contexto_familiar", "relacao_responsaveis", cf.relacao_pais_tag);
  const obsFamilia = [
    cf.relacao_pais && `Relação dos pais: ${cf.relacao_pais}`,
    cf.rede_apoio && `Rede de apoio: ${cf.rede_apoio}`,
    cf.historico_familiar && `Histórico familiar: ${cf.historico_familiar}`,
    cf.rotina && rotinaTexto(cf.rotina),
  ].filter(Boolean).join("\n");
  set("contexto_familiar", "observacoes", obsFamilia);

  // Gestação e parto
  setOpcao("gestacao", "gestacao_planejada", boolParaSimNao(gest.planejada));
  setOpcao("gestacao", "pre_natal", gest.pre_natal);
  setMulti("gestacao", "intercorrencias_gestacao", gest.intercorrencias_lista);
  setOpcao("gestacao", "tipo_parto", parto.tipo);
  setMulti("gestacao", "intercorrencias_parto", parto.intercorrencias_lista);
  const semanas = parseInt(String(gest.semanas ?? "").replace(/\D/g, ""), 10);
  if (!isNaN(semanas)) set("gestacao", "idade_gestacional", semanas);

  // Desenvolvimento / linguagem
  setOpcao("desenvolvimento", "andou", desenv.andou);
  setMulti("desenvolvimento", "marcos_atrasados", desenv.sinais_atraso_lista);
  setOpcao("linguagem", "primeiras_palavras", desenv.primeiras_palavras);

  // Saúde
  const medicacoes = medicacoesTexto(saude.medicacoes_lista);
  set("saude", "medicacoes", medicacoes);
  setMulti("saude", "condicoes", saude.outras_lista);

  // Histórico clínico
  setMulti("historico_clinico", "tratamentos_anteriores", trat.lista);
  const diags = [
    queixa.diagnostico_status && `Status: ${queixa.diagnostico_status}`,
    Array.isArray(queixa.diagnosticos) && queixa.diagnosticos.length && `Diagnósticos: ${queixa.diagnosticos.join(", ")}`,
    queixa.diagnostico_outro,
  ].filter(Boolean).join("\n");
  set("historico_clinico", "diagnosticos_previos", diags);

  return { secoes, marcas };
}

function juntar(v: any): string | undefined {
  if (!Array.isArray(v) || !v.length) return undefined;
  return v.join(", ");
}
function boolParaSimNao(v: any): string | undefined {
  if (v === true || v === "Sim" || v === "sim") return "Sim";
  if (v === false || v === "Não" || v === "nao" || v === "não") return "Não";
  return undefined;
}
function rotinaTexto(r: any): string | undefined {
  if (!r || typeof r !== "object") return undefined;
  const partes = [r.manha && `Manhã: ${r.manha}`, r.tarde && `Tarde: ${r.tarde}`, r.noite && `Noite: ${r.noite}`].filter(Boolean);
  return partes.length ? `Rotina — ${partes.join(" · ")}` : undefined;
}
function medicacoesTexto(lista: any): string | undefined {
  if (!Array.isArray(lista) || !lista.length) return undefined;
  return lista
    .map((m: any) => [m?.nome, m?.posologia, m?.frequencia].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n");
}

function mapearExtraidoParaSecoes(ex: any): { secoes: Record<string, Record<string, any>>; marcas: Record<string, string[]> } {
  const secoes: Record<string, Record<string, any>> = {};
  const marcas: Record<string, string[]> = {};
  const set = (sec: string, campo: string, v: any) => {
    if (v == null || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    secoes[sec] = { ...(secoes[sec] ?? {}), [campo]: v };
    marcas[sec] = [...(marcas[sec] ?? []), campo];
  };

  // 1) Usa anamnese_estruturada se a IA devolveu (preferencial — mapeia 1:1 ao schema)
  const ae = ex?.anamnese_estruturada ?? {};
  const known = new Set(ANAMNESE_SECOES.map((s) => s.key));
  for (const [secKey, campos] of Object.entries(ae)) {
    if (!known.has(secKey) || !campos || typeof campos !== "object") continue;
    for (const [campoKey, valor] of Object.entries(campos as Record<string, any>)) {
      set(secKey, campoKey, valor);
    }
  }

  // 2) Fallback: usa dados_pessoais e pre_anamnese
  const dp = ex?.dados_pessoais ?? {};
  set("identificacao", "nome_completo", dp.nome);
  set("identificacao", "data_nascimento", dp.data_nascimento);
  set("identificacao", "genero", dp.genero);
  set("queixa_principal", "queixa", dp.queixa_principal);
  set("queixa_principal", "expectativas", dp.expectativas);
  set("escolar", "escola_atual", dp.contato_escola);
  set("escolar", "serie", dp.serie_curso);

  return { secoes, marcas };
}

function arr(v: any): any { if (!v) return undefined; return Array.isArray(v) ? v : [String(v)]; }
