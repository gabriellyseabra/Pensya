import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/infinitepay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature =
          request.headers.get("x-infinitepay-signature") ??
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-signature");

        const { verifyWebhookSignature } = await import("@/lib/infinitepay.server");
        if (!verifyWebhookSignature(raw, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try { payload = JSON.parse(raw); } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const eventId = String(payload.id ?? payload.event_id ?? `${Date.now()}-${Math.random()}`);
        const tipo = String(payload.type ?? payload.event ?? "unknown");
        const obj = payload.data ?? payload.invoice ?? payload.payment ?? payload;
        const externalId: string | undefined = obj.external_id ?? obj.metadata?.external_id ?? obj.reference;
        const status = obj.status ?? obj.state;

        // idempotência
        const { data: existente } = await supabaseAdmin
          .from("infinitepay_eventos")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();
        if (existente) return new Response("ok (dup)", { status: 200 });

        let pagamentoId: string | null = null;
        let erro: string | null = null;

        if (externalId) {
          try {
            if (tipo.includes("paid") || tipo.includes("succeeded") || status === "paid" || status === "succeeded") {
              const { error } = await supabaseAdmin
                .from("pagamentos")
                .update({
                  status: "pago",
                  pago_em: (obj.paid_at ?? new Date().toISOString()).slice(0, 10),
                  valor_recebido: obj.amount_paid ? Number(obj.amount_paid) / 100 : undefined,
                  taxa_infinitepay: obj.fee ? Number(obj.fee) / 100 : undefined,
                  infinitepay_status: "paid",
                  forma_pagamento: obj.payment_method ?? "infinitepay",
                })
                .eq("id", externalId);
              if (error) erro = error.message;
              else pagamentoId = externalId;
            } else if (tipo.includes("refund") || status === "refunded") {
              await supabaseAdmin
                .from("pagamentos")
                .update({ infinitepay_status: "refunded", status: "pendente" })
                .eq("id", externalId);
              pagamentoId = externalId;
            } else if (tipo.includes("fail") || status === "failed") {
              await supabaseAdmin
                .from("pagamentos")
                .update({ infinitepay_status: "failed" })
                .eq("id", externalId);
              pagamentoId = externalId;
            }
          } catch (e: any) {
            erro = e?.message ?? String(e);
          }
        }

        await supabaseAdmin.from("infinitepay_eventos").insert({
          event_id: eventId,
          tipo,
          payload,
          pagamento_id: pagamentoId,
          status_processamento: erro ? "erro" : "processado",
          erro,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
