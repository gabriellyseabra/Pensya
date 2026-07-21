import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Share2, ListChecks, Wrench, CalendarClock,
  AlertTriangle, Gauge, ClipboardList, ExternalLink, GitBranch, ArrowUpRight, Workflow,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type {
  Processo, ConteudoProcesso, Atividade, PassoItem, Recurso, Rotina, Risco, Metrica, TarefaPendente, Fluxograma, RespPasso,
} from "@/components/processos/types";
import {
  CATEGORIAS, FREQUENCIAS, STATUS_PROCESSO, RESP_PASSO, novoId, progressoProcesso, gerarFluxograma,
} from "@/components/processos/types";
import { CompartilharProcessoDialog } from "@/components/processos/CompartilharProcessoDialog";
import { FluxogramaEditor } from "@/components/processos/FluxogramaEditor";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  component: ProcessoDetailPage,
});

const db = supabase as any;

function ProcessoDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [compartilharOpen, setCompartilharOpen] = useState(false);

  const { data: processo, isLoading } = useQuery({
    queryKey: ["processo", id],
    queryFn: async () => {
      const { data } = await db.from("processos").select("*").eq("id", id).maybeSingle();
      return (data ?? null) as Processo | null;
    },
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => (await db.from("departamentos").select("*").eq("ativo", true).order("ordem")).data ?? [],
  });
  const { data: equipe = [] } = useQuery({
    queryKey: ["profiles-mini"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome").order("nome")).data ?? [],
  });
  const { data: outros = [] } = useQuery({
    queryKey: ["processos-mini"],
    queryFn: async () => (await db.from("processos").select("id, titulo").order("titulo")).data ?? [],
  });

  // ---- Conteúdo (template) com auto-save debounced ----
  const [conteudo, setConteudo] = useState<ConteudoProcesso>({});
  const [hidratado, setHidratado] = useState(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (hidratado || !processo) return;
    setConteudo(processo.conteudo ?? {});
    setHidratado(true);
  }, [processo, hidratado]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      dirty.current = false;
      await db.from("processos").update({ conteudo }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["processos"] });
    }, 800);
    return () => clearTimeout(t);
  }, [conteudo, id, qc]);

  // Auto-gera o fluxograma na primeira vez em que houver passos preenchidos e nenhum fluxo ainda.
  const autoFluxo = useRef(false);
  useEffect(() => {
    if (!hidratado || autoFluxo.current) return;
    const temPassos = (conteudo.atividades ?? []).flatMap((a) => a.itens ?? []).some((i) => i.texto?.trim());
    const temFluxo = (conteudo.fluxograma?.nodes ?? []).length > 0;
    if (temPassos && !temFluxo) {
      autoFluxo.current = true;
      editar((c) => ({ ...c, fluxograma: gerarFluxograma(c.atividades ?? []) }));
    }
  }, [hidratado, conteudo.atividades, conteudo.fluxograma]);

  function editar(fn: (c: ConteudoProcesso) => ConteudoProcesso) {
    setConteudo((prev) => { dirty.current = true; return fn(prev); });
  }

  // ---- Campos escalares: salvam na hora ----
  async function patch(campo: Partial<Processo>) {
    const { error } = await db.from("processos").update(campo).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["processo", id] });
    qc.invalidateQueries({ queryKey: ["processos"] });
  }

  async function excluirProcesso() {
    if (!confirm("Excluir este processo?")) return;
    const { error } = await db.from("processos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Processo excluído");
    navigate({ to: "/processos" });
  }

  if (isLoading) return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!processo) return (
    <div className="py-16 text-center space-y-3">
      <p className="text-sm text-muted-foreground">Processo não encontrado ou sem acesso.</p>
      <Button asChild variant="outline" size="sm"><Link to="/processos"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Link></Button>
    </div>
  );

  const st = STATUS_PROCESSO.find((s) => s.value === processo.status);
  const dep = departamentos.find((d: any) => d.id === processo.departamento_id);
  const prog = progressoProcesso(conteudo);
  const subitens = (outros as any[]).filter((o) => o.id !== id); // p/ escolher pai
  const paiNome = processo.parent_id ? (outros as any[]).find((o) => o.id === processo.parent_id)?.titulo : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm"><Link to="/processos"><ArrowLeft className="w-4 h-4 mr-1" />Processos</Link></Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCompartilharOpen(true)}><Share2 className="w-4 h-4 mr-1" />Compartilhar</Button>
          <Button size="sm" variant="ghost" onClick={excluirProcesso}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      </div>

      {/* Cabeçalho */}
      <Card className="glass">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <Input
              defaultValue={processo.emoji ?? ""} maxLength={2}
              onBlur={(e) => e.target.value !== (processo.emoji ?? "") && patch({ emoji: e.target.value || null })}
              className="w-14 h-12 text-center text-2xl shrink-0"
              placeholder="⚙️"
            />
            <div className="flex-1 min-w-0">
              <Input
                defaultValue={processo.titulo}
                onBlur={(e) => e.target.value.trim() && e.target.value !== processo.titulo && patch({ titulo: e.target.value.trim() })}
                className="text-xl font-semibold border-0 px-0 shadow-none focus-visible:ring-0 h-auto"
              />
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {dep && <Badge style={{ backgroundColor: `${dep.cor}22`, color: dep.cor }}>{dep.nome}</Badge>}
                {st && <Badge className={st.cor}>{st.label}</Badge>}
                {paiNome && <Badge variant="outline" className="gap-1"><GitBranch className="w-3 h-3" />{paiNome}</Badge>}
              </div>
            </div>
          </div>
          {prog.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progresso do passo a passo</span><span>{prog.pct}%</span></div>
              <Progress value={prog.pct} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Seções (template) */}
        <div className="space-y-4 order-2 lg:order-1 min-w-0">
          <SecaoCard titulo="Passo a passo (atividades)" icon={<ListChecks className="w-4 h-4 text-brand" />}>
            <AtividadesEditor atividades={conteudo.atividades ?? []} onChange={(atividades) => editar((c) => ({ ...c, atividades }))} />
          </SecaoCard>

          <SecaoCard titulo="Fluxograma" icon={<Workflow className="w-4 h-4 text-brand" />}>
            <FluxogramaEditor
              atividades={conteudo.atividades ?? []}
              fluxograma={conteudo.fluxograma}
              onChange={(fluxograma: Fluxograma) => editar((c) => ({ ...c, fluxograma }))}
            />
          </SecaoCard>

          <SecaoCard titulo="Recursos (ferramentas e documentos)" icon={<Wrench className="w-4 h-4 text-brand" />}>
            <RecursosEditor recursos={conteudo.recursos ?? []} onChange={(recursos) => editar((c) => ({ ...c, recursos }))} />
          </SecaoCard>

          <SecaoCard titulo="Rotinas e prazos" icon={<CalendarClock className="w-4 h-4 text-brand" />}>
            <ListaTextoEditor itens={conteudo.rotinas ?? []} onChange={(rotinas) => editar((c) => ({ ...c, rotinas }))} placeholder="Ex.: Revisar mensalmente até o dia 5" />
          </SecaoCard>

          <SecaoCard titulo="Pontos críticos e contingências" icon={<AlertTriangle className="w-4 h-4 text-brand" />}>
            <RiscosEditor riscos={conteudo.riscos ?? []} onChange={(riscos) => editar((c) => ({ ...c, riscos }))} />
          </SecaoCard>

          <SecaoCard titulo="Ações em caso de desvio" icon={<AlertTriangle className="w-4 h-4 text-brand" />}>
            <ListaTextoEditor itens={conteudo.acoes ?? []} onChange={(acoes) => editar((c) => ({ ...c, acoes }))} placeholder="Ação corretiva…" />
          </SecaoCard>

          <SecaoCard titulo="Métricas e indicadores" icon={<Gauge className="w-4 h-4 text-brand" />}>
            <MetricasEditor metricas={conteudo.metricas ?? []} onChange={(metricas) => editar((c) => ({ ...c, metricas }))} />
          </SecaoCard>

          <SecaoCard titulo="Tarefas pendentes" icon={<ClipboardList className="w-4 h-4 text-brand" />}>
            <TarefasPendentesEditor
              processo={processo}
              itens={conteudo.tarefas_pendentes ?? []}
              onChange={(tarefas_pendentes) => editar((c) => ({ ...c, tarefas_pendentes }))}
            />
          </SecaoCard>
        </div>

        {/* Propriedades (auto-save imediato) */}
        <div className="space-y-3 order-1 lg:order-2">
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Propriedades</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Prop label="Departamento">
                <Select value={processo.departamento_id ?? ""} onValueChange={(v) => patch({ departamento_id: v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{departamentos.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Prop>
              <Prop label="Responsável">
                <Select value={processo.responsavel_id ?? ""} onValueChange={(v) => patch({ responsavel_id: v || null })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{equipe.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome ?? "—"}</SelectItem>)}</SelectContent>
                </Select>
              </Prop>
              <Prop label="Status">
                <Select value={processo.status} onValueChange={(v) => patch({ status: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_PROCESSO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Prop>
              <Prop label="Categoria">
                <Select value={processo.categoria ?? ""} onValueChange={(v) => patch({ categoria: v || null })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Prop>
              <Prop label="Frequência">
                <Select value={processo.frequencia ?? ""} onValueChange={(v) => patch({ frequencia: v || null })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{FREQUENCIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Prop>
              <Prop label="Processo pai">
                <Select value={processo.parent_id ?? "__none"} onValueChange={(v) => patch({ parent_id: v === "__none" ? null : v })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhum (processo raiz)</SelectItem>
                    {subitens.map((o) => <SelectItem key={o.id} value={o.id}>{o.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Prop>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Objetivo (por quê)</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                defaultValue={processo.objetivo ?? ""}
                onBlur={(e) => e.target.value !== (processo.objetivo ?? "") && patch({ objetivo: e.target.value || null })}
                placeholder="Para que este processo existe e qual resultado ele garante."
                className="min-h-[90px] text-sm"
              />
            </CardContent>
          </Card>

          <SubprocessosCard processoId={id} outros={outros as any[]} onCreated={() => qc.invalidateQueries({ queryKey: ["processos-mini"] })} />
        </div>
      </div>

      <CompartilharProcessoDialog
        open={compartilharOpen} onOpenChange={setCompartilharOpen}
        processo={processo} equipe={equipe as any}
        onChanged={() => qc.invalidateQueries({ queryKey: ["processo", id] })}
      />
    </div>
  );
}

/* ---------------- helpers de layout ---------------- */
function SecaoCard({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  const key = `proc:sec:${titulo}`;
  const [aberto, setAberto] = useState(() => (typeof window === "undefined" ? true : localStorage.getItem(key) !== "0"));
  const toggle = () => setAberto((v) => {
    const novo = !v;
    if (typeof window !== "undefined") localStorage.setItem(key, novo ? "1" : "0");
    return novo;
  });
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <button type="button" onClick={toggle} className="w-full flex items-center gap-2 text-left group">
          {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <CardTitle className="text-sm flex items-center gap-2 flex-1 group-hover:text-foreground">{icon}{titulo}</CardTitle>
        </button>
      </CardHeader>
      {aberto && <CardContent>{children}</CardContent>}
    </Card>
  );
}
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ---------------- Atividades / passo a passo ---------------- */
function RespBtn({ value, onChange }: { value?: RespPasso; onChange: (v?: RespPasso) => void }) {
  const meta = RESP_PASSO.find((r) => r.value === value);
  const ciclo: (RespPasso | undefined)[] = [undefined, "gabi", "luciana", "ambas"];
  const proximo = () => onChange(ciclo[(ciclo.indexOf(value) + 1) % ciclo.length]);
  return (
    <button type="button" onClick={proximo} title={meta ? `Responsável: ${meta.label} (clique para alterar)` : "Definir responsável"}
      className="h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-[9px] font-bold"
      style={meta ? { backgroundColor: meta.cor, color: "#fff", borderColor: meta.cor } : { color: "#94a3b8" }}>
      {meta ? meta.curto : "·"}
    </button>
  );
}

function AtividadesEditor({ atividades, onChange }: { atividades: Atividade[]; onChange: (a: Atividade[]) => void }) {
  const set = (i: number, patch: Partial<Atividade>) => onChange(atividades.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const setItem = (i: number, a: Atividade, j: number, patch: Partial<PassoItem>) =>
    set(i, { itens: a.itens.map((x, jj) => jj === j ? { ...x, ...patch } : x) });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        <span>Responsável:</span>
        {RESP_PASSO.map((r) => (
          <span key={r.value} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.cor }} />{r.label}</span>
        ))}
        <span className="text-muted-foreground/70">· clique na bolinha para atribuir</span>
      </div>
      {atividades.map((a, i) => (
        <div key={a.id} className={`rounded-lg border p-2.5 space-y-2 ${a.gargalo ? "border-amber-400 bg-amber-50/60 dark:bg-amber-500/10" : ""}`}>
          <div className="flex items-center gap-2">
            <RespBtn value={a.resp} onChange={(v) => set(i, { resp: v })} />
            <Input value={a.titulo} onChange={(e) => set(i, { titulo: e.target.value })} placeholder="Nome da etapa" className="h-8 font-medium" />
            <Button size="icon" variant="ghost" className={`h-7 w-7 shrink-0 ${a.gargalo ? "text-amber-600" : "text-muted-foreground"}`} title="Marcar gargalo" onClick={() => set(i, { gargalo: !a.gargalo })}><AlertTriangle className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(atividades.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
          {a.gargalo && (
            <Input value={a.obs ?? ""} onChange={(e) => set(i, { obs: e.target.value })} placeholder="Observação do gargalo…" className="h-7 text-xs bg-amber-100/50 border-amber-300" />
          )}
          <div className="space-y-1.5 pl-1">
            {(a.itens ?? []).map((it, j) => (
              <div key={it.id} className={`rounded ${it.gargalo ? "bg-amber-100/60 dark:bg-amber-500/10 -mx-1 px-1.5 py-1" : ""}`}>
                <div className="flex items-center gap-2">
                  <Checkbox checked={it.feito} onCheckedChange={(v) => setItem(i, a, j, { feito: !!v })} />
                  <RespBtn value={it.resp} onChange={(v) => setItem(i, a, j, { resp: v })} />
                  <Input value={it.texto} onChange={(e) => setItem(i, a, j, { texto: e.target.value })} placeholder="Passo" className={`h-7 text-sm ${it.feito ? "line-through text-muted-foreground" : ""} ${it.gargalo ? "text-amber-800 dark:text-amber-300 font-medium" : ""}`} />
                  <Button size="icon" variant="ghost" className={`h-6 w-6 shrink-0 ${it.gargalo ? "text-amber-600" : "text-muted-foreground/60"}`} title="Marcar gargalo" onClick={() => setItem(i, a, j, { gargalo: !it.gargalo })}><AlertTriangle className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => set(i, { itens: a.itens.filter((_, jj) => jj !== j) })}><Trash2 className="w-3 h-3 text-muted-foreground" /></Button>
                </div>
                {it.gargalo && (
                  <Input value={it.obs ?? ""} onChange={(e) => setItem(i, a, j, { obs: e.target.value })} placeholder="Observação do gargalo…" className="mt-1 ml-6 h-7 text-xs bg-amber-100/50 border-amber-300" />
                )}
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => set(i, { itens: [...(a.itens ?? []), { id: novoId(), texto: "", feito: false }] })}><Plus className="w-3 h-3 mr-1" />Passo</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...atividades, { id: novoId(), titulo: "", itens: [] }])}><Plus className="w-4 h-4 mr-1" />Etapa</Button>
    </div>
  );
}

/* ---------------- Recursos ---------------- */
function RecursosEditor({ recursos, onChange }: { recursos: Recurso[]; onChange: (r: Recurso[]) => void }) {
  const set = (i: number, patch: Partial<Recurso>) => onChange(recursos.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-2">
      {recursos.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2">
          <Select value={r.tipo} onValueChange={(v) => set(i, { tipo: v as any })}>
            <SelectTrigger className="h-8 w-32 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ferramenta">Ferramenta</SelectItem><SelectItem value="documento">Documento</SelectItem></SelectContent>
          </Select>
          <Input value={r.nome} onChange={(e) => set(i, { nome: e.target.value })} placeholder="Nome" className="h-8" />
          <Input value={r.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://…" className="h-8" />
          {r.url && <Button asChild size="icon" variant="ghost" className="h-7 w-7 shrink-0"><a href={r.url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a></Button>}
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(recursos.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...recursos, { id: novoId(), nome: "", url: "", tipo: "ferramenta" }])}><Plus className="w-4 h-4 mr-1" />Recurso</Button>
    </div>
  );
}

/* ---------------- Lista de texto (rotinas) ---------------- */
function ListaTextoEditor({ itens, onChange, placeholder }: { itens: Rotina[]; onChange: (r: Rotina[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      {itens.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2">
          <Input value={it.texto} onChange={(e) => onChange(itens.map((x, idx) => idx === i ? { ...x, texto: e.target.value } : x))} placeholder={placeholder} className="h-8" />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(itens.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...itens, { id: novoId(), texto: "" }])}><Plus className="w-4 h-4 mr-1" />Item</Button>
    </div>
  );
}

/* ---------------- Riscos ---------------- */
function RiscosEditor({ riscos, onChange }: { riscos: Risco[]; onChange: (r: Risco[]) => void }) {
  const set = (i: number, patch: Partial<Risco>) => onChange(riscos.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  return (
    <div className="space-y-2">
      {riscos.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] text-muted-foreground px-1">
          <span>Ponto crítico</span><span>Ação de contingência</span><span />
        </div>
      )}
      {riscos.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Textarea value={r.ponto_critico} onChange={(e) => set(i, { ponto_critico: e.target.value })} placeholder="Risco / gargalo" className="min-h-[40px] text-sm" />
          <Textarea value={r.acao} onChange={(e) => set(i, { acao: e.target.value })} placeholder="O que fazer se ocorrer" className="min-h-[40px] text-sm" />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(riscos.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...riscos, { id: novoId(), ponto_critico: "", acao: "" }])}><Plus className="w-4 h-4 mr-1" />Risco</Button>
    </div>
  );
}

/* ---------------- Métricas (KPI cards) ---------------- */
function MetricasEditor({ metricas, onChange }: { metricas: Metrica[]; onChange: (m: Metrica[]) => void }) {
  const set = (i: number, patch: Partial<Metrica>) => onChange(metricas.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {metricas.map((m, i) => (
          <div key={m.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Input value={m.indicador} onChange={(e) => set(i, { indicador: e.target.value })} placeholder="Indicador (o que medir)" className="h-8 font-medium" />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(metricas.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
            <div className="flex items-end gap-2">
              <Input value={m.valor_atual ?? ""} onChange={(e) => set(i, { valor_atual: e.target.value })} placeholder="Valor" className="h-9 text-2xl font-semibold w-24" />
              <Input value={m.unidade ?? ""} onChange={(e) => set(i, { unidade: e.target.value })} placeholder="un." className="h-8 w-16" />
            </div>
            <Input value={m.objetivo} onChange={(e) => set(i, { objetivo: e.target.value })} placeholder="Meta / objetivo do indicador" className="h-8 text-xs" />
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange([...metricas, { id: novoId(), indicador: "", objetivo: "", valor_atual: "", unidade: "" }])}><Plus className="w-4 h-4 mr-1" />Indicador</Button>
    </div>
  );
}

/* ---------------- Tarefas pendentes (+ envio p/ módulo Tarefas) ---------------- */
function TarefasPendentesEditor({ processo, itens, onChange }: { processo: Processo; itens: TarefaPendente[]; onChange: (t: TarefaPendente[]) => void }) {
  const set = (i: number, patch: Partial<TarefaPendente>) => onChange(itens.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  async function enviarParaTarefas(i: number) {
    const it = itens[i];
    if (!it.texto.trim()) { toast.error("Descreva a tarefa antes de enviar"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("tarefas").insert({
        titulo: it.texto.trim(),
        processo_id: processo.id,
        responsavel_id: processo.responsavel_id ?? null,
        criador_id: user?.id,
      }).select("id").single();
      if (error) throw error;
      set(i, { tarefa_id: data.id });
      toast.success("Enviada para Tarefas");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  return (
    <div className="space-y-2">
      {itens.map((t, i) => (
        <div key={t.id} className="flex items-center gap-2">
          <Checkbox checked={t.feito} onCheckedChange={(v) => set(i, { feito: !!v })} />
          <Input value={t.texto} onChange={(e) => set(i, { texto: e.target.value })} placeholder="Tarefa a estruturar" className={`h-8 text-sm ${t.feito ? "line-through text-muted-foreground" : ""}`} />
          {t.tarefa_id ? (
            <Badge variant="secondary" className="text-[10px] shrink-0 gap-1"><ArrowUpRight className="w-3 h-3" />No módulo</Badge>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => enviarParaTarefas(i)}><ArrowUpRight className="w-3.5 h-3.5 mr-1" />Tarefas</Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onChange(itens.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...itens, { id: novoId(), texto: "", feito: false }])}><Plus className="w-4 h-4 mr-1" />Tarefa</Button>
    </div>
  );
}

/* ---------------- Subprocessos (filhos) ---------------- */
function SubprocessosCard({ processoId, outros }: { processoId: string; outros: { id: string; titulo: string }[]; onCreated: () => void }) {
  // lista os filhos consultando a lista completa não é possível aqui (só id/titulo);
  // mostramos um atalho para o board filtrado. Mantido simples nesta versão.
  return (
    <Card className="glass">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-brand" />Subprocessos</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Para tornar um processo um subitem deste, abra-o e defina este como <strong>Processo pai</strong>.
        </p>
      </CardContent>
    </Card>
  );
}
