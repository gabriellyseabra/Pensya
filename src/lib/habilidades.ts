/**
 * Normalização de habilidades trabalhadas.
 *
 * As habilidades são registradas em texto livre (pelo terapeuta e pela IA),
 * então variações como "leitura e compreensão" vs. "leitura e interpretação"
 * ou "escrita" vs. "linguagem escrita" acabam contando como habilidades
 * diferentes no monitoramento. Aqui agrupamos essas variações em áreas
 * canônicas, sem perder as habilidades que não se encaixam em nenhuma delas.
 */

export type AreaCanonica = { label: string; padroes: RegExp[] };

// Ordem importa: padrões mais específicos vêm antes dos mais genéricos.
export const AREAS_CANONICAS: AreaCanonica[] = [
  { label: "Consciência fonológica", padroes: [/fonolog/, /fon[eê]m/, /\brima/, /s[ií]laba/] },
  { label: "Leitura e compreensão", padroes: [/leitura/, /\bler\b/, /decodific/, /compreens[aã]o de texto/, /interpretaç[aã]o de texto/, /fluência leitora/] },
  { label: "Escrita", padroes: [/escrita/, /escrever/, /ortograf/, /caligraf/, /produç[aã]o textual/, /grafism/, /disgrafia/] },
  { label: "Matemática e raciocínio lógico", padroes: [/matem[aá]t/, /c[aá]lculo/, /aritm[eé]t/, /n[uú]mer/, /racioc[ií]nio l[oó]gic/, /l[oó]gic/, /quantidad/, /discalcul/] },
  { label: "Atenção e concentração", padroes: [/aten[çc][aã]o/, /concentr/, /\bfoco\b/, /vigil[aâ]nci/] },
  { label: "Funções executivas", padroes: [/execut/, /planejament/, /organizaç[aã]o/, /inibi[çc]/, /flexibilidade cognit/, /autorregula/, /controle inibit/, /mem[oó]ria de trabalho/] },
  { label: "Memória", padroes: [/mem[oó]ri/, /memoriz/] },
  { label: "Linguagem oral", padroes: [/linguagem oral/, /\bfala\b/, /express[aã]o oral/, /vocabul[aá]ri/, /narrativa oral/, /discurs/, /nomea[çc][aã]o/, /sem[aâ]ntic/] },
  { label: "Habilidades sociais e emocionais", padroes: [/soci/, /emocion/, /intera[çc][aã]o/, /empatia/, /comportament/] },
  { label: "Motricidade e coordenação", padroes: [/\bmotor/, /motricidad/, /coordena[çc][aã]o/, /grafomotor/, /viso-?motor/, /praxia/] },
  { label: "Percepção visual e espacial", padroes: [/visu[oa]/, /viso-?espac/, /percep[çc][aã]o/, /espacial/] },
];

function limpar(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

/**
 * Retorna o rótulo canônico para uma habilidade, ou o próprio nome
 * (com a primeira letra maiúscula) quando não se encaixa em nenhuma área.
 */
export function normalizarHabilidade(nome: string): string {
  const limpo = limpar(nome);
  if (!limpo) return "";
  for (const area of AREAS_CANONICAS) {
    // Testa os padrões contra a versão sem acento (os próprios padrões
    // já cobrem variações acentuadas via classes de caractere).
    if (area.padroes.some((re) => re.test(limpo) || re.test(nome.toLowerCase()))) {
      return area.label;
    }
  }
  // Sem área canônica: mantém a habilidade original, só padroniza a capitalização.
  return nome.trim().charAt(0).toUpperCase() + nome.trim().slice(1);
}

/** Lista de rótulos canônicos para sugestões/autocomplete. */
export const HABILIDADES_SUGERIDAS = AREAS_CANONICAS.map((a) => a.label);
