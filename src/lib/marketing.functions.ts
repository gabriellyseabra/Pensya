import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const converterLeadEmPaciente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead, error: e1 } = await supabase
      .from("leads")
      .select("*")
      .eq("id", data.leadId)
      .single();
    if (e1 || !lead) throw new Error(e1?.message ?? "Lead não encontrado");
    if (lead.paciente_id_criado) throw new Error("Lead já foi convertido");

    const { data: etapaGanho } = await supabase
      .from("pipeline_etapas")
      .select("id")
      .eq("tipo", "ganho")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    const { data: novoPac, error: e2 } = await supabase
      .from("pacientes")
      .insert({
        nome: lead.nome_paciente || lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        observacoes: lead.observacoes,
        status: "ativo",
        lead_origem_id: lead.id,
        canal_origem_id: lead.canal_id,
        campanha_origem_id: lead.campanha_id,
        origem_criacao: "lead_marketing",
        data_conversao_marketing: now,
      })
      .select("id")
      .single();
    if (e2 || !novoPac) throw new Error(e2?.message ?? "Erro ao criar paciente");

    if (lead.telefone || lead.email) {
      await supabase.from("responsaveis").insert({
        paciente_id: novoPac.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        principal: true,
      });
    }

    await supabase.from("leads").update({
      paciente_id_criado: novoPac.id,
      convertido_em: now,
      ...(etapaGanho?.id ? { etapa_id: etapaGanho.id, etapa_atualizada_em: now } : {}),
    }).eq("id", lead.id);

    await supabase.from("lead_interacoes").insert({
      lead_id: lead.id,
      tipo: "conversao",
      descricao: "Lead convertido em paciente.",
      etapa_anterior_id: lead.etapa_id,
      etapa_nova_id: etapaGanho?.id ?? lead.etapa_id,
    });

    return { pacienteId: novoPac.id };
  });
