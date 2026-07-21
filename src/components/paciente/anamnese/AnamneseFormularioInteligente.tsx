import { useEffect, useMemo, useState } from "react";
import { ANAMNESE_SECOES, percentualTotal } from "@/lib/anamnese-schema";
import { SecaoAccordion } from "./SecaoAccordion";
import { PainelInsights } from "./PainelInsights";
import { MapaDominiosAnamnese } from "./MapaDominiosAnamnese";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Save, Sparkles, Check, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { gerarResumoCompletoAnamnese } from "@/lib/anamnese.functions";
import { useAnamnese, useAnamneseInsights, useRadarAnamnese } from "@/hooks/use-anamnese";
import { usePerfilVivo } from "@/hooks/use-perfil-vivo";

interface Props {
  pacienteId: string;
  modo: "manual" | "pre-preenchida" | "importada";
  dadosIniciais?: Record<string, Record<string, any>>;
  importadosIniciais?: Record<string, string[]>;
  onConcluir?: () => void;
}

export function AnamneseFormularioInteligente({ pacienteId, modo, dadosIniciais, importadosIniciais, onConcluir }: Props) {
  const { anamnese, save } = useAnamnese(pacienteId);
  const { merge } = usePerfilVivo(pacienteId);
  const radar = useRadarAnamnese();
  const gerarResumo = useServerFn(gerarResumoCompletoAnamnese);
  const [gerandoResumo, setGerandoResumo] = useState(false);

  const [secoes, setSecoes] = useState<Record<string, Record<string, any>>>(dadosIniciais ?? {});
  const [resumos, setResumos] = useState<Record<string, string>>({});
  const [importados, setImportados] = useState<Record<string, string[]>>(importadosIniciais ?? {});
  const [validados, setValidados] = useState<Record<string, string[]>>({});
  const [scores, setScores] = useState<Record<string, number>>({});

  const RESUMO_KEY = "__completo";
  const resumoCompleto = resumos[RESUMO_KEY] ?? "";
  const setResumoCompleto = (txt: string) => setResumos((p) => ({ ...p, [RESUMO_KEY]: txt }));

  // hidrata do banco quando a anamnese carrega (uma vez)
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => {
    if (hidratado || !anamnese?.id) return;
    // sempre mescla os dados do banco; dadosIniciais (importação/cadastro público)
    // têm prioridade sobre as respostas já gravadas no banco.
    const dbSecoes = (anamnese.secoes_estruturadas as any) ?? {};
    const merged: Record<string, Record<string, any>> = { ...dbSecoes };
    if (dadosIniciais) {
      for (const [sec, campos] of Object.entries(dadosIniciais)) {
        merged[sec] = { ...(merged[sec] ?? {}), ...campos };
      }
    }
    setSecoes(merged);
    if (anamnese.resumos_secao) setResumos(anamnese.resumos_secao as any);
    if (anamnese.insights_validados) setValidados(anamnese.insights_validados as any);
    if (anamnese.radar_scores) setScores(anamnese.radar_scores as any);
    const dbImp = (anamnese.campos_importados as any) ?? {};
    const mergedImp: Record<string, string[]> = { ...dbImp };
    if (importadosIniciais) {
      for (const [sec, arr] of Object.entries(importadosIniciais)) {
        mergedImp[sec] = Array.from(new Set([...(mergedImp[sec] ?? []), ...arr]));
      }
    }
    setImportados(mergedImp);
    setHidratado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anamnese?.id, dadosIniciais, importadosIniciais]);

  const { insights, loading, regenerate } = useAnamneseInsights(pacienteId, secoes);
  const pctTotal = useMemo(() => percentualTotal(secoes), [secoes]);

  function setCampo(secaoKey: string, campo: string, value: any) {
    setSecoes((prev) => ({ ...prev, [secaoKey]: { ...(prev[secaoKey] ?? {}), [campo]: value } }));
    // se o usuário editou, remove a marcação "importado"
    setImportados((prev) => {
      const arr = prev[secaoKey] ?? [];
      if (!arr.includes(campo)) return prev;
      return { ...prev, [secaoKey]: arr.filter((c) => c !== campo) };
    });
  }

  function setResumo(secaoKey: string, txt: string) {
    setResumos((prev) => ({ ...prev, [secaoKey]: txt }));
  }

  function validarInsight(cat: string, item: string) {
    setValidados((prev) => ({ ...prev, [cat]: Array.from(new Set([...(prev[cat] ?? []), item])) }));
  }
  function descartarInsight(cat: string, item: string) {
    setValidados((prev) => ({ ...prev, [cat]: (prev[cat] ?? []).filter((x) => x !== item) }));
  }

  /** Recalcula os scores do radar via IA a partir das respostas atuais. Retorna null se a IA não devolver scores. */
  async function calcularScores(): Promise<Record<string, number> | null> {
    const r = await radar.mutateAsync({ paciente_id: pacienteId, secoes });
    const novo: Record<string, number> = {};
    ["contexto_familiar", "gestacao", "desenvolvimento", "escolar", "comportamento", "rotina"].forEach((k) => {
      if (typeof r[k] === "number") novo[k] = r[k];
    });
    return Object.keys(novo).length ? novo : null;
  }

  async function salvar() {
    // Recalcula o mapa junto do salvamento; se a IA falhar, mantém os scores atuais e salva mesmo assim.
    let novoScores = scores;
    try {
      const c = await calcularScores();
      if (c) { novoScores = c; setScores(c); }
    } catch { /* mantém o mapa atual — não bloqueia o salvamento */ }
    await save.mutateAsync({
      secoes_estruturadas: secoes,
      resumos_secao: resumos,
      insights_validados: validados,
      campos_importados: importados,
      radar_scores: novoScores,
      modo_entrada: modo,
    });
    toast.success("Anamnese salva · mapa atualizado");
  }

  async function gerarRadar() {
    let novo: Record<string, number> | null;
    try {
      novo = await calcularScores();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao analisar as respostas");
      return;
    }
    if (!novo) {
      toast.error("A análise não retornou scores. Preencha mais respostas e tente de novo.");
      return;
    }
    setScores(novo);
    // Persiste imediatamente para o mapa não reverter ao recarregar e refletir em outras telas.
    await save.mutateAsync({
      secoes_estruturadas: secoes,
      resumos_secao: resumos,
      insights_validados: validados,
      campos_importados: importados,
      radar_scores: novo,
      modo_entrada: modo,
    });
    toast.success("Mapa atualizado e salvo");
  }

  async function aplicarPerfilVivo() {
    const protetores: string[] = validados.fatores_protetivos ?? [];
    const hipoteses: string[] = validados.hipoteses_a_considerar ?? [];
    const barreiras: string[] = validados.fatores_de_risco ?? [];
    await merge.mutateAsync({
      potencializadores: protetores,
      hipoteses_ativas: hipoteses,
      barreiras: barreiras.map((d) => ({ descricao: d })),
    });
    toast.success("Aplicado ao Perfil Clínico Vivo");
  }

  async function concluir() {
    let novoScores = scores;
    try {
      const c = await calcularScores();
      if (c) { novoScores = c; setScores(c); }
    } catch { /* mantém o mapa atual — não bloqueia a conclusão */ }
    await save.mutateAsync({
      secoes_estruturadas: secoes,
      resumos_secao: resumos,
      insights_validados: validados,
      campos_importados: importados,
      radar_scores: novoScores,
      modo_entrada: modo,
      concluida_em: new Date().toISOString(),
    });
    toast.success("Anamnese concluída · mapa atualizado");
    onConcluir?.();
  }

  async function gerarResumoCompleto() {
    setGerandoResumo(true);
    try {
      // separa observações por seção (exclui a chave do resumo completo)
      const obs: Record<string, string> = {};
      for (const [k, v] of Object.entries(resumos)) {
        if (k !== RESUMO_KEY && v && v.trim()) obs[k] = v;
      }
      const r: any = await gerarResumo({ data: { paciente_id: pacienteId, secoes, observacoes: obs } });
      setResumoCompleto(r.resumo ?? "");
      toast.success("Resumo completo gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar resumo");
    } finally {
      setGerandoResumo(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
      <div className="space-y-3">
        <div className="glass rounded-lg border p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">Progresso geral</span>
              <span className="text-muted-foreground">{pctTotal}%</span>
            </div>
            <Progress value={pctTotal} className="h-2" />
          </div>
          <Button size="sm" variant="outline" onClick={salvar} disabled={save.isPending || radar.isPending}>
            {save.isPending || radar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Salvar
          </Button>
          <Button size="sm" onClick={concluir} disabled={save.isPending || radar.isPending}>
            {save.isPending || radar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />} Concluir
          </Button>
        </div>

        <MapaDominiosAnamnese scores={scores} onRegenerar={gerarRadar} loading={radar.isPending || save.isPending} />

        {ANAMNESE_SECOES.map((def) => (
          <SecaoAccordion
            key={def.key}
            def={def}
            dados={secoes[def.key] ?? {}}
            importados={importados[def.key] ?? []}
            resumo={resumos[def.key]}
            onChange={(campo, v) => setCampo(def.key, campo, v)}
            onResumo={(t) => setResumo(def.key, t)}
          />
        ))}

        <Card className="glass border-brand/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" /> Resumo completo da anamnese
            </CardTitle>
            <Button size="sm" onClick={gerarResumoCompleto} disabled={gerandoResumo}>
              {gerandoResumo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              {resumoCompleto ? "Regenerar com IA" : "Gerar com IA"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={resumoCompleto}
              onChange={(e) => setResumoCompleto(e.target.value)}
              placeholder="Clique em 'Gerar com IA' ao finalizar o preenchimento para sintetizar toda a anamnese em um texto clínico integrado. O conteúdo é editável."
              className="min-h-[220px] text-sm bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              Lembre-se de clicar em <strong>Salvar</strong> para preservar o resumo gerado.
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <PainelInsights
          insights={insights}
          loading={loading}
          validados={validados}
          onValidar={validarInsight}
          onDescartar={descartarInsight}
          onAplicarPerfilVivo={aplicarPerfilVivo}
          onRegenerar={regenerate}
        />
      </div>
    </div>
  );
}
