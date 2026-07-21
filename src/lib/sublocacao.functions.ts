import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas administradores podem gerenciar sublocação");
}

// ============= Salas =============
export const upsertSala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().trim().min(1),
      cor: z.string().optional().nullable(),
      capacidade: z.number().int().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      ativo: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload: any = {
      nome: data.nome,
      cor: data.cor ?? "#3b82f6",
      capacidade: data.capacidade ?? null,
      observacoes: data.observacoes ?? null,
      ativo: data.ativo ?? true,
    };
    if (data.id) payload.id = data.id;
    const { data: row, error } = await context.supabase
      .from("salas").upsert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const excluirSala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("salas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Sublocadores =============
export const upsertSublocador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      nome: z.string().trim().min(1),
      documento: z.string().optional().nullable(),
      telefone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      especialidade: z.string().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      ativo: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload: any = { ...data, ativo: data.ativo ?? true };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await context.supabase
      .from("sublocadores").upsert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const excluirSublocador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("sublocadores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Contratos =============
export const upsertContratoSublocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      sublocador_id: z.string().uuid(),
      sala_id: z.string().uuid(),
      modelo: z.enum(["fixo_sessao", "fixo_hora", "percentual", "mensal_extras"]),
      valor_base: z.number().optional().nullable(),
      percentual: z.number().optional().nullable(),
      valor_mensal: z.number().optional().nullable(),
      valor_extra: z.number().optional().nullable(),
      vigencia_inicio: z.string().optional().nullable(),
      vigencia_fim: z.string().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      ativo: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload: any = { ...data, ativo: data.ativo ?? true };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await context.supabase
      .from("sublocacao_contratos").upsert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const excluirContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("sublocacao_contratos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Usos =============
function calcularValor(contrato: any, durMin: number, valorAtend?: number | null) {
  switch (contrato.modelo) {
    case "fixo_sessao":
      return Number(contrato.valor_base ?? 0);
    case "fixo_hora":
      return Number(contrato.valor_base ?? 0) * (durMin / 60);
    case "percentual":
      return ((valorAtend ?? 0) * Number(contrato.percentual ?? 0)) / 100;
    case "mensal_extras":
      return Number(contrato.valor_extra ?? 0);
    default:
      return 0;
  }
}

export const registrarUsoSala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contrato_id: z.string().uuid(),
      data: z.string(),
      inicio: z.string(),
      fim: z.string(),
      valor_atendimento: z.number().optional().nullable(),
      observacoes: z.string().optional().nullable(),
      gerar_lancamento: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabase } = context;

    const { data: contrato, error: eC } = await supabase
      .from("sublocacao_contratos")
      .select("*, sublocador:sublocadores(nome), sala:salas(nome)")
      .eq("id", data.contrato_id)
      .single();
    if (eC || !contrato) throw new Error("Contrato não encontrado");

    const durMin = Math.max(
      0,
      Math.round((new Date(data.fim).getTime() - new Date(data.inicio).getTime()) / 60000),
    );
    const valor = calcularValor(contrato, durMin, data.valor_atendimento);

    let lancamento_id: string | null = null;
    if (data.gerar_lancamento && valor > 0) {
      const { data: lanc, error: eL } = await supabase
        .from("lancamentos_financeiros")
        .insert({
          tipo: "receita",
          status: "previsto",
          descricao: `Sublocação ${contrato.sala?.nome ?? ""} - ${contrato.sublocador?.nome ?? ""} (${data.data})`,
          valor,
          competencia: data.data,
          vencimento: data.data,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (!eL && lanc) lancamento_id = lanc.id;
    }

    const { data: uso, error } = await supabase
      .from("sublocacao_usos")
      .insert({
        contrato_id: data.contrato_id,
        sala_id: contrato.sala_id,
        sublocador_id: contrato.sublocador_id,
        data: data.data,
        inicio: data.inicio,
        fim: data.fim,
        duracao_min: durMin,
        valor_atendimento: data.valor_atendimento ?? null,
        valor_calculado: valor,
        lancamento_id,
        observacoes: data.observacoes ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return uso;
  });

export const excluirUsoSala = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: uso } = await context.supabase
      .from("sublocacao_usos").select("lancamento_id").eq("id", data.id).single();
    if (uso?.lancamento_id) {
      await context.supabase.from("lancamentos_financeiros").delete().eq("id", uso.lancamento_id);
    }
    const { error } = await context.supabase.from("sublocacao_usos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Disponibilidade =============
export const upsertDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      sala_id: z.string().uuid(),
      inicio: z.string(),
      fim: z.string(),
      tipo: z.enum(["disponivel", "bloqueada"]).default("bloqueada"),
      motivo: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload: any = { ...data };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await context.supabase
      .from("sublocacao_disponibilidade").upsert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const excluirDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("sublocacao_disponibilidade").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cria múltiplas disponibilidades a partir de uma recorrência semanal.
export const criarDisponibilidadeRecorrente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      sala_id: z.string().uuid(),
      tipo: z.enum(["disponivel", "bloqueada"]).default("disponivel"),
      motivo: z.string().optional().nullable(),
      data_inicio: z.string(), // YYYY-MM-DD
      data_fim: z.string(),    // YYYY-MM-DD
      hora_inicio: z.string(), // HH:mm
      hora_fim: z.string(),    // HH:mm
      dias_semana: z.array(z.number().int().min(0).max(6)).min(1), // 0=dom .. 6=sab
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const rows: any[] = [];
    const start = new Date(`${data.data_inicio}T00:00:00`);
    const end = new Date(`${data.data_fim}T00:00:00`);
    if (end < start) throw new Error("Data fim anterior à data início");
    const max = 366;
    let count = 0;
    const recJson = {
      tipo: "weekly",
      dias_semana: data.dias_semana,
      hora_inicio: data.hora_inicio,
      hora_fim: data.hora_fim,
      ate: data.data_fim,
    };
    for (let d = new Date(start); d <= end && count < max; d.setDate(d.getDate() + 1)) {
      if (!data.dias_semana.includes(d.getDay())) continue;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      rows.push({
        sala_id: data.sala_id,
        tipo: data.tipo,
        motivo: data.motivo ?? null,
        inicio: new Date(`${ymd}T${data.hora_inicio}:00`).toISOString(),
        fim: new Date(`${ymd}T${data.hora_fim}:00`).toISOString(),
        recorrencia_json: recJson,
      });
      count++;
    }
    if (rows.length === 0) throw new Error("Nenhuma data gerada — revise dias da semana");
    const { error } = await context.supabase.from("sublocacao_disponibilidade").insert(rows);
    if (error) throw new Error(error.message);
    return { criados: rows.length };
  });
