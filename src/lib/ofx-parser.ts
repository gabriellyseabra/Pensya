// Parser manual de extrato OFX (SGML antigo ou XML 2.x) — sem dependência externa.
// Formato de referência: https://www.ofx.net

export type OfxTransacao = {
  fitid: string;
  data: string; // yyyy-MM-dd
  valor: number; // sinal original (positivo = crédito, negativo = débito)
  descricao: string;
};

export type OfxExtrato = {
  transacoes: OfxTransacao[];
  periodoInicio: string | null;
  periodoFim: string | null;
};

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}>\\s*([^\\r\\n<]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function parseOfxValor(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/** Hash simples e estável para servir de FITID quando o banco não informa um. */
function hashFallback(...parts: string[]): string {
  const s = parts.join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `gen-${(h >>> 0).toString(36)}`;
}

export function parseOFX(texto: string): OfxExtrato {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];

  const transacoes: OfxTransacao[] = blocos.map((bloco) => {
    const data = parseOfxDate(tag(bloco, "DTPOSTED"));
    const valor = parseOfxValor(tag(bloco, "TRNAMT"));
    const nome = tag(bloco, "NAME") ?? tag(bloco, "PAYEE") ?? "";
    const memo = tag(bloco, "MEMO") ?? "";
    const descricao = (nome && memo && memo !== nome ? `${nome} - ${memo}` : nome || memo) || "Transação sem descrição";
    const fitidRaw = tag(bloco, "FITID");
    const fitid = fitidRaw && fitidRaw.trim() ? fitidRaw.trim() : hashFallback(data ?? "", String(valor), descricao);

    return {
      fitid,
      data: data ?? "",
      valor,
      descricao,
    };
  }).filter((t) => t.data && t.valor !== 0);

  const inicioTag = texto.match(/<DTSTART>\s*([^\r\n<]*)/i)?.[1] ?? null;
  const fimTag = texto.match(/<DTEND>\s*([^\r\n<]*)/i)?.[1] ?? null;
  const datas = transacoes.map((t) => t.data).sort();

  return {
    transacoes,
    periodoInicio: parseOfxDate(inicioTag) ?? datas[0] ?? null,
    periodoFim: parseOfxDate(fimTag) ?? datas[datas.length - 1] ?? null,
  };
}
