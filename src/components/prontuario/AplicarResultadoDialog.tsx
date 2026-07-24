import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ImpactosCIFEditor, type ImpactoCif } from "./ImpactosCIFEditor";
import { VariaveisTesteEditor, type VariavelDef } from "./VariaveisTesteEditor";
import { useServerFn } from "@tanstack/react-start";
import { aprenderVariaveisTeste, salvarFormulaTeste, FORMULAS_AGREGACAO, type FormulaAgregacao } from "@/lib/baterias.functions";
import { useRubricas, salvarRubricaDeTeste } from "@/hooks/use-rubricas";
import { classificarRotulo } from "@/lib/avaliacao-classificacao";
import { RubricaPreview } from "./RubricaPreview";

export function calcIdadeAnosMeses(nascISO: string | null | undefined, refISO: string | null | undefined): string {
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

const aplicarInicial = {
  teste_id: "", data_aplicacao: format(new Date(), "yyyy-MM-dd"),
  escore_bruto: "", escore_padrao: "", percentil: "", observacoes_qualitativas: "", idade_aplicacao: "",
  interpretacao_clinica: "", impactos_cif: [] as ImpactoCif[],
  variaveis_valores: {} as Record<string, any>,
  variaveis_schema_local: [] as VariavelDef[],
  qualitativo: false,
};

/**
 * Diálogo de lançamento/edição de resultado de teste.
 * Extraído de AvaliacaoTab para ser reutilizado também no registro de sessão
 * de avaliação. Compartilha o cache do react-query (mesmas queryKeys), então
 * não refaz as buscas de catálogo/bateria/paciente já carregadas pela aba.
 *
 * @param sessaoId quando informado, marca o resultado como lançado nesta sessão.
 * @param testeIdInicial pré-seleciona o teste ao abrir em modo criação.
 * @param editing quando informado, abre em modo edição com os dados do resultado.
 */
export function AplicarResultadoDialog({
  open, onOpenChange, avaliacaoId, sessaoId, testeIdInicial, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  avaliacaoId: string;
  sessaoId?: string | null;
  testeIdInicial?: string | null;
  editing?: any | null;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editingId: string | null = editing?.id ?? null;
  const { rubricas, rubricaDeTeste, rubricaIdDeTeste } = useRubricas();

  const { data: aval } = useQuery({
    enabled: !!avaliacaoId,
    queryKey: ["avaliacao", avaliacaoId],
    queryFn: async () => (await supabase.from("avaliacoes").select("*").eq("id", avaliacaoId).maybeSingle()).data,
  });

  const { data: paciente } = useQuery({
    enabled: !!aval?.paciente_id,
    queryKey: ["paciente-mini", aval?.paciente_id],
    queryFn: async () => (await supabase
      .from("pacientes").select("nome, data_nascimento").eq("id", aval!.paciente_id).maybeSingle()).data,
  });

  const { data: catalogo } = useQuery({
    queryKey: ["testes-catalogo"],
    queryFn: async () => (await supabase
      .from("testes_catalogo")
      .select("id, nome, objetivo, cif_dimensoes, cif_descricao, variaveis, formula_agregacao, rubrica_id, dominio:dominios_cognitivos(id, nome)")
      .eq("ativo", true)
      .order("nome")).data ?? [],
  });

  const { data: bateria } = useQuery({
    enabled: !!avaliacaoId,
    queryKey: ["bateria", avaliacaoId],
    queryFn: async () => (await supabase
      .from("bateria_itens")
      .select("*, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("avaliacao_id", avaliacaoId)
      .order("ordem")).data ?? [],
  });

  const [aplicar, setAplicar] = useState<any>(aplicarInicial);
  const [mostrarCatalogoCompleto, setMostrarCatalogoCompleto] = useState(false);
  const [mostrarEscoreGlobal, setMostrarEscoreGlobal] = useState(false);

  // Sincroniza o estado do formulário quando o diálogo abre (novo ou edição).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const vv = (editing.variaveis_valores && typeof editing.variaveis_valores === "object") ? editing.variaveis_valores : {};
      const cat: any = (catalogo ?? []).find((c: any) => c.id === editing.teste_id);
      const baseKeys = new Set<string>(Array.isArray(cat?.variaveis) ? cat.variaveis.map((v: any) => v.key) : []);
      const schemaLocal: VariavelDef[] = Object.keys(vv)
        .filter((k) => !baseKeys.has(k))
        .map((k) => ({ key: k, label: k, tipo: "numero" as const, unidade: null }));
      setAplicar({
        teste_id: editing.teste_id ?? "",
        data_aplicacao: editing.data_aplicacao ?? format(new Date(), "yyyy-MM-dd"),
        escore_bruto: editing.escore_bruto ?? "",
        escore_padrao: editing.escore_padrao ?? "",
        percentil: editing.percentil ?? "",
        observacoes_qualitativas: editing.observacoes_qualitativas ?? "",
        idade_aplicacao: editing.idade_aplicacao ?? "",
        interpretacao_clinica: editing.interpretacao_clinica ?? "",
        impactos_cif: Array.isArray(editing.impactos_cif) ? editing.impactos_cif : [],
        variaveis_valores: vv,
        variaveis_schema_local: schemaLocal,
        qualitativo: editing.classificacao === "Qualitativo",
      });
      setMostrarEscoreGlobal(!!(editing.escore_bruto || editing.escore_padrao || editing.percentil));
    } else {
      setAplicar({ ...aplicarInicial, data_aplicacao: format(new Date(), "yyyy-MM-dd"), teste_id: testeIdInicial ?? "" });
      setMostrarEscoreGlobal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId, testeIdInicial]);

  const aprenderVars = useServerFn(aprenderVariaveisTeste);
  const salvarFormula = useServerFn(salvarFormulaTeste);

  const testeIdsPlanejados = useMemo(
    () => new Set((bateria ?? []).map((b: any) => b.teste_id)),
    [bateria],
  );
  const catalogoFiltrado = useMemo(() => {
    if (mostrarCatalogoCompleto || testeIdsPlanejados.size === 0) return catalogo ?? [];
    return (catalogo ?? []).filter((t: any) => testeIdsPlanejados.has(t.id));
  }, [catalogo, testeIdsPlanejados, mostrarCatalogoCompleto]);

  const testeSelecionado: any = useMemo(
    () => (catalogo ?? []).find((t: any) => t.id === aplicar.teste_id) ?? null,
    [catalogo, aplicar.teste_id],
  );
  const rubricaDoTeste = useMemo(
    () => rubricaDeTeste(aplicar.teste_id),
    [rubricaDeTeste, aplicar.teste_id],
  );

  // Troca a rubrica de classificação do teste (vínculo por organização).
  const definirRubrica = useMutation({
    mutationFn: async (rubricaId: string | null) => {
      if (!aplicar.teste_id) return;
      await salvarRubricaDeTeste(aplicar.teste_id, rubricaId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teste-rubrica-map"] }); toast.success("Rubrica do teste atualizada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const variaveisSchema: VariavelDef[] = useMemo(() => {
    const base = Array.isArray(testeSelecionado?.variaveis) ? (testeSelecionado.variaveis as VariavelDef[]) : [];
    const novas = (aplicar.variaveis_schema_local ?? []).filter((n: VariavelDef) => !base.some((b) => b.key === n.key));
    return [...base, ...novas];
  }, [testeSelecionado, aplicar.variaveis_schema_local]);

  const criarAplicado = useMutation({
    mutationFn: async () => {
      if (!aplicar.teste_id) throw new Error("Selecione o teste");
      const { data: u } = await supabase.auth.getUser();
      const varsLimpa: Record<string, any> = {};
      Object.entries(aplicar.variaveis_valores ?? {}).forEach(([k, v]) => {
        if (v == null) return;
        if (typeof v === "object") {
          const r: any = v;
          const naoVazio = ["bruto", "padrao", "percentil", "impressoes"].some((c) => r[c] != null && r[c] !== "");
          if (naoVazio) varsLimpa[k] = r;
        } else if (v !== "" && v != null) {
          varsLimpa[k] = v;
        }
      });
      const isQualitativo = !!aplicar.qualitativo;
      const payload: any = {
        avaliacao_id: avaliacaoId,
        teste_id: aplicar.teste_id,
        data_aplicacao: aplicar.data_aplicacao || format(new Date(), "yyyy-MM-dd"),
        idade_aplicacao: calcIdadeAnosMeses(paciente?.data_nascimento, aplicar.data_aplicacao) || aplicar.idade_aplicacao || null,
        escore_bruto: !isQualitativo && aplicar.escore_bruto !== "" ? Number(aplicar.escore_bruto) : null,
        escore_padrao: !isQualitativo && aplicar.escore_padrao !== "" ? Number(aplicar.escore_padrao) : null,
        percentil: !isQualitativo && aplicar.percentil !== "" ? Number(aplicar.percentil) : null,
        observacoes_qualitativas: aplicar.observacoes_qualitativas || null,
        interpretacao_clinica: aplicar.interpretacao_clinica || null,
        impactos_cif: aplicar.impactos_cif ?? [],
        variaveis_valores: isQualitativo ? {} : varsLimpa,
        classificacao: isQualitativo
          ? "Qualitativo"
          : (classificarRotulo(rubricaDoTeste, {
              percentil: aplicar.percentil !== "" ? Number(aplicar.percentil) : null,
              escorePadrao: aplicar.escore_padrao !== "" ? Number(aplicar.escore_padrao) : null,
            }) ?? null),
        aplicado_por: u.user?.id ?? null,
      };
      if (editingId) {
        const { aplicado_por, ...patch } = payload;
        if (sessaoId) patch.sessao_id = sessaoId;
        const { error } = await supabase.from("testes_aplicados").update(patch).eq("id", editingId);
        if (error) throw error;
      } else {
        if (sessaoId) payload.sessao_id = sessaoId;
        const { error } = await supabase.from("testes_aplicados").insert(payload);
        if (error) throw error;
      }

      // Memória global: mescla variáveis novas no catálogo
      if (!isQualitativo && (aplicar.variaveis_schema_local ?? []).length > 0) {
        try {
          await aprenderVars({ data: { teste_id: aplicar.teste_id, variaveis: aplicar.variaveis_schema_local } });
        } catch (e: any) {
          console.warn("Falha ao aprender variáveis:", e?.message);
        }
      }

      // marca item da bateria como aplicado, se existir planejado
      if (!editingId) {
        const item = (bateria ?? []).find((b: any) => b.teste_id === aplicar.teste_id && b.status !== "aplicado");
        if (item) {
          const patch: any = { status: "aplicado" };
          if (sessaoId) patch.sessao_aplicacao_id = sessaoId;
          await supabase.from("bateria_itens").update(patch).eq("id", item.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Resultado atualizado" : "Resultado lançado e classificado");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["testes-aplicados", avaliacaoId] });
      qc.invalidateQueries({ queryKey: ["bateria", avaliacaoId] });
      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? "Editar resultado de teste" : "Lançar resultado de teste"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Teste</Label>
              {testeIdsPlanejados.size > 0 && (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <Switch checked={mostrarCatalogoCompleto} onCheckedChange={setMostrarCatalogoCompleto} className="scale-75" />
                  Mostrar catálogo completo
                </label>
              )}
            </div>
            <Select value={aplicar.teste_id} onValueChange={(v) => setAplicar({ ...aplicar, teste_id: v, variaveis_valores: {}, variaveis_schema_local: [] })}>
              <SelectTrigger><SelectValue placeholder={testeIdsPlanejados.size === 0 ? "Adicione testes à bateria primeiro" : "Selecionar"} /></SelectTrigger>
              <SelectContent className="max-h-80">
                {catalogoFiltrado.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    {testeIdsPlanejados.size === 0
                      ? "Nenhum teste planejado. Adicione um à bateria ou ative o catálogo completo."
                      : "Sem resultados."}
                  </div>
                )}
                {catalogoFiltrado.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}{t.dominio?.nome ? ` — ${t.dominio.nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {testeIdsPlanejados.size > 0 && !mostrarCatalogoCompleto && (
              <p className="text-[10px] text-muted-foreground mt-1">Mostrando apenas testes do planejamento desta avaliação.</p>
            )}
          </div>

          {aplicar.teste_id && !aplicar.qualitativo && (
            <div>
              <Label>Rubrica de classificação</Label>
              <Select
                value={rubricaIdDeTeste(aplicar.teste_id) ?? "__padrao__"}
                onValueChange={(v) => definirRubrica.mutate(v === "__padrao__" ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__padrao__">Padrão (clínica — 7 faixas)</SelectItem>
                  {rubricas.filter((r) => r.id).map((r) => (
                    <SelectItem key={r.id} value={r.id!}>
                      {r.nome}{r.is_preset ? "" : " · sua rubrica"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RubricaPreview rubrica={rubricaDoTeste} />
              <p className="text-[10px] text-muted-foreground mt-1">
                A classificação é gerada por essa régua — o percentil/escore continua inserido por você. Cadastre rubricas próprias em Configurações › Rubricas de classificação.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de aplicação</Label>
              <Input type="date" value={aplicar.data_aplicacao} onChange={e => setAplicar({ ...aplicar, data_aplicacao: e.target.value })} />
              <p className="text-[10px] text-muted-foreground mt-1">Preenchida automaticamente com a data de hoje.</p>
            </div>
            <div>
              <Label>Idade na aplicação</Label>
              <Input
                value={calcIdadeAnosMeses(paciente?.data_nascimento, aplicar.data_aplicacao) || "—"}
                readOnly disabled className="bg-muted/40"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {paciente?.data_nascimento ? "Calculada a partir do perfil do paciente." : "Cadastre a data de nascimento no perfil."}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <div>
              <Label className="text-sm">Teste qualitativo</Label>
              <p className="text-[10px] text-muted-foreground">Sem escores numéricos — registre apenas observações e interpretação.</p>
            </div>
            <Switch
              checked={!!aplicar.qualitativo}
              onCheckedChange={(v) => setAplicar({ ...aplicar, qualitativo: v, ...(v ? { escore_bruto: "", escore_padrao: "", percentil: "", variaveis_valores: {} } : {}) })}
            />
          </div>

          {!aplicar.qualitativo && (() => {
            const editorVariaveis = aplicar.teste_id && (
              <VariaveisTesteEditor
                schema={variaveisSchema}
                valores={aplicar.variaveis_valores}
                rubrica={rubricaDoTeste}
                onChangeValores={(v) => setAplicar({ ...aplicar, variaveis_valores: v })}
                onAddSchema={(novo) => setAplicar({
                  ...aplicar,
                  variaveis_schema_local: [...(aplicar.variaveis_schema_local ?? []), novo],
                })}
                onRemoveSchema={(key) => {
                  const novos = (aplicar.variaveis_schema_local ?? []).filter((s: VariavelDef) => s.key !== key);
                  const valoresClean = { ...aplicar.variaveis_valores };
                  delete valoresClean[key];
                  setAplicar({ ...aplicar, variaveis_schema_local: novos, variaveis_valores: valoresClean });
                }}
              />
            );

            const formulaAgregacao = aplicar.teste_id && variaveisSchema.length > 0 && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fórmula de agregação das variáveis</Label>
                <Select
                  value={(testeSelecionado?.formula_agregacao as string) ?? "nenhuma"}
                  onValueChange={async (v) => {
                    try {
                      await salvarFormula({ data: { teste_id: aplicar.teste_id, formula: v as FormulaAgregacao } });
                      toast.success("Fórmula memorizada para este teste");
                      qc.invalidateQueries({ queryKey: ["testes-catalogo"] });
                    } catch (e: any) { toast.error(e.message); }
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMULAS_AGREGACAO.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">A fórmula fica salva no catálogo do teste e será reaplicada em todos os pacientes nas próximas aplicações.</p>
              </div>
            );

            const camposEscoreGlobal = (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Escore bruto</Label><Input type="number" step="0.01" value={aplicar.escore_bruto} onChange={e => setAplicar({ ...aplicar, escore_bruto: e.target.value })} /></div>
                <div><Label>Escore padrão</Label><Input type="number" value={aplicar.escore_padrao} onChange={e => setAplicar({ ...aplicar, escore_padrao: e.target.value })} /></div>
                <div><Label>Percentil</Label><Input type="number" step="0.01" min="0" max="100" value={aplicar.percentil} onChange={e => setAplicar({ ...aplicar, percentil: e.target.value })} /></div>
              </div>
            );

            if (variaveisSchema.length > 0) {
              return (
                <>
                  {editorVariaveis}
                  {formulaAgregacao}
                  <Collapsible open={mostrarEscoreGlobal} onOpenChange={setMostrarEscoreGlobal}>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        {mostrarEscoreGlobal ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Este teste também tem escore global?
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {camposEscoreGlobal}
                      <p className="text-xs text-muted-foreground">Os campos acima são o <b>escore global do teste</b> (quando existe um), separado das variáveis. A classificação do escore global é gerada automaticamente pelo percentil — ou pelo escore-padrão se o percentil estiver vazio.</p>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              );
            }
            return (
              <>
                {camposEscoreGlobal}
                <p className="text-xs text-muted-foreground">Os campos acima são o <b>escore global do teste</b> (quando existe um). A classificação é gerada automaticamente pelo percentil — ou pelo escore-padrão se o percentil estiver vazio. Se o teste só tem variáveis (sem escore total), deixe estes campos em branco e preencha apenas a tabela de variáveis abaixo: cada variável carrega seu próprio bruto/padrão/percentil/classificação.</p>
                {editorVariaveis}
                {formulaAgregacao}
              </>
            );
          })()}

          <div>
            <Label>Observações qualitativas</Label>
            <Textarea rows={3} value={aplicar.observacoes_qualitativas} onChange={e => setAplicar({ ...aplicar, observacoes_qualitativas: e.target.value })} placeholder="Comportamento, atenção sustentada, motivação, estratégias observadas…" />
          </div>
          <div>
            <Label>Interpretação clínica</Label>
            <Textarea rows={3} value={aplicar.interpretacao_clinica} onChange={e => setAplicar({ ...aplicar, interpretacao_clinica: e.target.value })} placeholder="Como esse resultado dialoga com a queixa e as hipóteses?" />
          </div>
          <ImpactosCIFEditor
            value={aplicar.impactos_cif ?? []}
            onChange={(v) => setAplicar({ ...aplicar, impactos_cif: v })}
            sugestoes={testeSelecionado?.cif_dimensoes as any}
            contextoIA={aplicar.teste_id ? {
              teste_nome: testeSelecionado?.nome,
              dominio: testeSelecionado?.dominio?.nome,
              escore_bruto: aplicar.escore_bruto || null,
              escore_padrao: aplicar.escore_padrao || null,
              percentil: aplicar.percentil || null,
              observacoes: aplicar.observacoes_qualitativas || null,
              interpretacao: aplicar.interpretacao_clinica || null,
              idade: calcIdadeAnosMeses(paciente?.data_nascimento, aplicar.data_aplicacao) || null,
              queixa: aval?.queixa || null,
              variaveis: aplicar.variaveis_valores || null,
            } : undefined}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criarAplicado.mutate()} disabled={criarAplicado.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
