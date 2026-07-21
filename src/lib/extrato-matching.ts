// Sugestão automática de categoria/paciente para linhas de extrato bancário importado.
// Tudo client-side (mesmo padrão do resto do módulo financeiro) — sem RPC/servidor.

export type SugestaoOrigem = "aprendido" | "nome" | "fornecedor" | "categoria" | null;

export type Sugestao = {
  origem: SugestaoOrigem;
  pacienteId: string | null;
  planoContaId: string | null;
  fornecedorId: string | null;
  tipoServicoId: string | null;
  confianca: number; // 0..1
};

export type IdentificadorRef = {
  padrao: string;
  natureza: "receita" | "despesa";
  paciente_id: string | null;
  plano_conta_id: string | null;
  fornecedor_id: string | null;
  tipo_servico_id: string | null;
};
export type PacienteRef = { id: string; nome: string };
export type ResponsavelRef = { nome: string; paciente_id: string };
export type FornecedorRef = { id: string; nome: string; plano_conta_id: string | null };
export type PlanoContaRef = { id: string; nome: string; tipo: string };
export type SublocadorRef = { id: string; nome: string };

const SEM_SUGESTAO: Sugestao = {
  origem: null,
  pacienteId: null,
  planoContaId: null,
  fornecedorId: null,
  tipoServicoId: null,
  confianca: 0,
};

const RUIDO_EXTRATO = new Set([
  "pix", "ted", "doc", "boleto", "transferencia", "transf", "recebido", "recebida",
  "enviado", "enviada", "credito", "debito", "pagamento", "pagto", "pag", "de", "para",
  "cpf", "cnpj", "compra", "cartao", "deposito", "banco", "conta", "corrente", "poupanca",
  "movimento", "movimentacao", "lancamento", "operacao", "referente", "ref",
]);

export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizar(s).split(" ").filter(Boolean);
}

/** Extrai o provável nome do pagador/recebedor removendo ruído comum de extrato bancário. */
export function extrairNomePagador(descricao: string): string {
  return tokens(descricao)
    .filter((t) => !RUIDO_EXTRATO.has(t) && !(/^\d+$/.test(t) && t.length >= 3))
    .join(" ");
}

/** Similaridade Jaccard simples entre dois textos (via tokens normalizados). */
export function similaridade(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uniao = ta.size + tb.size - inter;
  return uniao === 0 ? 0 : inter / uniao;
}

function melhorIdentificador(padraoAlvo: string, identificadores: IdentificadorRef[], natureza: "receita" | "despesa"): IdentificadorRef | null {
  let melhor: IdentificadorRef | null = null;
  for (const ident of identificadores) {
    if (ident.natureza !== natureza || !ident.padrao) continue;
    if (padraoAlvo.includes(ident.padrao) || ident.padrao.includes(padraoAlvo)) {
      if (!melhor || ident.padrao.length > melhor.padrao.length) melhor = ident;
    }
  }
  return melhor;
}

/**
 * Trecho normalizado usado como chave de aprendizado (extrato_identificadores.padrao).
 * Receita usa o nome do pagador extraído (evita quebrar em "joao de souza" por causa
 * de partículas removidas como "de"/"para" no meio do texto); despesa usa a descrição
 * inteira, já que ali procuramos por fornecedor/categoria contidos na frase.
 */
export function padraoParaAprendizado(descricao: string, natureza: "receita" | "despesa"): string {
  return natureza === "receita" ? extrairNomePagador(descricao) : normalizar(descricao);
}

export function sugerirReceita(
  descricao: string,
  refs: {
    identificadores: IdentificadorRef[]; responsaveis: ResponsavelRef[]; pacientes: PacienteRef[];
    sublocadores?: SublocadorRef[]; planoContas?: PlanoContaRef[];
  }
): Sugestao {
  const nomePagador = extrairNomePagador(descricao);
  const aprendido = melhorIdentificador(nomePagador, refs.identificadores, "receita");
  if (aprendido) {
    return {
      origem: "aprendido",
      pacienteId: aprendido.paciente_id,
      planoContaId: aprendido.plano_conta_id,
      fornecedorId: null,
      tipoServicoId: aprendido.tipo_servico_id,
      confianca: 0.95,
    };
  }

  if (!nomePagador) return SEM_SUGESTAO;

  let melhorScorePaciente = 0;
  let melhorPacienteId: string | null = null;
  for (const r of refs.responsaveis) {
    const score = similaridade(nomePagador, r.nome);
    if (score > melhorScorePaciente) { melhorScorePaciente = score; melhorPacienteId = r.paciente_id; }
  }
  for (const p of refs.pacientes) {
    const score = similaridade(nomePagador, p.nome);
    if (score > melhorScorePaciente) { melhorScorePaciente = score; melhorPacienteId = p.id; }
  }

  let melhorScoreSublocador = 0;
  for (const s of refs.sublocadores ?? []) {
    const score = similaridade(nomePagador, s.nome);
    if (score > melhorScoreSublocador) melhorScoreSublocador = score;
  }

  // Nome bate melhor com sublocadora cadastrada do que com paciente/responsável: sugere categoria Sublocação.
  if (melhorScoreSublocador >= 0.5 && melhorScoreSublocador > melhorScorePaciente) {
    const categoriaSublocacao = (refs.planoContas ?? []).find(
      (pc) => pc.tipo === "receita" && normalizar(pc.nome).includes("subloc"),
    );
    if (categoriaSublocacao) {
      return { ...SEM_SUGESTAO, origem: "nome", planoContaId: categoriaSublocacao.id, confianca: melhorScoreSublocador };
    }
  }

  if (melhorPacienteId && melhorScorePaciente >= 0.5) {
    return { ...SEM_SUGESTAO, origem: "nome", pacienteId: melhorPacienteId, confianca: melhorScorePaciente };
  }
  return SEM_SUGESTAO;
}

export function sugerirDespesa(
  descricao: string,
  refs: { identificadores: IdentificadorRef[]; fornecedores: FornecedorRef[]; planoContas: PlanoContaRef[] }
): Sugestao {
  const descNorm = normalizar(descricao);
  const aprendido = melhorIdentificador(descNorm, refs.identificadores, "despesa");
  if (aprendido) {
    return {
      origem: "aprendido",
      pacienteId: null,
      planoContaId: aprendido.plano_conta_id,
      fornecedorId: aprendido.fornecedor_id,
      tipoServicoId: null,
      confianca: 0.95,
    };
  }

  for (const f of refs.fornecedores) {
    const nomeNorm = normalizar(f.nome);
    if (nomeNorm.length >= 3 && descNorm.includes(nomeNorm)) {
      return { ...SEM_SUGESTAO, origem: "fornecedor", fornecedorId: f.id, planoContaId: f.plano_conta_id, confianca: 0.8 };
    }
  }

  for (const pc of refs.planoContas) {
    if (pc.tipo !== "despesa") continue;
    const palavras = tokens(pc.nome).filter((t) => t.length >= 4);
    if (palavras.some((p) => descNorm.includes(p))) {
      return { ...SEM_SUGESTAO, origem: "categoria", planoContaId: pc.id, confianca: 0.5 };
    }
  }

  return SEM_SUGESTAO;
}
