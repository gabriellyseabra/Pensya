// Helpers server-only para a InfinitePay.
// Documentação ainda em validação pelo usuário — endpoints e formato
// do webhook podem precisar de ajuste fino quando a conta for confirmada.

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.infinitepay.io";

export function getInfinitepayToken(): string {
  const t = process.env.INFINITEPAY_API_TOKEN;
  if (!t) throw new Error("INFINITEPAY_API_TOKEN não configurada");
  return t;
}

export function getInfinitepayWebhookSecret(): string {
  const s = process.env.INFINITEPAY_WEBHOOK_SECRET;
  if (!s) throw new Error("INFINITEPAY_WEBHOOK_SECRET não configurada");
  return s;
}

/** Valida assinatura HMAC SHA-256 do webhook. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  let secret: string;
  try { secret = getInfinitepayWebhookSecret(); } catch { return false; }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = Buffer.from(signature.replace(/^sha256=/, ""));
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length) return false;
  try { return timingSafeEqual(sig, exp); } catch { return false; }
}

interface CriarCobrancaParams {
  handle: string;
  valorCentavos: number;
  descricao: string;
  externalId: string;
  customerName?: string;
  customerEmail?: string;
}

interface CobrancaResult {
  invoiceId: string;
  checkoutUrl: string;
}

/**
 * Cria uma cobrança/invoice na InfinitePay.
 * Ajuste o endpoint conforme a documentação confirmada da sua conta.
 */
export async function criarCobrancaInfinitepay(p: CriarCobrancaParams): Promise<CobrancaResult> {
  const token = getInfinitepayToken();
  const res = await fetch(`${API_BASE}/invoices/v1/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      handle: p.handle,
      external_id: p.externalId,
      items: [{ description: p.descricao, quantity: 1, price: p.valorCentavos }],
      customer: p.customerName ? { name: p.customerName, email: p.customerEmail } : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`InfinitePay ${res.status}: ${text || res.statusText}`);
  }
  const data: any = await res.json();
  const invoiceId =
    data.id ?? data.invoice_id ?? data.invoice?.id ?? p.externalId;
  const checkoutUrl =
    data.checkout_url ??
    data.url ??
    data.invoice?.checkout_url ??
    `https://invoice.infinitepay.io/${p.handle}/${invoiceId}`;
  return { invoiceId: String(invoiceId), checkoutUrl: String(checkoutUrl) };
}

export async function testarConexaoInfinitepay(): Promise<{ ok: boolean; status: number; mensagem: string }> {
  try {
    const token = getInfinitepayToken();
    const res = await fetch(`${API_BASE}/invoices/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      ok: res.ok,
      status: res.status,
      mensagem: res.ok ? "Conexão OK" : `Falha: ${res.status} ${res.statusText}`,
    };
  } catch (e: any) {
    return { ok: false, status: 0, mensagem: e?.message ?? "Erro desconhecido" };
  }
}

export async function listarTransacoesInfinitepay(limit = 50): Promise<any[]> {
  const token = getInfinitepayToken();
  const res = await fetch(`${API_BASE}/invoices/v1/invoices?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`InfinitePay ${res.status}`);
  const data: any = await res.json();
  return data.data ?? data.invoices ?? data ?? [];
}
