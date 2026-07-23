/**
 * Catálogo CID-11 curado, multidisciplinar. Cobre neurodesenvolvimento,
 * fonoaudiologia (fala/linguagem/voz/deglutição/audição), psicologia (humor,
 * ansiedade, trauma, alimentares, sono, personalidade, neurocognitivo),
 * psicomotricidade e terapia ocupacional (motor/sensorial).
 *
 * Códigos e títulos derivam da Classificação Internacional de Doenças (OMS) —
 * domínio público. NÃO reproduzimos critérios diagnósticos de terceiros (ex.: DSM).
 * Onde o código exato seria incerto, deixamos `codigo` nulo (nome apenas), para
 * não afirmar um código errado; a profissional pode digitar o código correto.
 */
export type Cid11 = { codigo: string | null; nome: string; grupo: string };

export const CID11_CATALOGO: Cid11[] = [
  // ── Neurodesenvolvimento ──────────────────────────────────────────────
  { codigo: "6A00", nome: "Transtornos do desenvolvimento intelectual", grupo: "Neurodesenvolvimento" },
  { codigo: "6A02", nome: "Transtorno do espectro do autismo", grupo: "Neurodesenvolvimento" },
  { codigo: "6A03.0", nome: "Transtorno da aprendizagem com prejuízo na leitura (dislexia)", grupo: "Neurodesenvolvimento" },
  { codigo: "6A03.1", nome: "Transtorno da aprendizagem com prejuízo na expressão escrita (disortografia/disgrafia)", grupo: "Neurodesenvolvimento" },
  { codigo: "6A03.2", nome: "Transtorno da aprendizagem com prejuízo na matemática (discalculia)", grupo: "Neurodesenvolvimento" },
  { codigo: "6A03.3", nome: "Transtorno do desenvolvimento da aprendizagem, outro especificado", grupo: "Neurodesenvolvimento" },
  { codigo: "6A04", nome: "Transtorno do desenvolvimento da coordenação motora", grupo: "Neurodesenvolvimento" },
  { codigo: "6A05.0", nome: "TDAH, apresentação predominantemente desatenta", grupo: "Neurodesenvolvimento" },
  { codigo: "6A05.1", nome: "TDAH, apresentação predominantemente hiperativa-impulsiva", grupo: "Neurodesenvolvimento" },
  { codigo: "6A05.2", nome: "TDAH, apresentação combinada", grupo: "Neurodesenvolvimento" },
  { codigo: "6A06", nome: "Transtorno do movimento estereotipado", grupo: "Neurodesenvolvimento" },
  { codigo: "6A0Z", nome: "Transtorno do neurodesenvolvimento, não especificado", grupo: "Neurodesenvolvimento" },

  // ── Fala, linguagem e comunicação ─────────────────────────────────────
  { codigo: "6A01.0", nome: "Transtorno do desenvolvimento da sonoridade da fala", grupo: "Fala, linguagem e comunicação" },
  { codigo: "6A01.1", nome: "Transtorno do desenvolvimento da fluência da fala (gagueira)", grupo: "Fala, linguagem e comunicação" },
  { codigo: "6A01.2", nome: "Transtorno do desenvolvimento da linguagem", grupo: "Fala, linguagem e comunicação" },
  { codigo: null, nome: "Apraxia de fala na infância", grupo: "Fala, linguagem e comunicação" },
  { codigo: null, nome: "Afasia (linguagem adquirida)", grupo: "Fala, linguagem e comunicação" },
  { codigo: null, nome: "Transtorno da comunicação social (pragmática)", grupo: "Fala, linguagem e comunicação" },

  // ── Voz e deglutição (fono) ───────────────────────────────────────────
  { codigo: null, nome: "Disfonia / alteração de voz", grupo: "Voz e deglutição" },
  { codigo: null, nome: "Disfagia (dificuldade de deglutição)", grupo: "Voz e deglutição" },
  { codigo: null, nome: "Distúrbio de motricidade orofacial", grupo: "Voz e deglutição" },

  // ── Audição ───────────────────────────────────────────────────────────
  { codigo: "AB50", nome: "Perda auditiva condutiva", grupo: "Audição" },
  { codigo: "AB51", nome: "Perda auditiva neurossensorial", grupo: "Audição" },
  { codigo: "AB52", nome: "Perda auditiva mista", grupo: "Audição" },
  { codigo: null, nome: "Transtorno do processamento auditivo (central)", grupo: "Audição" },

  // ── Motor, sensorial e psicomotricidade ───────────────────────────────
  { codigo: "8D20", nome: "Paralisia cerebral espástica", grupo: "Motor e sensorial" },
  { codigo: null, nome: "Paralisia cerebral (outros tipos)", grupo: "Motor e sensorial" },
  { codigo: null, nome: "Dificuldade de integração/modulação sensorial", grupo: "Motor e sensorial" },
  { codigo: null, nome: "Atraso do desenvolvimento neuropsicomotor", grupo: "Motor e sensorial" },

  // ── Intelectual e genético ────────────────────────────────────────────
  { codigo: "LD40.0", nome: "Síndrome de Down (trissomia do 21)", grupo: "Intelectual e genético" },
  { codigo: null, nome: "Síndrome do X frágil", grupo: "Intelectual e genético" },

  // ── Humor ─────────────────────────────────────────────────────────────
  { codigo: "6A60", nome: "Transtorno bipolar tipo I", grupo: "Humor" },
  { codigo: "6A61", nome: "Transtorno bipolar tipo II", grupo: "Humor" },
  { codigo: "6A70", nome: "Episódio depressivo único", grupo: "Humor" },
  { codigo: "6A71", nome: "Transtorno depressivo recorrente", grupo: "Humor" },
  { codigo: "6A72", nome: "Transtorno distímico", grupo: "Humor" },
  { codigo: "6A73", nome: "Transtorno misto de depressão e ansiedade", grupo: "Humor" },

  // ── Ansiedade e relacionados ──────────────────────────────────────────
  { codigo: "6B00", nome: "Transtorno de ansiedade generalizada", grupo: "Ansiedade e relacionados" },
  { codigo: "6B01", nome: "Transtorno de pânico", grupo: "Ansiedade e relacionados" },
  { codigo: "6B02", nome: "Agorafobia", grupo: "Ansiedade e relacionados" },
  { codigo: "6B03", nome: "Fobia específica", grupo: "Ansiedade e relacionados" },
  { codigo: "6B04", nome: "Transtorno de ansiedade social", grupo: "Ansiedade e relacionados" },
  { codigo: "6B05", nome: "Transtorno de ansiedade de separação", grupo: "Ansiedade e relacionados" },
  { codigo: "6B06", nome: "Mutismo seletivo", grupo: "Ansiedade e relacionados" },

  // ── Obsessivo-compulsivo e relacionados ───────────────────────────────
  { codigo: "6B20", nome: "Transtorno obsessivo-compulsivo", grupo: "Obsessivo-compulsivo e relacionados" },
  { codigo: "6B21", nome: "Transtorno dismórfico corporal", grupo: "Obsessivo-compulsivo e relacionados" },
  { codigo: "6B24", nome: "Transtorno de acumulação", grupo: "Obsessivo-compulsivo e relacionados" },
  { codigo: "6B25", nome: "Comportamentos repetitivos focados no corpo (tricotilomania/escoriação)", grupo: "Obsessivo-compulsivo e relacionados" },

  // ── Trauma e estresse ─────────────────────────────────────────────────
  { codigo: "6B40", nome: "Transtorno de estresse pós-traumático (TEPT)", grupo: "Trauma e estresse" },
  { codigo: "6B41", nome: "TEPT complexo", grupo: "Trauma e estresse" },
  { codigo: "6B43", nome: "Transtorno de ajustamento", grupo: "Trauma e estresse" },
  { codigo: "6B44", nome: "Transtorno de apego reativo", grupo: "Trauma e estresse" },
  { codigo: "6B45", nome: "Transtorno de interação social desinibida", grupo: "Trauma e estresse" },

  // ── Alimentares ───────────────────────────────────────────────────────
  { codigo: "6B80", nome: "Anorexia nervosa", grupo: "Alimentares" },
  { codigo: "6B81", nome: "Bulimia nervosa", grupo: "Alimentares" },
  { codigo: "6B82", nome: "Transtorno de compulsão alimentar", grupo: "Alimentares" },
  { codigo: "6B83", nome: "Transtorno restritivo/evitativo da ingestão (ARFID)", grupo: "Alimentares" },
  { codigo: "6B84", nome: "Pica", grupo: "Alimentares" },
  { codigo: "6B85", nome: "Transtorno de ruminação-regurgitação", grupo: "Alimentares" },

  // ── Eliminação ────────────────────────────────────────────────────────
  { codigo: "6C00", nome: "Enurese", grupo: "Eliminação" },
  { codigo: "6C01", nome: "Encoprese", grupo: "Eliminação" },

  // ── Sono-vigília ──────────────────────────────────────────────────────
  { codigo: "7A00", nome: "Insônia crônica", grupo: "Sono-vigília" },
  { codigo: "7A01", nome: "Insônia de curto prazo", grupo: "Sono-vigília" },
  { codigo: null, nome: "Sonolência excessiva / hipersonia", grupo: "Sono-vigília" },

  // ── Comportamento disruptivo ──────────────────────────────────────────
  { codigo: "6C90", nome: "Transtorno de oposição desafiante", grupo: "Comportamento disruptivo" },
  { codigo: "6C91", nome: "Transtorno de conduta-dissocial", grupo: "Comportamento disruptivo" },

  // ── Tiques ────────────────────────────────────────────────────────────
  { codigo: "8A05.00", nome: "Síndrome de Tourette", grupo: "Tiques" },
  { codigo: "8A05.0", nome: "Transtornos de tique", grupo: "Tiques" },

  // ── Psicose ───────────────────────────────────────────────────────────
  { codigo: "6A20", nome: "Esquizofrenia", grupo: "Psicose" },
  { codigo: "6A21", nome: "Transtorno esquizoafetivo", grupo: "Psicose" },

  // ── Personalidade ─────────────────────────────────────────────────────
  { codigo: "6D10", nome: "Transtorno de personalidade", grupo: "Personalidade" },

  // ── Neurocognitivo (adulto/idoso) ─────────────────────────────────────
  { codigo: "6D71", nome: "Transtorno neurocognitivo leve", grupo: "Neurocognitivo" },
  { codigo: "6D80", nome: "Demência por doença de Alzheimer", grupo: "Neurocognitivo" },
  { codigo: "6D81", nome: "Demência por doença cerebrovascular", grupo: "Neurocognitivo" },
];

export const CID11_GRUPOS = Array.from(new Set(CID11_CATALOGO.map((c) => c.grupo)));

export function buscarCid11(termo: string): Cid11[] {
  const t = termo.trim().toLowerCase();
  if (!t) return CID11_CATALOGO;
  return CID11_CATALOGO.filter(
    (c) => (c.codigo ?? "").toLowerCase().includes(t) || c.nome.toLowerCase().includes(t) || c.grupo.toLowerCase().includes(t),
  );
}
