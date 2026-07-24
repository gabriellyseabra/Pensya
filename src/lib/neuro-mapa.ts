/**
 * Mapa funcional — correspondência entre construtos avaliados e regiões encefálicas.
 *
 * IMPORTANTE (limite do instrumento): este mapa é ILUSTRATIVO. Ele traduz
 * achados de testes COMPORTAMENTAIS para as regiões que a literatura associa
 * a cada construto. Não é, e não deve ser apresentado como, exame de imagem
 * (RM, fMRI, EEG). Nunca afirma lesão: afirma que "os processos avaliados por
 * esta via estão abaixo/dentro/acima do esperado".
 *
 * Três canais visuais independentes — nunca um sobrescreve o outro:
 *   COR   = desempenho na avaliação (percentil → rubrica → PALETA_SISTEMA)
 *   HALO  = intervenção em curso (sessões + metas ativas)
 *   DELTA = evolução entre dois momentos
 *
 * Fonte da localização: presets curados por construto (abaixo). A clínica pode
 * sobrescrever pesos/regiões; o preset é o ponto de partida, não uma regra fixa.
 */

import { classificar, RUBRICA_PADRAO, type Rubrica } from "./avaliacao-classificacao";

/* ============================ Regiões ============================ */

export type Lado = "E" | "D" | "bilateral" | "medial";

export type RegiaoDef = {
  key: string;
  /** Rótulo curto, para chips e listas. */
  nome: string;
  /** Nome anatômico completo, para o card de detalhe e o laudo. */
  nomeCompleto: string;
  lado: Lado;
  /**
   * Coordenada normalizada no espaço do modelo, com x SEMPRE positivo.
   * O lado decide o espelhamento: E → -x, D → +x, bilateral → os dois,
   * medial → usa x como está (≈0).
   * Eixos: x = lateral (direita +), y = superior (cima +), z = anterior (frente +).
   */
  coord: [number, number, number];
  /** Estrutura profunda/medial: não pode ser fixada na superfície do córtex. */
  profunda: boolean;
  /** O que a região sustenta, em linguagem de devolutiva. */
  resp: string;
};

export const REGIOES: RegiaoDef[] = [
  {
    key: "pre_frontal_dorsolateral",
    nome: "Pré-frontal dorsolateral",
    nomeCompleto: "Córtex pré-frontal dorsolateral",
    lado: "bilateral",
    coord: [0.6, 0.4, 0.68],
    profunda: false,
    resp: "Memória de trabalho, planejamento, flexibilidade cognitiva e manutenção de objetivos — o que sustenta 'segurar a instrução na cabeça enquanto executa'.",
  },
  {
    key: "pre_frontal_ventromedial",
    nome: "Ventromedial / orbitofrontal",
    nomeCompleto: "Córtex pré-frontal ventromedial e orbitofrontal",
    lado: "bilateral",
    coord: [0.38, -0.3, 0.8],
    profunda: false,
    resp: "Controle inibitório, regulação emocional, tomada de decisão e adequação do comportamento ao contexto.",
  },
  {
    key: "cingulado_anterior",
    nome: "Cingulado anterior",
    nomeCompleto: "Córtex cingulado anterior",
    lado: "medial",
    coord: [0.04, 0.3, 0.42],
    profunda: true,
    resp: "Atenção sustentada, detecção de erro e monitoramento de conflito — percebe que algo saiu errado e reorienta o esforço.",
  },
  {
    key: "frontal_inferior_e",
    nome: "Frontal inferior esq. (Broca)",
    nomeCompleto: "Giro frontal inferior esquerdo — área de Broca",
    lado: "E",
    coord: [0.78, 0.02, 0.5],
    profunda: false,
    resp: "Produção da fala, fluência verbal, acesso lexical e processamento fonológico articulatório.",
  },
  {
    key: "temporal_superior_e",
    nome: "Temporal superior esq. (Wernicke)",
    nomeCompleto: "Giro temporal superior esquerdo — área de Wernicke",
    lado: "E",
    coord: [0.88, -0.16, -0.04],
    profunda: false,
    resp: "Compreensão da linguagem oral, consciência fonológica e representação dos sons da fala.",
  },
  {
    key: "occipito_temporal_e",
    nome: "Occipitotemporal ventral esq.",
    nomeCompleto: "Região occipitotemporal ventral esquerda — área da forma visual da palavra",
    lado: "E",
    coord: [0.6, -0.5, -0.42],
    profunda: false,
    resp: "Reconhecimento visual automático da palavra escrita — a via da leitura fluente, sem soletrar.",
  },
  {
    key: "parietal_inferior_e",
    nome: "Parietal inferior esq.",
    nomeCompleto: "Lóbulo parietal inferior esquerdo — giros angular e supramarginal",
    lado: "E",
    coord: [0.72, 0.42, -0.42],
    profunda: false,
    resp: "Integração entre som, letra e significado: ortografia, escrita e conversão grafema-fonema.",
  },
  {
    key: "sulco_intraparietal",
    nome: "Sulco intraparietal",
    nomeCompleto: "Sulco intraparietal",
    lado: "bilateral",
    coord: [0.48, 0.6, -0.34],
    profunda: false,
    resp: "Senso numérico, noção de quantidade e cálculo — a base não verbal da matemática.",
  },
  {
    key: "hipocampo",
    nome: "Hipocampo",
    nomeCompleto: "Hipocampo e córtex temporal medial",
    lado: "bilateral",
    coord: [0.4, -0.28, -0.08],
    profunda: true,
    resp: "Aquisição, consolidação e evocação de memórias — transforma o que foi visto em sessão no que fica retido.",
  },
  {
    key: "parietal_superior",
    nome: "Parietal superior / precúneo",
    nomeCompleto: "Lóbulo parietal superior e precúneo",
    lado: "bilateral",
    coord: [0.3, 0.72, -0.55],
    profunda: false,
    resp: "Processamento visuoespacial, atenção espacial e organização do espaço na folha e no material.",
  },
  {
    key: "occipital",
    nome: "Occipital",
    nomeCompleto: "Córtex occipital",
    lado: "bilateral",
    coord: [0.25, 0.05, -0.9],
    profunda: false,
    resp: "Processamento visual básico: forma, contraste e discriminação dos estímulos que chegam pelos olhos.",
  },
  {
    key: "motor",
    nome: "Motor e pré-motor",
    nomeCompleto: "Córtex motor primário e pré-motor",
    lado: "bilateral",
    coord: [0.55, 0.72, 0.12],
    profunda: false,
    resp: "Planejamento e execução do movimento, incluindo o gesto gráfico da escrita.",
  },
  {
    key: "cerebelo",
    nome: "Cerebelo",
    nomeCompleto: "Cerebelo",
    lado: "bilateral",
    coord: [0.4, -0.6, -0.68],
    profunda: false,
    resp: "Automatização, ritmo e precisão do movimento — o que faz a habilidade deixar de custar esforço consciente.",
  },
  {
    key: "amigdala",
    nome: "Amígdala e límbico",
    nomeCompleto: "Amígdala e estruturas límbicas",
    lado: "bilateral",
    coord: [0.34, -0.34, 0.1],
    profunda: true,
    resp: "Resposta emocional, detecção de ameaça e a carga afetiva que acompanha a tarefa escolar.",
  },
  {
    key: "tpj_d",
    nome: "Temporoparietal dir.",
    nomeCompleto: "Junção temporoparietal direita",
    lado: "D",
    coord: [0.82, 0.28, -0.26],
    profunda: false,
    resp: "Cognição social e leitura de intenção do outro — perceber o que a outra pessoa está pensando ou sentindo.",
  },
];

export const REGIAO_POR_KEY: Record<string, RegiaoDef> = Object.fromEntries(
  REGIOES.map((r) => [r.key, r]),
);

/**
 * Sinal do eixo x que corresponde ao hemisfério DIREITO DO PACIENTE.
 *
 * Verificado na geometria do brain.glb: a malha `Brain_Part_02` é bilateral,
 * inferior e fica inteiramente em z negativo — é o cerebelo. Logo +z é
 * anterior, e o modelo está de frente para a câmera padrão (que fica em +z).
 * Como o cérebro encara quem olha, o hemisfério direito do paciente aparece à
 * ESQUERDA do observador, isto é, em -x — a mesma convenção de uma prancha
 * anatômica em vista frontal.
 *
 * Se ao girar o modelo a lateralidade aparecer trocada (Broca à direita de
 * quem olha em vista frontal), basta inverter este sinal para +1: é o único
 * ponto do sistema que decide lado.
 */
export const EIXO_HEMISFERIO_DIREITO: 1 | -1 = -1;

/**
 * Posições dos marcadores de uma região no espaço normalizado.
 * Bilateral devolve dois pontos; os demais, um.
 */
export function pontosDaRegiao(r: RegiaoDef): [number, number, number][] {
  const [x, y, z] = r.coord;
  const dir = Math.abs(x) * EIXO_HEMISFERIO_DIREITO; // hemisfério direito
  const esq = -dir; // hemisfério esquerdo
  if (r.lado === "bilateral")
    return [
      [esq, y, z],
      [dir, y, z],
    ];
  if (r.lado === "E") return [[esq, y, z]];
  if (r.lado === "D") return [[dir, y, z]];
  return [[x, y, z]]; // medial
}

export function rotuloLado(lado: Lado): string {
  if (lado === "E") return "hemisfério esquerdo";
  if (lado === "D") return "hemisfério direito";
  if (lado === "medial") return "linha média";
  return "bilateral";
}

/* ============================ Redes ============================ */

export type RedeDef = {
  key: string;
  nome: string;
  regioes: string[];
  descricao: string;
};

/**
 * Redes funcionais — o argumento de "conexão" da devolutiva. Uma dificuldade
 * raramente mora em uma região só; costuma ser uma via inteira sob carga.
 */
export const REDES: RedeDef[] = [
  {
    key: "executiva",
    nome: "Rede executiva frontoparietal",
    regioes: ["pre_frontal_dorsolateral", "sulco_intraparietal", "parietal_superior"],
    descricao: "Sustenta objetivo, manipula informação e resolve problema novo.",
  },
  {
    key: "atencao",
    nome: "Rede de atenção e monitoramento",
    regioes: ["cingulado_anterior", "pre_frontal_dorsolateral", "parietal_superior"],
    descricao: "Mantém o foco, percebe o erro e reorienta o esforço.",
  },
  {
    key: "linguagem",
    nome: "Rede da linguagem (fascículo arqueado)",
    regioes: ["frontal_inferior_e", "temporal_superior_e"],
    descricao: "Liga compreender o som da fala a produzir a fala.",
  },
  {
    key: "leitura",
    nome: "Rede da leitura",
    regioes: [
      "occipito_temporal_e",
      "temporal_superior_e",
      "frontal_inferior_e",
      "parietal_inferior_e",
    ],
    descricao: "Converte a letra vista em som, e o som em significado.",
  },
  {
    key: "numero",
    nome: "Rede do número",
    regioes: ["sulco_intraparietal", "parietal_inferior_e", "pre_frontal_dorsolateral"],
    descricao: "Liga a noção de quantidade ao cálculo e ao símbolo matemático.",
  },
  {
    key: "memoria",
    nome: "Rede da memória",
    regioes: ["hipocampo", "pre_frontal_dorsolateral", "temporal_superior_e"],
    descricao: "Codifica, consolida e recupera o que foi aprendido.",
  },
  {
    key: "socioemocional",
    nome: "Rede socioemocional",
    regioes: ["pre_frontal_ventromedial", "amigdala", "tpj_d"],
    descricao: "Regula a emoção e interpreta a intenção do outro.",
  },
  {
    key: "visuoespacial",
    nome: "Rede visuoespacial",
    regioes: ["parietal_superior", "occipital", "sulco_intraparietal"],
    descricao: "Organiza o que se vê no espaço e na página.",
  },
  {
    key: "motora",
    nome: "Rede motora e de automatização",
    regioes: ["motor", "cerebelo", "parietal_superior"],
    descricao: "Transforma o movimento pensado em gesto automático.",
  },
];

export function redesDaRegiao(regiaoKey: string): RedeDef[] {
  return REDES.filter((r) => r.regioes.includes(regiaoKey));
}

/* ============================ Construtos ============================ */

export type ConstrutoDef = {
  key: string;
  label: string;
  /** Termos reconhecidos no nome do domínio, da variável ou do teste. */
  termos: string[];
  /** Regiões implicadas e o peso de cada uma (1 = principal). */
  regioes: { key: string; peso: number }[];
};

/**
 * Preset curado. A resolução NÃO é "primeiro que casar": vence o termo MAIS
 * ESPECÍFICO (mais longo) encontrado no texto. É isso que garante que
 * "memória de trabalho" caia no pré-frontal dorsolateral e não no hipocampo.
 */
export const CONSTRUTOS: ConstrutoDef[] = [
  /* --- Funções executivas --- */
  {
    key: "memoria_trabalho",
    label: "Memória de trabalho",
    termos: [
      "memoria de trabalho",
      "memoria operacional",
      "working memory",
      "span de digitos",
      "digitos inverso",
    ],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 1 },
      { key: "parietal_inferior_e", peso: 0.4 },
    ],
  },
  {
    key: "controle_inibitorio",
    label: "Controle inibitório",
    termos: [
      "controle inibitorio",
      "inibicao",
      "impulsividade",
      "impulsivo",
      "autocontrole",
      "inibitorio",
    ],
    regioes: [
      { key: "pre_frontal_ventromedial", peso: 1 },
      { key: "cingulado_anterior", peso: 0.6 },
    ],
  },
  {
    key: "flexibilidade",
    label: "Flexibilidade cognitiva",
    termos: [
      "flexibilidade cognitiva",
      "flexibilidade",
      "alternancia",
      "set shifting",
      "perseveracao",
    ],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 0.9 },
      { key: "cingulado_anterior", peso: 0.5 },
    ],
  },
  {
    key: "planejamento",
    label: "Planejamento e organização",
    termos: [
      "planejamento",
      "organizacao",
      "resolucao de problemas",
      "tomada de decisao",
      "estrategia",
    ],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 1 },
      { key: "parietal_superior", peso: 0.35 },
    ],
  },
  {
    key: "metacognicao",
    label: "Metacognição",
    termos: ["metacognicao", "metacognitiv", "automonitoramento", "autorregulacao"],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 0.9 },
      { key: "cingulado_anterior", peso: 0.5 },
    ],
  },
  {
    key: "funcoes_executivas",
    label: "Funções executivas",
    termos: ["funcoes executivas", "funcao executiva", "executivo", "executivas"],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 1 },
      { key: "cingulado_anterior", peso: 0.6 },
      { key: "pre_frontal_ventromedial", peso: 0.5 },
    ],
  },

  /* --- Atenção --- */
  {
    key: "atencao_sustentada",
    label: "Atenção sustentada",
    termos: ["atencao sustentada", "concentracao", "vigilancia", "manutencao da atencao"],
    regioes: [
      { key: "cingulado_anterior", peso: 1 },
      { key: "pre_frontal_dorsolateral", peso: 0.6 },
    ],
  },
  {
    key: "atencao_seletiva",
    label: "Atenção seletiva",
    termos: ["atencao seletiva", "atencao focada", "distratibilidade", "distracao"],
    regioes: [
      { key: "cingulado_anterior", peso: 0.8 },
      { key: "parietal_superior", peso: 0.7 },
    ],
  },
  {
    key: "atencao_alternada",
    label: "Atenção alternada e dividida",
    termos: ["atencao alternada", "atencao dividida", "dupla tarefa"],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 0.9 },
      { key: "parietal_superior", peso: 0.6 },
    ],
  },
  {
    key: "atencao",
    label: "Atenção",
    termos: ["atencao", "atencional", "tdah", "desatencao", "desatento"],
    regioes: [
      { key: "cingulado_anterior", peso: 0.9 },
      { key: "pre_frontal_dorsolateral", peso: 0.7 },
    ],
  },
  {
    key: "velocidade_processamento",
    label: "Velocidade de processamento",
    termos: ["velocidade de processamento", "velocidade", "tempo de reacao", "rapidez"],
    regioes: [
      { key: "parietal_superior", peso: 0.6 },
      { key: "pre_frontal_dorsolateral", peso: 0.5 },
      { key: "cerebelo", peso: 0.4 },
    ],
  },

  /* --- Linguagem --- */
  {
    key: "consciencia_fonologica",
    label: "Consciência fonológica",
    termos: ["consciencia fonologica", "fonologic", "fonema", "rima", "aliteracao", "silabic"],
    regioes: [
      { key: "temporal_superior_e", peso: 1 },
      { key: "frontal_inferior_e", peso: 0.6 },
    ],
  },
  {
    key: "linguagem_receptiva",
    label: "Linguagem receptiva",
    termos: [
      "linguagem receptiva",
      "compreensao oral",
      "compreensao auditiva",
      "escuta",
      "compreensao verbal",
    ],
    regioes: [
      { key: "temporal_superior_e", peso: 1 },
      { key: "frontal_inferior_e", peso: 0.35 },
    ],
  },
  {
    key: "linguagem_expressiva",
    label: "Linguagem expressiva",
    termos: [
      "linguagem expressiva",
      "fluencia verbal",
      "nomeacao",
      "acesso lexical",
      "fala",
      "producao oral",
      "narrativa oral",
    ],
    regioes: [
      { key: "frontal_inferior_e", peso: 1 },
      { key: "temporal_superior_e", peso: 0.5 },
    ],
  },
  {
    key: "vocabulario",
    label: "Vocabulário",
    termos: ["vocabulario", "semantic", "significado das palavras"],
    regioes: [
      { key: "temporal_superior_e", peso: 0.9 },
      { key: "frontal_inferior_e", peso: 0.4 },
    ],
  },
  {
    key: "linguagem",
    label: "Linguagem",
    termos: ["linguagem", "linguistic"],
    regioes: [
      { key: "temporal_superior_e", peso: 0.9 },
      { key: "frontal_inferior_e", peso: 0.8 },
    ],
  },

  /* --- Leitura e escrita --- */
  {
    key: "leitura_palavras",
    label: "Leitura de palavras",
    termos: [
      "leitura de palavras",
      "decodificacao",
      "reconhecimento de palavras",
      "fluencia de leitura",
      "fluencia leitora",
      "leitura de pseudopalavras",
      "dislexia",
    ],
    regioes: [
      { key: "occipito_temporal_e", peso: 1 },
      { key: "temporal_superior_e", peso: 0.6 },
      { key: "frontal_inferior_e", peso: 0.45 },
    ],
  },
  {
    key: "compreensao_leitora",
    label: "Compreensão leitora",
    termos: [
      "compreensao leitora",
      "compreensao de texto",
      "interpretacao de texto",
      "compreensao de leitura",
    ],
    regioes: [
      { key: "temporal_superior_e", peso: 0.85 },
      { key: "parietal_inferior_e", peso: 0.6 },
      { key: "pre_frontal_dorsolateral", peso: 0.5 },
    ],
  },
  {
    key: "leitura",
    label: "Leitura",
    termos: ["leitura", "ler", "alfabetizacao", "alfabetiz"],
    regioes: [
      { key: "occipito_temporal_e", peso: 0.9 },
      { key: "temporal_superior_e", peso: 0.6 },
      { key: "parietal_inferior_e", peso: 0.5 },
    ],
  },
  {
    key: "escrita_ortografia",
    label: "Escrita e ortografia",
    termos: [
      "ortografia",
      "ortografic",
      "escrita",
      "producao escrita",
      "producao textual",
      "disortografia",
      "ditado",
      "texto escrito",
      "competencia textual",
      "competencia gramatical",
    ],
    regioes: [
      { key: "parietal_inferior_e", peso: 1 },
      { key: "frontal_inferior_e", peso: 0.6 },
      { key: "occipito_temporal_e", peso: 0.4 },
    ],
  },
  {
    key: "grafomotricidade",
    label: "Grafomotricidade",
    termos: [
      "grafomotricidade",
      "caligrafia",
      "grafismo",
      "disgrafia",
      "tracado",
      "letra ilegivel",
    ],
    regioes: [
      { key: "motor", peso: 1 },
      { key: "cerebelo", peso: 0.6 },
      { key: "parietal_superior", peso: 0.4 },
    ],
  },

  /* --- Matemática --- */
  {
    key: "senso_numerico",
    label: "Senso numérico",
    termos: [
      "senso numerico",
      "cognicao numerica",
      "quantidade",
      "magnitude",
      "contagem",
      "transcodificacao",
      "discalculia",
    ],
    regioes: [
      { key: "sulco_intraparietal", peso: 1 },
      { key: "parietal_inferior_e", peso: 0.5 },
    ],
  },
  {
    key: "calculo",
    label: "Cálculo e aritmética",
    termos: [
      "aritmetica",
      "calculo",
      "operacoes matematicas",
      "matematica",
      "matematic",
      "numeric",
    ],
    regioes: [
      { key: "sulco_intraparietal", peso: 1 },
      { key: "parietal_inferior_e", peso: 0.6 },
      { key: "pre_frontal_dorsolateral", peso: 0.4 },
    ],
  },
  {
    key: "raciocinio",
    label: "Raciocínio lógico",
    termos: [
      "raciocinio logico",
      "raciocinio",
      "logica",
      "abstracao",
      "matrizes",
      "raciocinio fluido",
    ],
    regioes: [
      { key: "pre_frontal_dorsolateral", peso: 0.85 },
      { key: "sulco_intraparietal", peso: 0.75 },
    ],
  },

  /* --- Memória --- */
  {
    key: "memoria_episodica",
    label: "Memória episódica",
    termos: [
      "memoria episodica",
      "memoria de longo prazo",
      "evocacao",
      "recordacao",
      "consolidacao",
      "retencao",
    ],
    regioes: [
      { key: "hipocampo", peso: 1 },
      { key: "pre_frontal_dorsolateral", peso: 0.4 },
    ],
  },
  {
    key: "memoria_visuoespacial",
    label: "Memória visuoespacial",
    termos: [
      "memoria visuoespacial",
      "binding visuoespacial",
      "binding",
      "memoria visual",
      "memoria espacial",
    ],
    regioes: [
      { key: "hipocampo", peso: 0.85 },
      { key: "parietal_superior", peso: 0.7 },
      { key: "occipital", peso: 0.4 },
    ],
  },
  {
    key: "memoria",
    label: "Memória",
    termos: ["memoria", "aprendizagem", "aprendiz"],
    regioes: [
      { key: "hipocampo", peso: 0.9 },
      { key: "pre_frontal_dorsolateral", peso: 0.5 },
    ],
  },

  /* --- Visuoespacial e motor --- */
  {
    key: "visuoespacial",
    label: "Habilidades visuoespaciais",
    termos: [
      "visuoespacial",
      "visoespacial",
      "percepcao visual",
      "organizacao perceptual",
      "visuoconstrutiv",
      "espacial",
      "visual",
    ],
    regioes: [
      { key: "parietal_superior", peso: 1 },
      { key: "occipital", peso: 0.8 },
    ],
  },
  {
    key: "motricidade",
    label: "Motricidade e coordenação",
    termos: [
      "motricidade",
      "coordenacao motora",
      "coordenacao",
      "motor",
      "psicomotric",
      "destreza",
    ],
    regioes: [
      { key: "motor", peso: 1 },
      { key: "cerebelo", peso: 0.8 },
    ],
  },

  /* --- Socioemocional --- */
  {
    key: "regulacao_emocional",
    label: "Regulação emocional",
    termos: [
      "regulacao emocional",
      "autorregulacao emocional",
      "emocional",
      "emocao",
      "frustracao",
      "irritabilidade",
    ],
    regioes: [
      { key: "pre_frontal_ventromedial", peso: 1 },
      { key: "amigdala", peso: 0.8 },
    ],
  },
  {
    key: "cognicao_social",
    label: "Cognição social",
    termos: [
      "cognicao social",
      "teoria da mente",
      "habilidades sociais",
      "social",
      "socioemocional",
      "empatia",
      "interacao",
      "autismo",
      "autist",
      "tea",
    ],
    regioes: [
      { key: "tpj_d", peso: 1 },
      { key: "pre_frontal_ventromedial", peso: 0.6 },
    ],
  },
  {
    key: "ansiedade",
    label: "Ansiedade",
    termos: ["ansiedade", "ansios", "medo", "estresse"],
    regioes: [
      { key: "amigdala", peso: 1 },
      { key: "pre_frontal_ventromedial", peso: 0.6 },
    ],
  },
  {
    key: "comportamento_adaptativo",
    label: "Comportamento adaptativo",
    termos: ["comportamento adaptativo", "adaptativo", "autonomia", "vida diaria", "comportamento"],
    regioes: [
      { key: "pre_frontal_ventromedial", peso: 0.8 },
      { key: "pre_frontal_dorsolateral", peso: 0.5 },
    ],
  },
];

/* ============================ Resolução ============================ */

/** Minúsculas, sem acento — para casar "consciência" com "consciencia". */
export function normalizarTexto(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

export type Correspondencia = {
  construto: ConstrutoDef;
  /** Termo que casou — útil para explicar a decisão na UI de curadoria. */
  termo: string;
  /** Especificidade do casamento (comprimento do termo). */
  score: number;
};

/**
 * Resolve o construto de um texto pelo termo MAIS ESPECÍFICO encontrado.
 * Diferente de "primeira regex que casar", a ordem da lista não altera o
 * resultado — o que elimina a fragilidade do mapeamento anterior.
 */
export function correspondenciaDe(texto: string): Correspondencia | null {
  const t = normalizarTexto(texto);
  if (!t) return null;
  let melhor: Correspondencia | null = null;
  for (const c of CONSTRUTOS) {
    for (const termo of c.termos) {
      if (!t.includes(termo)) continue;
      const score = termo.length;
      if (!melhor || score > melhor.score) melhor = { construto: c, termo, score };
    }
  }
  return melhor;
}

/**
 * Melhor construto entre vários textos candidatos (variável, domínio, teste).
 * Vence o casamento mais específico, venha de onde vier — assim uma variável
 * detalhada ("Memória de trabalho") prevalece sobre o domínio genérico
 * ("Memória"), sem depender da ordem em que foram passados.
 */
export function melhorConstruto(...textos: (string | null | undefined)[]): ConstrutoDef | null {
  let melhor: Correspondencia | null = null;
  for (const texto of textos) {
    if (!texto) continue;
    const m = correspondenciaDe(texto);
    if (m && (!melhor || m.score > melhor.score)) melhor = m;
  }
  return melhor?.construto ?? null;
}

/** Regiões e pesos implicados por um texto clínico. Vazio quando não reconhecido. */
export function distribuirEmRegioes(
  ...textos: (string | null | undefined)[]
): { key: string; peso: number }[] {
  return melhorConstruto(...textos)?.regioes ?? [];
}

/* ============================ Canais visuais ============================ */

/** Cinza neutro — ausência de dado nunca deve parecer resultado. */
export const COR_SEM_DADOS = "#cbd5e1";
/** Cor do canal de intervenção (halo). Não compete com a paleta de desempenho. */
export const COR_INTERVENCAO = "#a78bfa";

/**
 * Cor do canal de desempenho: percentil → rubrica → PALETA_SISTEMA.
 * Mesma régua dos gráficos e tabelas, para que a mesma faixa tenha sempre a
 * mesma cor em todo o sistema.
 */
export function corDesempenho(percentil: number | null, rubrica?: Rubrica | null): string {
  if (percentil == null) return COR_SEM_DADOS;
  return classificar(rubrica ?? RUBRICA_PADRAO, { percentil })?.cor ?? COR_SEM_DADOS;
}

export function classificacaoDesempenho(
  percentil: number | null,
  rubrica?: Rubrica | null,
): string | null {
  if (percentil == null) return null;
  return classificar(rubrica ?? RUBRICA_PADRAO, { percentil })?.rotulo ?? null;
}

/**
 * Frase de devolutiva para uma região — deliberadamente sobre PROCESSOS
 * AVALIADOS, nunca sobre a integridade do tecido cerebral.
 */
export function fraseDesempenho(regiao: RegiaoDef, percentil: number | null): string {
  if (percentil == null) {
    return `Ainda não há testes aplicados que avaliem os processos associados a esta via.`;
  }
  if (percentil < 9) {
    return `Os processos avaliados por esta via estão bastante abaixo do esperado para a idade (percentil ${percentil}).`;
  }
  if (percentil < 25) {
    return `Os processos avaliados por esta via estão abaixo do esperado para a idade (percentil ${percentil}).`;
  }
  if (percentil < 75) {
    return `Os processos avaliados por esta via estão dentro do esperado para a idade (percentil ${percentil}).`;
  }
  return `Os processos avaliados por esta via estão acima do esperado para a idade (percentil ${percentil}) — uma força a ser usada como apoio.`;
}

/** Aviso obrigatório em qualquer tela ou export que mostre o mapa. */
export const AVISO_MAPA =
  "Mapa funcional ilustrativo, derivado de testes comportamentais. Não é exame de neuroimagem e não indica lesão cerebral.";
