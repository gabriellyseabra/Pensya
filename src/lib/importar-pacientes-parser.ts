export type PacienteImportRow = {
  nome: string;
  data_nascimento?: string | null;
  genero?: string | null;
  cpf?: string | null;
  documento?: string | null;
  email?: string | null;
  endereco?: string | null;
  escola?: string | null;
  escolaridade?: string | null;
  serie_curso?: string | null;
  contato_escola?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
  responsavel_email?: string | null;
  responsavel_documento?: string | null;
  responsavel_parentesco?: string | null;
  // Segundo responsável (ex.: coluna "Responsável 2" do SisClin).
  responsavel2_nome?: string | null;
  // Profissional/terapeuta responsável pelo caso (não confundir com o
  // responsável familiar). Casado por nome com a equipe no servidor.
  profissional_responsavel?: string | null;
  especialidade?: string | null;
  diagnostico?: string | null;
  modalidade?: string | null;
  local_atendimento?: string | null;
  status?: string | null;
  data_ultima_avaliacao?: string | null;
  data_alta?: string | null;
  convenio?: string | null;
  queixa_principal?: string | null;
  expectativas?: string | null;
  observacoes?: string | null;
  data_inicio?: string | null;
  modelo_pagamento?: string | null;
  valor_acordado?: number | string | null;
  dia_vencimento?: number | string | null;
  numero_parcelas?: number | string | null;
};

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const RESP_TOKENS = ["responsavel", "mae", "pai", "filiacao"];
const has = (h: string, ...tokens: string[]) => tokens.some((t) => h.includes(t));
// Responsável familiar — mas NÃO "profissional responsável" (terapeuta).
const hasResp = (h: string) => has(h, ...RESP_TOKENS) && !has(h, "profissional");

// Regras avaliadas em ordem — a primeira que bater define o campo do cabeçalho.
// A ordem importa: regras mais específicas vêm antes das genéricas.
const HEADER_RULES: { field: keyof PacienteImportRow; test: (h: string) => boolean }[] = [
  // Profissional/terapeuta responsável — precisa vir ANTES de responsavel_nome,
  // senão "Profissional responsável" cairia como responsável familiar.
  { field: "profissional_responsavel", test: (h) => has(h, "profissional", "terapeuta") },
  { field: "especialidade", test: (h) => has(h, "especialidade") },
  {
    field: "contato_escola",
    test: (h) => has(h, "escola") && has(h, "telefone", "contato", "fone"),
  },
  { field: "responsavel_email", test: (h) => has(h, "email", "e mail") && hasResp(h) },
  { field: "email", test: (h) => has(h, "email", "e mail") },
  { field: "responsavel_documento", test: (h) => has(h, "cpf", "documento", "rg") && hasResp(h) },
  { field: "cpf", test: (h) => has(h, "cpf") },
  { field: "documento", test: (h) => has(h, "documento", "rg") },
  { field: "responsavel_parentesco", test: (h) => has(h, "parentesco") },
  // Segundo responsável (coluna "Responsável 2"/"Responsável II") antes do 1º.
  { field: "responsavel2_nome", test: (h) => hasResp(h) && has(h, "2", "ii", "secundario") },
  {
    field: "responsavel_telefone",
    test: (h) => has(h, "telefone", "celular", "whatsapp", "fone", "contato"),
  },
  { field: "responsavel_nome", test: (h) => hasResp(h) },
  { field: "data_ultima_avaliacao", test: (h) => has(h, "avaliacao") },
  { field: "data_alta", test: (h) => has(h, "alta") },
  { field: "data_nascimento", test: (h) => has(h, "nascimento", "dn", "dob") },
  { field: "genero", test: (h) => has(h, "genero", "sexo") },
  { field: "escolaridade", test: (h) => has(h, "escolaridade") },
  { field: "contato_escola", test: (h) => has(h, "contato da escola") },
  { field: "escola", test: (h) => has(h, "escola", "colegio") },
  { field: "serie_curso", test: (h) => has(h, "serie", "ano", "turma", "curso") },
  { field: "endereco", test: (h) => has(h, "endereco") },
  { field: "diagnostico", test: (h) => has(h, "diagnostico", "hipotese", "cid") },
  { field: "modalidade", test: (h) => has(h, "modalidade") },
  { field: "local_atendimento", test: (h) => has(h, "local") },
  { field: "status", test: (h) => has(h, "status", "situacao") },
  { field: "convenio", test: (h) => has(h, "convenio", "plano de saude") },
  { field: "queixa_principal", test: (h) => has(h, "queixa") },
  { field: "expectativas", test: (h) => has(h, "expectativa") },
  { field: "data_inicio", test: (h) => has(h, "inicio", "entrada", "admissao") },
  {
    field: "modelo_pagamento",
    test: (h) =>
      has(h, "modelo de pagamento", "modelo pagamento", "forma de pagamento", "forma pagamento"),
  },
  { field: "valor_acordado", test: (h) => has(h, "valor", "mensalidade") },
  { field: "dia_vencimento", test: (h) => has(h, "vencimento") },
  { field: "numero_parcelas", test: (h) => has(h, "parcela") },
  { field: "observacoes", test: (h) => has(h, "observa", "obs", "nota") },
  { field: "nome", test: (h) => has(h, "nome", "aluno", "paciente", "crianca") },
];

function mapHeader(raw: string): keyof PacienteImportRow | null {
  const h = normalizeHeader(raw);
  if (!h) return null;
  // "Painel Geral (link)" e "Foto" são colunas de UI do SisClin — ignorar.
  if (has(h, "painel", "foto", "link")) return null;
  for (const rule of HEADER_RULES) {
    if (rule.test(h)) return rule.field;
  }
  return null;
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateValue(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return formatDateLocal(v);
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseNumberValue(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeGenero(v: unknown): string | null {
  if (!v) return null;
  const h = normalizeHeader(String(v));
  if (["f", "fem", "feminino", "menina"].includes(h)) return "feminino";
  if (["m", "masc", "masculino", "menino"].includes(h)) return "masculino";
  if (h) return "outro";
  return null;
}

function normalizeModeloPagamento(v: unknown): string | null {
  if (!v) return null;
  const h = normalizeHeader(String(v));
  if (h.includes("mensal")) return "mensalidade";
  if (h.includes("sessao")) return "sessao";
  if (h.includes("pacote")) return "pacote";
  if (h.includes("convenio")) return "convenio";
  return null;
}

const DATE_FIELDS = new Set<keyof PacienteImportRow>([
  "data_nascimento",
  "data_inicio",
  "data_ultima_avaliacao",
  "data_alta",
]);
const NUMBER_FIELDS = new Set<keyof PacienteImportRow>([
  "valor_acordado",
  "dia_vencimento",
  "numero_parcelas",
]);

/**
 * Localiza a linha de cabeçalho de verdade dentro das primeiras linhas da
 * planilha. Exports do SisClin trazem linhas de título ("Lista de Pacientes")
 * e de grupos ("Informações básicas") antes do cabeçalho real — por isso não
 * dá para assumir que a primeira linha é o cabeçalho. Escolhe a linha que tem
 * uma coluna de nome e o maior número de colunas reconhecidas.
 */
function acharLinhaCabecalho(matriz: unknown[][]): number {
  let melhor = -1;
  let melhorScore = 0;
  const limite = Math.min(matriz.length, 20);
  for (let i = 0; i < limite; i++) {
    const celulas = matriz[i] ?? [];
    let score = 0;
    let temNome = false;
    for (const c of celulas) {
      const campo = mapHeader(String(c ?? ""));
      if (!campo) continue;
      score++;
      if (campo === "nome") temNome = true;
    }
    // Exige coluna de nome e pelo menos 2 outras colunas reconhecidas.
    if (temNome && score >= 3 && score > melhorScore) {
      melhor = i;
      melhorScore = score;
    }
  }
  return melhor;
}

export async function parsearPlanilhaPacientes(file: File): Promise<PacienteImportRow[]> {
  const XLSX = await import("xlsx");
  const nome = file.name.toLowerCase();
  let workbook: ReturnType<typeof XLSX.read>;
  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string", cellDates: true });
  } else {
    const buf = await file.arrayBuffer();
    workbook = XLSX.read(buf, { type: "array", cellDates: true });
  }

  const linhas: PacienteImportRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Lê como matriz (array de arrays), sem assumir onde está o cabeçalho.
    const matriz: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (matriz.length === 0) continue;

    const idxCabecalho = acharLinhaCabecalho(matriz);
    if (idxCabecalho < 0) continue;

    const cabecalhos = (matriz[idxCabecalho] ?? []).map((c) => String(c ?? ""));
    const fieldByCol = new Map<number, keyof PacienteImportRow>();
    cabecalhos.forEach((h, col) => {
      const field = mapHeader(h);
      // Não sobrescreve uma coluna já mapeada para o mesmo campo (mantém a 1ª).
      if (field && ![...fieldByCol.values()].includes(field)) fieldByCol.set(col, field);
    });

    for (let i = idxCabecalho + 1; i < matriz.length; i++) {
      const celulas = matriz[i] ?? [];
      const row: PacienteImportRow = { nome: "" };
      for (const [col, field] of fieldByCol.entries()) {
        const value = celulas[col];
        if (value === "" || value == null) continue;

        if (DATE_FIELDS.has(field)) {
          (row as any)[field] = parseDateValue(value);
        } else if (NUMBER_FIELDS.has(field)) {
          (row as any)[field] = parseNumberValue(value);
        } else if (field === "genero") {
          row.genero = normalizeGenero(value);
        } else if (field === "modelo_pagamento") {
          row.modelo_pagamento = normalizeModeloPagamento(value);
        } else {
          (row as any)[field] = String(value).trim();
        }
      }
      if (row.nome?.trim()) linhas.push(row);
    }
  }

  return linhas;
}
