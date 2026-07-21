// Tipos locais do módulo de Processos (POPs).
// As tabelas novas ainda não estão em src/integrations/supabase/types.ts,
// então as queries usam `as any` e tipamos o retorno aqui.

export type Visibilidade = "equipe" | "restrito" | "publico";
export type StatusProcesso = "rascunho" | "ativo" | "em_revisao" | "arquivado";

export interface Departamento {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

export type RespPasso = "gabi" | "luciana" | "ambas";
export const RESP_PASSO: { value: RespPasso; label: string; cor: string; curto: string }[] = [
  { value: "gabi", label: "Gabrielly", cor: "#3b82f6", curto: "G" },
  { value: "luciana", label: "Luciana", cor: "#8b5cf6", curto: "L" },
  { value: "ambas", label: "Ambas", cor: "#14b8a6", curto: "A" },
];

export interface PassoItem { id: string; texto: string; feito: boolean; gargalo?: boolean; obs?: string; resp?: RespPasso }
export interface Atividade { id: string; titulo: string; itens: PassoItem[]; gargalo?: boolean; obs?: string; resp?: RespPasso }
export interface Recurso { id: string; nome: string; url: string; tipo: "ferramenta" | "documento" }
export interface Rotina { id: string; texto: string }
export interface Risco { id: string; ponto_critico: string; acao: string }
export interface Metrica { id: string; indicador: string; objetivo: string; valor_atual?: string; unidade?: string }
export interface TarefaPendente { id: string; texto: string; feito: boolean; tarefa_id?: string | null }

// ----- Fluxograma (estilo Miro) -----
export type FlowTipo = "inicio" | "fim" | "processo" | "decisao" | "subetapa" | "postit";
export type Orientacao = "horizontal" | "vertical";
export interface FlowNode { id: string; tipo: FlowTipo; texto: string; x: number; y: number; cor?: string; parent?: string }
export interface FlowEdge { id: string; de: string; para: string; rotulo?: "" | "Sim" | "Não" | string }
export interface Fluxograma { nodes: FlowNode[]; edges: FlowEdge[]; orientacao?: Orientacao }

export interface ConteudoProcesso {
  fluxograma_url?: string;
  fluxograma?: Fluxograma;
  atividades?: Atividade[];
  recursos?: Recurso[];
  rotinas?: Rotina[];
  riscos?: Risco[];
  acoes?: Rotina[];
  metricas?: Metrica[];
  tarefas_pendentes?: TarefaPendente[];
}

/** Dimensões fixas por tipo de nó (px) — usadas no layout e no cálculo das setas. */
export const FLOW_SIZE: Record<FlowTipo, { w: number; h: number }> = {
  inicio: { w: 120, h: 52 },
  fim: { w: 120, h: 52 },
  processo: { w: 172, h: 60 },
  decisao: { w: 108, h: 108 },
  subetapa: { w: 150, h: 44 },
  postit: { w: 130, h: 112 },
};

/** Posição de um nó da linha principal (etapa) no índice i. */
function mainPos(orientacao: Orientacao, i: number) {
  return orientacao === "horizontal"
    ? { x: 110 + i * 240, y: 90 }
    : { x: 150, y: 50 + i * 165 };
}
/** Posição de uma subetapa j, pendurada a partir de uma etapa em (mx,my). */
function subPos(orientacao: Orientacao, mx: number, my: number, j: number) {
  return orientacao === "horizontal"
    ? { x: mx, y: my + 90 + j * 66 }
    : { x: mx + 140 + j * 175, y: my };
}

/**
 * Gera o fluxograma a partir das atividades (horizontal por padrão):
 * - cada ATIVIDADE vira uma ETAPA principal (retângulo) na linha do fluxo;
 * - cada ITEM da atividade vira uma SUBETAPA (menor) pendurada a partir da etapa;
 * - textos terminados em "?" viram DECISÃO (losango) com saída "Sim".
 * Preserva posições/cores manuais (casadas pelo texto) e os post-its.
 */
export function gerarFluxograma(atividades: Atividade[] = [], anterior?: Fluxograma, orientacao: Orientacao = "horizontal"): Fluxograma {
  const posAnterior = new Map((anterior?.nodes ?? []).map((n) => [`${n.tipo}:${n.texto}:${n.parent ?? ""}`, { x: n.x, y: n.y }]));
  const corAnterior = new Map((anterior?.nodes ?? []).map((n) => [`${n.texto}`, n.cor]));
  const postits = (anterior?.nodes ?? []).filter((n) => n.tipo === "postit");

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const GARGALO_COR = "#fdba74"; // laranja: sinaliza gargalo no fluxograma
  const put = (tipo: FlowTipo, texto: string, pos: { x: number; y: number }, parent?: string, gargalo?: boolean): FlowNode => {
    const saved = posAnterior.get(`${tipo}:${texto}:${parent ?? ""}`);
    const node: FlowNode = { id: novoId(), tipo, texto, x: saved?.x ?? pos.x, y: saved?.y ?? pos.y, parent, cor: corAnterior.get(texto) ?? (gargalo ? GARGALO_COR : undefined) };
    nodes.push(node);
    return node;
  };

  let mi = 0;
  const inicio = put("inicio", "Início", mainPos(orientacao, mi++));
  let prevMain = inicio;

  atividades.forEach((a) => {
    const titulo = (a.titulo ?? "").trim();
    const itens = (a.itens ?? []).filter((i) => (i.texto ?? "").trim());
    if (!titulo && itens.length === 0) return; // ignora atividade vazia
    const label = titulo || "Etapa";
    const mp = mainPos(orientacao, mi++);
    const main = put(label.endsWith("?") ? "decisao" : "processo", label, mp, undefined, a.gargalo);
    edges.push({ id: novoId(), de: prevMain.id, para: main.id, rotulo: prevMain.tipo === "decisao" ? "Sim" : "" });
    // subetapas penduradas
    let prevSub = main;
    itens.forEach((it, j) => {
      const t = (it.texto ?? "").trim();
      const sub = put(t.endsWith("?") ? "decisao" : "subetapa", t, subPos(orientacao, mp.x, mp.y, j), main.id, it.gargalo);
      edges.push({ id: novoId(), de: prevSub.id, para: sub.id, rotulo: "" });
      prevSub = sub;
    });
    prevMain = main;
  });

  const fim = put("fim", "Fim", mainPos(orientacao, mi++));
  edges.push({ id: novoId(), de: prevMain.id, para: fim.id, rotulo: prevMain.tipo === "decisao" ? "Sim" : "" });

  return { nodes: [...nodes, ...postits], edges, orientacao };
}

/** Reposiciona etapas (linha principal) e suas subetapas na orientação escolhida, preservando a sequência atual. */
export function relayout(graph: Fluxograma, orientacao: Orientacao): Fluxograma {
  const prevH = (graph.orientacao ?? "horizontal") === "horizontal";
  const mains = graph.nodes.filter((n) => !n.parent && n.tipo !== "postit").sort((a, b) => (prevH ? a.x - b.x : a.y - b.y));
  const pos = new Map<string, { x: number; y: number }>();
  mains.forEach((n, i) => pos.set(n.id, mainPos(orientacao, i)));

  const subsPorPai = new Map<string, FlowNode[]>();
  for (const n of graph.nodes) {
    if (!n.parent) continue;
    const arr = subsPorPai.get(n.parent) ?? [];
    arr.push(n);
    subsPorPai.set(n.parent, arr);
  }
  for (const [pid, subs] of subsPorPai) {
    const mp = pos.get(pid);
    if (!mp) continue;
    subs.sort((a, b) => (prevH ? a.y - b.y : a.x - b.x)).forEach((n, j) => pos.set(n.id, subPos(orientacao, mp.x, mp.y, j)));
  }

  return { ...graph, orientacao, nodes: graph.nodes.map((n) => pos.has(n.id) ? { ...n, ...pos.get(n.id)! } : n) };
}

export interface Processo {
  id: string;
  titulo: string;
  emoji: string | null;
  departamento_id: string | null;
  responsavel_id: string | null;
  frequencia: string | null;
  categoria: string | null;
  objetivo: string | null;
  status: StatusProcesso;
  parent_id: string | null;
  ordem: number;
  visibilidade: Visibilidade;
  share_token: string;
  conteudo: ConteudoProcesso;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joins opcionais
  departamento?: Departamento | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export const CATEGORIAS = ["Estratégico", "Tático", "Operacional"];
export const FREQUENCIAS = ["Sob demanda", "Diária", "Semanal", "Quinzenal", "Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];
export const STATUS_PROCESSO: { value: StatusProcesso; label: string; cor: string }[] = [
  { value: "rascunho", label: "Rascunho", cor: "bg-muted text-muted-foreground" },
  { value: "ativo", label: "Ativo", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "em_revisao", label: "Em revisão", cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "arquivado", label: "Arquivado", cor: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
];

/** Gera um id curto para itens do conteúdo (checklist, recursos, etc.). */
export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Progresso (%) de um processo com base nos itens de atividades concluídos. */
export function progressoProcesso(conteudo: ConteudoProcesso | null | undefined): { feitos: number; total: number; pct: number } {
  const itens = (conteudo?.atividades ?? []).flatMap((a) => a.itens ?? []);
  const total = itens.length;
  const feitos = itens.filter((i) => i.feito).length;
  return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 };
}

/** Modelo em branco do template POP, usado ao criar "a partir do modelo". */
export function conteudoModelo(): ConteudoProcesso {
  return {
    fluxograma_url: "",
    atividades: [
      { id: novoId(), titulo: "Atividade 1", itens: [{ id: novoId(), texto: "Primeiro passo", feito: false }] },
    ],
    recursos: [],
    rotinas: [],
    riscos: [],
    metricas: [],
    tarefas_pendentes: [],
  };
}
