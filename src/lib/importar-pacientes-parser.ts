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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const RESP_TOKENS = ["responsavel", "mae", "pai"];
const has = (h: string, ...tokens: string[]) => tokens.some((t) => h.includes(t));
const hasResp = (h: string) => has(h, ...RESP_TOKENS);

// Regras avaliadas em ordem — a primeira que bater define o campo do cabeçalho.
const HEADER_RULES: { field: keyof PacienteImportRow; test: (h: string) => boolean }[] = [
  { field: "contato_escola", test: (h) => has(h, "escola") && has(h, "telefone", "contato", "fone") },
  { field: "responsavel_telefone", test: (h) => has(h, "telefone", "celular", "whatsapp", "fone", "contato") },
  { field: "responsavel_email", test: (h) => has(h, "email", "e mail") && hasResp(h) },
  { field: "email", test: (h) => has(h, "email", "e mail") },
  { field: "responsavel_documento", test: (h) => has(h, "cpf", "documento", "rg") && hasResp(h) },
  { field: "cpf", test: (h) => has(h, "cpf") },
  { field: "documento", test: (h) => has(h, "documento", "rg") },
  { field: "responsavel_parentesco", test: (h) => has(h, "parentesco") },
  { field: "responsavel_nome", test: (h) => hasResp(h) },
  { field: "data_nascimento", test: (h) => has(h, "nascimento", "dn", "dob") },
  { field: "genero", test: (h) => has(h, "genero", "sexo") },
  { field: "escolaridade", test: (h) => has(h, "escolaridade") },
  { field: "escola", test: (h) => has(h, "escola", "colegio") },
  { field: "serie_curso", test: (h) => has(h, "serie", "ano", "turma", "curso") },
  { field: "endereco", test: (h) => has(h, "endereco") },
  { field: "convenio", test: (h) => has(h, "convenio", "plano de saude") },
  { field: "queixa_principal", test: (h) => has(h, "queixa") },
  { field: "expectativas", test: (h) => has(h, "expectativa") },
  { field: "data_inicio", test: (h) => has(h, "inicio") },
  { field: "modelo_pagamento", test: (h) => has(h, "modelo de pagamento", "modelo pagamento", "forma de pagamento", "forma pagamento") },
  { field: "valor_acordado", test: (h) => has(h, "valor", "mensalidade") },
  { field: "dia_vencimento", test: (h) => has(h, "vencimento") },
  { field: "numero_parcelas", test: (h) => has(h, "parcela") },
  { field: "observacoes", test: (h) => has(h, "observa", "obs", "nota") },
  { field: "nome", test: (h) => has(h, "nome", "aluno", "paciente", "crianca") },
];

function mapHeader(raw: string): keyof PacienteImportRow | null {
  const h = normalizeHeader(raw);
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
  const cleaned = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(,|$))/g, "").replace(",", ".");
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

const DATE_FIELDS = new Set<keyof PacienteImportRow>(["data_nascimento", "data_inicio"]);
const NUMBER_FIELDS = new Set<keyof PacienteImportRow>(["valor_acordado", "dia_vencimento", "numero_parcelas"]);

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
    const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (records.length === 0) continue;

    const headerKeys = Object.keys(records[0]);
    const fieldByHeader = new Map<string, keyof PacienteImportRow>();
    for (const h of headerKeys) {
      const field = mapHeader(h);
      if (field && !fieldByHeader.has(h)) fieldByHeader.set(h, field);
    }

    for (const record of records) {
      const row: PacienteImportRow = { nome: "" };
      for (const [header, value] of Object.entries(record)) {
        const field = fieldByHeader.get(header);
        if (!field) continue;
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
