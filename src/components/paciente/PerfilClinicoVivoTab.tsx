import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Heart, AlertTriangle, Sparkles, ThumbsUp, ThumbsDown, Users, School,
  Save, Plus, X, Target, Stethoscope, CheckCircle2, Circle, MessageSquare,
} from "lucide-react";
import { usePerfilVivo, type PerfilVivo } from "@/hooks/use-perfil-vivo";
import { useAnamnese } from "@/hooks/use-anamnese";
import { gerarSugestoesPerfilVivo } from "@/lib/perfil-vivo-prefill";

export function PerfilClinicoVivoTab({ pacienteId }: { pacienteId: string }) {
  const { perfil, save } = usePerfilVivo(pacienteId);
  const { anamnese } = useAnamnese(pacienteId);
  const [pv, setPv] = useState<PerfilVivo>({});

  // Ao carregar, aplica migrações suaves (persistidas ao salvar):
  //  • Preferências → Interesses  • Potencializadores → Reforçadores
  //  • Observações por contexto → Observações gerais (campo único)
  useEffect(() => {
    const next: PerfilVivo = { ...perfil };

    if (next.preferencias?.length) {
      const merged = [...(next.interesses ?? [])];
      next.preferencias.forEach((p) => { if (p && !merged.includes(p)) merged.push(p); });
      next.interesses = merged;
      next.preferencias = [];
    }

    if (next.potencializadores?.length) {
      const merged = [...(next.reforcadores ?? [])];
      next.potencializadores.forEach((p) => { if (p && !merged.some((r) => r.descricao === p)) merged.push({ descricao: p }); });
      next.reforcadores = merged;
      next.potencializadores = [];
    }

    const obs = [
      next.contexto_social?.observacoes,
      next.contexto_clinico?.observacoes,
      next.contexto_escolar_detalhes?.observacoes,
    ].filter((s): s is string => !!s && !!s.trim());
    if (obs.length) {
      next.observacoes_gerais = [next.observacoes_gerais, ...obs].filter((s) => s && s.trim()).join("\n");
      if (next.contexto_social) next.contexto_social = { ...next.contexto_social, observacoes: undefined };
      if (next.contexto_clinico) next.contexto_clinico = { ...next.contexto_clinico, observacoes: undefined };
      if (next.contexto_escolar_detalhes) next.contexto_escolar_detalhes = { ...next.contexto_escolar_detalhes, observacoes: undefined };
    }

    setPv(next);
  }, [perfil]);

  const { sugestoes } = useMemo(
    () => gerarSugestoesPerfilVivo(anamnese.secoes_estruturadas ?? {}),
    [anamnese.secoes_estruturadas]
  );

  const preencherTudo = () => {
    let preenchidos = 0;
    const next: PerfilVivo = { ...pv };
    (["contexto_social", "contexto_clinico", "contexto_escolar_detalhes"] as const).forEach((bloco) => {
      const sug = sugestoes[bloco];
      if (!sug) return;
      const atual = { ...(next[bloco] ?? {}) } as Record<string, string | undefined>;
      Object.entries(sug).forEach(([campo, texto]) => {
        if (campo === "observacoes") return; // observações agora são um campo único
        if (texto && !atual[campo]) { atual[campo] = texto as string; preenchidos++; }
      });
      next[bloco] = atual as any;
    });
    if (!next.interesses?.length && sugestoes.interesses?.length) { next.interesses = sugestoes.interesses; preenchidos++; }
    if (!next.reforcadores?.length && sugestoes.reforcadores?.length) { next.reforcadores = sugestoes.reforcadores; preenchidos++; }
    setPv(next);
    toast.success(preenchidos > 0 ? `${preenchidos} campo(s) preenchidos a partir da Anamnese — revise e salve.` : "Nenhum campo novo para preencher.");
  };

  const temSugestaoPendente =
    Object.entries(sugestoes.contexto_social ?? {}).some(([k, v]) => k !== "observacoes" && v && !(pv.contexto_social as any)?.[k]) ||
    Object.entries(sugestoes.contexto_clinico ?? {}).some(([k, v]) => k !== "observacoes" && v && !(pv.contexto_clinico as any)?.[k]) ||
    Object.entries(sugestoes.contexto_escolar_detalhes ?? {}).some(([k, v]) => k !== "observacoes" && v && !(pv.contexto_escolar_detalhes as any)?.[k]) ||
    (!pv.interesses?.length && !!sugestoes.interesses?.length) ||
    (!pv.reforcadores?.length && !!sugestoes.reforcadores?.length);

  // Estado de preenchimento por seção (para o indicador de progresso).
  const ctxCheio = (o?: Record<string, string | undefined>) =>
    !!o && Object.entries(o).some(([k, v]) => k !== "observacoes" && !!v && !!String(v).trim());
  const secoes = [
    { id: "motivacao", cheio: !!(pv.reforcadores?.length || pv.barreiras?.length) },
    { id: "interesses", cheio: !!pv.interesses?.length },
    { id: "estrategias", cheio: !!(pv.hipoteses_ativas?.length || pv.estrategias_funcionam?.length || pv.estrategias_nao_funcionam?.length || pv.objetivos_generalizacao?.length) },
    { id: "social", cheio: ctxCheio(pv.contexto_social) },
    { id: "clinico", cheio: ctxCheio(pv.contexto_clinico) },
    { id: "escolar", cheio: ctxCheio(pv.contexto_escolar_detalhes) },
    { id: "observacoes", cheio: !!pv.observacoes_gerais?.trim() },
  ];
  const totalPreenchidas = secoes.filter((s) => s.cheio).length;
  const cheioDe = (id: string) => secoes.find((s) => s.id === id)?.cheio ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-lilac text-lilac-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-display leading-none tracking-tight">Perfil Clínico Vivo</h2>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Fonte única de verdade do paciente. Preencha aos poucos — abra só a seção que precisa.
              {pv.atualizado_em && ` · Atualizado em ${new Date(pv.atualizado_em).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {temSugestaoPendente && (
            <Button variant="secondary" onClick={preencherTudo}>
              <Sparkles className="w-4 h-4 mr-2" />Preencher a partir da Anamnese
            </Button>
          )}
          <Button onClick={() => save.mutate(pv)} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-2" />{save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Progresso */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso do perfil</span>
            <span className="font-medium text-foreground">{totalPreenchidas} de {secoes.length} seções</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full gradient-brand transition-all" style={{ width: `${(totalPreenchidas / secoes.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {/* 1. Motivação e engajamento */}
        <SectionItem value="motivacao" title="Motivação e engajamento" icon={<Heart className="h-4 w-4 text-emerald-600" />} filled={cheioDe("motivacao")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListEditor
              icon={<Heart className="w-4 h-4 text-emerald-600" />}
              title="Reforçadores"
              subtitle="O que motiva, engaja ou acalma"
              items={pv.reforcadores ?? []}
              onChange={(items) => setPv({ ...pv, reforcadores: items as any })}
              withIntensidade
              placeholder="Ex: música, elogio verbal, brinquedos específicos…"
              suggestion={sugestoes.reforcadores}
              onApplySuggestion={() => setPv({ ...pv, reforcadores: sugestoes.reforcadores as any })}
            />
            <ListEditor
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              title="Barreiras"
              subtitle="O que dificulta engajamento ou progresso"
              items={pv.barreiras ?? []}
              onChange={(items) => setPv({ ...pv, barreiras: items as any })}
              placeholder="Ex: ruído alto, transições, frustração com erros…"
            />
          </div>
        </SectionItem>

        {/* 2. Interesses e preferências (fundidos) */}
        <SectionItem value="interesses" title="Interesses e preferências" icon={<Sparkles className="h-4 w-4 text-violet-600" />} filled={cheioDe("interesses")}>
          <StringListCard
            icon={<Sparkles className="w-4 h-4 text-violet-600" />}
            title="Interesses e preferências"
            values={pv.interesses ?? []}
            onChange={(v) => setPv({ ...pv, interesses: v })}
            placeholder="Ex: dinossauros, futebol, trabalhar com música, sem público…"
            suggestion={sugestoes.interesses}
            onApplySuggestion={() => setPv({ ...pv, interesses: sugestoes.interesses ?? [] })}
          />
        </SectionItem>

        {/* 3. Hipóteses e estratégias */}
        <SectionItem value="estrategias" title="Hipóteses e estratégias" icon={<Target className="h-4 w-4 text-brand" />} filled={cheioDe("estrategias")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <StringListCard
              icon={<Target className="w-4 h-4 text-brand" />}
              title="Hipóteses ativas"
              values={pv.hipoteses_ativas ?? []}
              onChange={(v) => setPv({ ...pv, hipoteses_ativas: v })}
              placeholder="Ex: TDAH, dislexia, transtorno de linguagem…"
            />
            <StringListCard
              icon={<Target className="w-4 h-4 text-emerald-600" />}
              title="Objetivos de generalização"
              values={pv.objetivos_generalizacao ?? []}
              onChange={(v) => setPv({ ...pv, objetivos_generalizacao: v })}
              placeholder="Ex: aplicar estratégia na sala de aula, em casa…"
            />
            <StringListCard
              icon={<ThumbsUp className="w-4 h-4 text-emerald-600" />}
              title="Estratégias que funcionam"
              values={pv.estrategias_funcionam ?? []}
              onChange={(v) => setPv({ ...pv, estrategias_funcionam: v })}
              placeholder="Ex: dividir tarefa em passos, timer visual…"
            />
            <StringListCard
              icon={<ThumbsDown className="w-4 h-4 text-rose-600" />}
              title="Estratégias que NÃO funcionam"
              values={pv.estrategias_nao_funcionam ?? []}
              onChange={(v) => setPv({ ...pv, estrategias_nao_funcionam: v })}
              placeholder="Ex: instrução muito longa, ambientes muito estimulantes…"
            />
          </div>
        </SectionItem>

        {/* 4. Contexto social e familiar */}
        <SectionItem value="social" title="Contexto social e familiar" icon={<Users className="h-4 w-4 text-brand" />} filled={cheioDe("social")}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Rotina típica" value={pv.contexto_social?.rotina ?? ""} onChange={(v) => setPv({ ...pv, contexto_social: { ...pv.contexto_social, rotina: v } })} multiline
              suggestion={sugestoes.contexto_social?.rotina} onApplySuggestion={() => setPv({ ...pv, contexto_social: { ...pv.contexto_social, rotina: sugestoes.contexto_social?.rotina ?? "" } })} />
            <Field label="Suporte familiar" value={pv.contexto_social?.suporte_familiar ?? ""} onChange={(v) => setPv({ ...pv, contexto_social: { ...pv.contexto_social, suporte_familiar: v } })} multiline
              suggestion={sugestoes.contexto_social?.suporte_familiar} onApplySuggestion={() => setPv({ ...pv, contexto_social: { ...pv.contexto_social, suporte_familiar: sugestoes.contexto_social?.suporte_familiar ?? "" } })} />
            <Field label="Ambiente social" value={pv.contexto_social?.ambiente_social ?? ""} onChange={(v) => setPv({ ...pv, contexto_social: { ...pv.contexto_social, ambiente_social: v } })} multiline className="md:col-span-2"
              suggestion={sugestoes.contexto_social?.ambiente_social} onApplySuggestion={() => setPv({ ...pv, contexto_social: { ...pv.contexto_social, ambiente_social: sugestoes.contexto_social?.ambiente_social ?? "" } })} />
          </div>
        </SectionItem>

        {/* 5. Contexto clínico */}
        <SectionItem value="clinico" title="Contexto clínico" icon={<Stethoscope className="h-4 w-4 text-brand" />} filled={cheioDe("clinico")}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Medicações em uso" value={pv.contexto_clinico?.medicacoes ?? ""} onChange={(v) => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, medicacoes: v } })} multiline
              suggestion={sugestoes.contexto_clinico?.medicacoes} onApplySuggestion={() => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, medicacoes: sugestoes.contexto_clinico?.medicacoes ?? "" } })} />
            <Field label="Comorbidades" value={pv.contexto_clinico?.comorbidades ?? ""} onChange={(v) => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, comorbidades: v } })} multiline
              suggestion={sugestoes.contexto_clinico?.comorbidades} onApplySuggestion={() => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, comorbidades: sugestoes.contexto_clinico?.comorbidades ?? "" } })} />
            <Field label="Outros profissionais envolvidos" value={pv.contexto_clinico?.profissionais ?? ""} onChange={(v) => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, profissionais: v } })} multiline className="md:col-span-2"
              suggestion={sugestoes.contexto_clinico?.profissionais} onApplySuggestion={() => setPv({ ...pv, contexto_clinico: { ...pv.contexto_clinico, profissionais: sugestoes.contexto_clinico?.profissionais ?? "" } })} />
          </div>
        </SectionItem>

        {/* 6. Contexto escolar */}
        <SectionItem value="escolar" title="Contexto escolar" icon={<School className="h-4 w-4 text-brand" />} filled={cheioDe("escolar")}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Ambiente escolar" value={pv.contexto_escolar_detalhes?.ambiente ?? ""} onChange={(v) => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, ambiente: v } })} multiline
              suggestion={sugestoes.contexto_escolar_detalhes?.ambiente} onApplySuggestion={() => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, ambiente: sugestoes.contexto_escolar_detalhes?.ambiente ?? "" } })} />
            <Field label="Suporte pedagógico" value={pv.contexto_escolar_detalhes?.suporte_pedagogico ?? ""} onChange={(v) => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, suporte_pedagogico: v } })} multiline
              suggestion={sugestoes.contexto_escolar_detalhes?.suporte_pedagogico} onApplySuggestion={() => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, suporte_pedagogico: sugestoes.contexto_escolar_detalhes?.suporte_pedagogico ?? "" } })} />
            <Field label="Dificuldades observadas" value={pv.contexto_escolar_detalhes?.dificuldades ?? ""} onChange={(v) => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, dificuldades: v } })} multiline className="md:col-span-2"
              suggestion={sugestoes.contexto_escolar_detalhes?.dificuldades} onApplySuggestion={() => setPv({ ...pv, contexto_escolar_detalhes: { ...pv.contexto_escolar_detalhes, dificuldades: sugestoes.contexto_escolar_detalhes?.dificuldades ?? "" } })} />
          </div>
        </SectionItem>

        {/* 7. Observações gerais (campo único) */}
        <SectionItem value="observacoes" title="Observações gerais" icon={<MessageSquare className="h-4 w-4 text-brand" />} filled={cheioDe("observacoes")}>
          <Field
            label="Anotações livres sobre o paciente"
            value={pv.observacoes_gerais ?? ""}
            onChange={(v) => setPv({ ...pv, observacoes_gerais: v })}
            multiline
          />
        </SectionItem>
      </Accordion>

      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        O <strong>Perfil CIF</strong> é mantido na aba <em>Plano Terapêutico</em> e usado para gerar o raciocínio clínico — sem duplicidade aqui.
        As <strong>fotos e vídeos</strong> do paciente ficam agora na aba <em>Arquivos → Galeria</em>.
      </div>
    </div>
  );
}

function SectionItem({
  value, title, icon, filled, children,
}: {
  value: string; title: string; icon: React.ReactNode; filled: boolean; children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-xl border border-border/60 bg-card px-0">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <span className="flex flex-1 items-center gap-3 text-left">
          <IconChip>{icon}</IconChip>
          <span className="text-sm font-semibold">{title}</span>
          {filled ? (
            <CheckCircle2 className="ml-auto mr-2 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="ml-auto mr-2 h-4 w-4 shrink-0 text-muted-foreground/40" />
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/70">
      {children}
    </span>
  );
}

function Field({
  label, value, onChange, multiline, className, suggestion, onApplySuggestion,
}: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; className?: string;
  suggestion?: string; onApplySuggestion?: () => void;
}) {
  const mostrarSugestao = !value && !!suggestion;
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {mostrarSugestao && (
          <button
            type="button"
            onClick={onApplySuggestion}
            title={suggestion}
            className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand hover:bg-brand/20"
          >
            <Sparkles className="h-2.5 w-2.5" /> Sugerido pela Anamnese
          </button>
        )}
      </div>
      {multiline ? <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <Input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

type Item = { descricao: string; intensidade?: "baixa" | "media" | "alta" };
function ListEditor({
  icon, title, subtitle, items, onChange, withIntensidade, placeholder, suggestion, onApplySuggestion,
}: {
  icon: React.ReactNode; title: string; subtitle?: string; items: Item[];
  onChange: (v: Item[]) => void; withIntensidade?: boolean; placeholder?: string;
  suggestion?: Item[]; onApplySuggestion?: () => void;
}) {
  const [nova, setNova] = useState("");
  const mostrarSugestao = items.length === 0 && !!suggestion?.length;
  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}{title}
        </div>
        {mostrarSugestao && (
          <button
            type="button"
            onClick={onApplySuggestion}
            className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand hover:bg-brand/20"
          >
            <Sparkles className="h-2.5 w-2.5" /> Sugerido pela Anamnese
          </button>
        )}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div className="flex gap-2">
        <Input value={nova} onChange={(e) => setNova(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && nova.trim()) { onChange([...items, { descricao: nova.trim(), ...(withIntensidade ? { intensidade: "media" as const } : {}) }]); setNova(""); } }}
        />
        <Button type="button" variant="secondary" onClick={() => { if (nova.trim()) { onChange([...items, { descricao: nova.trim(), ...(withIntensidade ? { intensidade: "media" as const } : {}) }]); setNova(""); } }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum item.</p>}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/60 p-2">
            <Input value={it.descricao} onChange={(e) => { const next = [...items]; next[i] = { ...next[i], descricao: e.target.value }; onChange(next); }} className="flex-1" />
            {withIntensidade && (
              <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={it.intensidade ?? "media"}
                onChange={(e) => { const next = [...items]; next[i] = { ...next[i], intensidade: e.target.value as Item["intensidade"] }; onChange(next); }}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            )}
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="w-4 h-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StringListCard({
  icon, title, values, onChange, placeholder, suggestion, onApplySuggestion,
}: {
  icon: React.ReactNode; title: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
  suggestion?: string[]; onApplySuggestion?: () => void;
}) {
  const [nova, setNova] = useState("");
  const mostrarSugestao = values.length === 0 && !!suggestion?.length;
  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}{title}
        </div>
        {mostrarSugestao && (
          <button
            type="button"
            onClick={onApplySuggestion}
            className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand hover:bg-brand/20"
          >
            <Sparkles className="h-2.5 w-2.5" /> Sugerido pela Anamnese
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Input value={nova} onChange={(e) => setNova(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && nova.trim()) { onChange([...values, nova.trim()]); setNova(""); } }}
        />
        <Button type="button" variant="secondary" onClick={() => { if (nova.trim()) { onChange([...values, nova.trim()]); setNova(""); } }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum item.</p>}
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
