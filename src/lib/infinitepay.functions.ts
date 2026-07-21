import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const gerarLinkCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pagamentoId: string }) =>
    z.object({ pagamentoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { criarCobrancaInfinitepay } = await import("./infinitepay.server");

    const { data: pag, error } = await supabase
      .from("pagamentos")
      .select("id, valor, observacoes, paciente:pacientes(nome, email)")
      .eq("id", data.pagamentoId)
      .single();
    if (error || !pag) throw new Error("Pagamento não encontrado");

    const { data: cfg } = await supabase
      .from("infinitepay_config")
      .select("handle, ativo")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (!cfg?.handle) throw new Error("Configure a InfinitePay em Configurações antes.");

    const paciente: any = pag.paciente;
    const result = await criarCobrancaInfinitepay({
      handle: cfg.handle,
      valorCentavos: Math.round(Number(pag.valor) * 100),
      descricao: pag.observacoes || `Parcela ${pag.id.slice(0, 8)}`,
      externalId: pag.id,
      customerName: paciente?.nome,
      customerEmail: paciente?.email,
    });

    const { error: upErr } = await supabase
      .from("pagamentos")
      .update({
        infinitepay_invoice_id: result.invoiceId,
        infinitepay_checkout_url: result.checkoutUrl,
        infinitepay_status: "pending",
      })
      .eq("id", data.pagamentoId);
    if (upErr) throw upErr;

    return result;
  });

export const testarConexaoInfinitepayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { testarConexaoInfinitepay } = await import("./infinitepay.server");
    return testarConexaoInfinitepay();
  });

export const listarTransacoesInfinitepayFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listarTransacoesInfinitepay } = await import("./infinitepay.server");
    return listarTransacoesInfinitepay(100);
  });

export const sincronizarPagamentosInfinitepay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarTransacoesInfinitepay } = await import("./infinitepay.server");
    const transacoes = await listarTransacoesInfinitepay(100);
    const { supabase } = context;
    let atualizados = 0;
    for (const t of transacoes) {
      const status = t.status ?? t.state;
      const externalId = t.external_id ?? t.metadata?.external_id;
      if (!externalId) continue;
      if (status === "paid" || status === "succeeded") {
        const { error } = await supabase
          .from("pagamentos")
          .update({
            status: "pago",
            pago_em: (t.paid_at ?? t.updated_at ?? new Date().toISOString()).slice(0, 10),
            valor_recebido: t.amount_paid ? Number(t.amount_paid) / 100 : undefined,
            taxa_infinitepay: t.fee ? Number(t.fee) / 100 : undefined,
            infinitepay_status: "paid",
            forma_pagamento: t.payment_method ?? "infinitepay",
          })
          .eq("id", externalId)
          .neq("status", "pago");
        if (!error) atualizados++;
      }
    }
    await supabase
      .from("infinitepay_config")
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq("ativo", true);
    return { atualizados, total: transacoes.length };
  });
