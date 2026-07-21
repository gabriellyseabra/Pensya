import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENEROS = new Set(["feminino", "masculino", "outro", "nao_informar"]);
const MODELOS_PAGAMENTO = new Set(["mensalidade", "sessao", "pacote", "convenio"]);

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const criarPacientesEmLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      pacientes: z.array(z.object({
        nome: z.string().min(1),
        data_nascimento: z.string().optional().nullable(),
        genero: z.string().optional().nullable(),
        cpf: z.string().optional().nullable(),
        documento: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        endereco: z.string().optional().nullable(),
        escola: z.string().optional().nullable(),
        escolaridade: z.string().optional().nullable(),
        serie_curso: z.string().optional().nullable(),
        contato_escola: z.string().optional().nullable(),
        responsavel_nome: z.string().optional().nullable(),
        responsavel_telefone: z.string().optional().nullable(),
        responsavel_email: z.string().optional().nullable(),
        responsavel_documento: z.string().optional().nullable(),
        responsavel_parentesco: z.string().optional().nullable(),
        convenio: z.string().optional().nullable(),
        queixa_principal: z.string().optional().nullable(),
        expectativas: z.string().optional().nullable(),
        observacoes: z.string().optional().nullable(),
        data_inicio: z.string().optional().nullable(),
        modelo_pagamento: z.string().optional().nullable(),
        valor_acordado: z.union([z.number(), z.string()]).optional().nullable(),
        dia_vencimento: z.union([z.number(), z.string()]).optional().nullable(),
        numero_parcelas: z.union([z.number(), z.string()]).optional().nullable(),
      })),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Cache de escolas (cria sob demanda)
    const { data: escolasExistentes } = await supabase.from("escolas").select("id, nome");
    const escolaMap = new Map<string, string>();
    (escolasExistentes ?? []).forEach((e: any) => escolaMap.set(e.nome.trim().toLowerCase(), e.id));

    let criados = 0;
    let escolasCriadas = 0;
    const erros: { nome: string; erro: string }[] = [];

    for (const p of data.pacientes) {
      try {
        let escola_id: string | null = null;
        if (p.escola) {
          const key = p.escola.trim().toLowerCase();
          escola_id = escolaMap.get(key) ?? null;
          if (!escola_id) {
            const { data: nova } = await supabase
              .from("escolas").insert({ nome: p.escola.trim() })
              .select("id").single();
            if (nova) { escola_id = nova.id; escolaMap.set(key, nova.id); escolasCriadas++; }
          }
        }

        const genero = p.genero && GENEROS.has(p.genero) ? p.genero : null;
        const modelo_pagamento = p.modelo_pagamento && MODELOS_PAGAMENTO.has(p.modelo_pagamento) ? p.modelo_pagamento : null;

        const { data: pac, error } = await supabase.from("pacientes").insert({
          nome: p.nome.trim(),
          data_nascimento: p.data_nascimento || null,
          genero,
          cpf: p.cpf || null,
          documento: p.documento || null,
          email: p.email || null,
          endereco: p.endereco || null,
          escola_id,
          escolaridade: p.escolaridade || null,
          serie_curso: p.serie_curso || null,
          contato_escola: p.contato_escola || null,
          queixa_principal: p.queixa_principal || null,
          expectativas: p.expectativas || null,
          observacoes: [p.convenio ? `Convênio: ${p.convenio}` : null, p.observacoes].filter(Boolean).join("\n") || null,
          telefone: p.responsavel_telefone || null,
          data_inicio: p.data_inicio || null,
          modelo_pagamento,
          valor_acordado: numOrNull(p.valor_acordado),
          dia_vencimento: numOrNull(p.dia_vencimento),
          numero_parcelas: numOrNull(p.numero_parcelas),
          status: "ativo",
        }).select("id").single();
        if (error || !pac) throw new Error(error?.message ?? "insert falhou");

        if (p.responsavel_nome) {
          await supabase.from("responsaveis").insert({
            paciente_id: pac.id,
            nome: p.responsavel_nome,
            telefone: p.responsavel_telefone || null,
            email: p.responsavel_email || null,
            documento: p.responsavel_documento || null,
            parentesco: p.responsavel_parentesco || null,
            principal: true,
          });
        }
        criados++;
      } catch (e: any) {
        erros.push({ nome: p.nome, erro: e.message ?? String(e) });
      }
    }

    return { criados, escolasCriadas, erros };
  });
