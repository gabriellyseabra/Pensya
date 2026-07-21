export type HabilidadeImport = { habilidade: string; sub_habilidade: string };

export type SessaoImportRow = {
  data_sessao: string;
  tipo: "avaliacao" | "intervencao";
  duracao_min?: number | null;
  engajamento?: number | null;
  autorregulacao?: number | null;
  nivel_suporte?: string | null;
  recursos_utilizados?: string | null;
  evolucao?: string | null;
  habilidades_trabalhadas: HabilidadeImport[];
  _arquivo: string;
};

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const has = (h: string, ...tokens: string[]) => tokens.some((t) => h.includes(t));

type Field = "data_sessao" | "tipo" | "duracao_min" | "engajamento" | "autorregulacao" | "nivel_suporte" | "recursos_utilizados" | "evolucao" | "habilidades_trabalhadas";

// Regras avaliadas em ordem — a primeira que bater define o campo do cabeçalho.
const HEADER_RULES: { field: Field; test: (h: string) => boolean }[] = [
  { field: "habilidades_trabalhadas", test: (h) => has(h, "habilidade") },
  { field: "data_sessao", test: (h) => has(h, "data") },
  { field: "tipo", test: (h) => has(h, "tipo") },
  { field: "duracao_min", test: (h) => has(h, "duracao", "duração", "minutos") },
  { field: "autorregulacao", test: (h) => has(h, "autorregulacao", "autorregulação") },
  { field: "engajamento", test: (h) => has(h, "engajamento") },
  { field: "nivel_suporte", test: (h) => has(h, "suporte") },
  { field: "recursos_utilizados", test: (h) => has(h, "recurso") },
  { field: "evolucao", test: (h) => has(h, "evolucao", "observa", "resumo", "sintese", "nota") },
];

function mapHeader(raw: string): Field | null {
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

function parseIntInRange(v: unknown, min: number, max: number): number | null {
  if (v == null || v === "") return null;
  const n = Math.round(Number(String(v).replace(",", ".")));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function normalizeTipo(v: unknown): "avaliacao" | "intervencao" {
  const h = normalizeHeader(String(v ?? ""));
  if (h.includes("avalia")) return "avaliacao";
  return "intervencao";
}

const SUPORTE_MAP: { test: (h: string) => boolean; value: string }[] = [
  { test: (h) => has(h, "fisico total", "total"), value: "fisico_total" },
  { test: (h) => has(h, "fisico parcial", "parcial", "fisico"), value: "fisico_parcial" },
  { test: (h) => has(h, "gestual"), value: "gestual" },
  { test: (h) => has(h, "verbal"), value: "verbal" },
  { test: (h) => has(h, "independente"), value: "independente" },
];

function normalizeNivelSuporte(v: unknown): string | null {
  if (!v) return null;
  const h = normalizeHeader(String(v));
  for (const r of SUPORTE_MAP) if (r.test(h)) return r.value;
  return null;
}

function parseHabilidades(v: unknown): HabilidadeImport[] {
  if (!v) return [];
  const texto = String(v).trim();
  if (!texto) return [];
  return texto
    .split(/[;,\n]+/)
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.split(/\s+-\s+|:\s*/);
      if (m.length >= 2) {
        return { habilidade: m[0].trim(), sub_habilidade: m.slice(1).join(" - ").trim() };
      }
      return { habilidade: tok, sub_habilidade: "" };
    })
    .filter((h) => h.habilidade);
}

async function parsearArquivo(file: File): Promise<SessaoImportRow[]> {
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

  const linhas: SessaoImportRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (records.length === 0) continue;

    const headerKeys = Object.keys(records[0]);
    const fieldByHeader = new Map<string, Field>();
    for (const h of headerKeys) {
      const field = mapHeader(h);
      if (field && !fieldByHeader.has(h)) fieldByHeader.set(h, field);
    }

    for (const record of records) {
      const row: Partial<SessaoImportRow> = {};
      for (const [header, value] of Object.entries(record)) {
        const field = fieldByHeader.get(header);
        if (!field) continue;
        if (value === "" || value == null) continue;

        switch (field) {
          case "data_sessao":
            row.data_sessao = parseDateValue(value) ?? undefined;
            break;
          case "tipo":
            row.tipo = normalizeTipo(value);
            break;
          case "duracao_min":
            row.duracao_min = parseIntInRange(value, 1, 600);
            break;
          case "engajamento":
            row.engajamento = parseIntInRange(value, 1, 5);
            break;
          case "autorregulacao":
            row.autorregulacao = parseIntInRange(value, 1, 5);
            break;
          case "nivel_suporte":
            row.nivel_suporte = normalizeNivelSuporte(value);
            break;
          case "recursos_utilizados":
            row.recursos_utilizados = String(value).trim();
            break;
          case "evolucao":
            row.evolucao = String(value).trim();
            break;
          case "habilidades_trabalhadas":
            row.habilidades_trabalhadas = parseHabilidades(value);
            break;
        }
      }
      if (!row.data_sessao) continue;
      linhas.push({
        data_sessao: row.data_sessao,
        tipo: row.tipo ?? "intervencao",
        duracao_min: row.duracao_min ?? null,
        engajamento: row.engajamento ?? null,
        autorregulacao: row.autorregulacao ?? null,
        nivel_suporte: row.nivel_suporte ?? null,
        recursos_utilizados: row.recursos_utilizados ?? null,
        evolucao: row.evolucao ?? null,
        habilidades_trabalhadas: row.habilidades_trabalhadas ?? [],
        _arquivo: file.name,
      });
    }
  }

  return linhas;
}

/** Faz o parsing de uma ou mais planilhas de sessões antigas, agregando todas as linhas identificadas. */
export async function parsearPlanilhasSessoes(files: File[]): Promise<SessaoImportRow[]> {
  const resultados = await Promise.all(files.map(parsearArquivo));
  return resultados.flat().sort((a, b) => a.data_sessao.localeCompare(b.data_sessao));
}
