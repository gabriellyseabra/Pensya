import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENEROS = new Set(["feminino", "masculino", "outro", "nao_informar"]);
const MODELOS_PAGAMENTO = new Set(["mensalidade", "sessao", "pacote", "convenio"]);
const STATUS_VALIDOS = new Set(["ativo", "pausado", "alta", "interrompido"]);

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "Gabrielly (psicopedagoga)" → "Gabrielly". Pega o 1º nome quando há vários. */
function limparNomeProfissional(v: string): string {
  return v
    .split(/[,;/]/)[0]
    .replace(/\([^)]*\)/g, "")
    .trim();
}

/** Status do SisClin/genérico → status interno do Pensya. */
function normalizarStatus(v: unknown): string {
  const h = norm(String(v ?? ""));
  if (!h) return "ativo";
  if (STATUS_VALIDOS.has(h)) return h;
  if (h.includes("inativ") || h.includes("interromp") || h.includes("desligad"))
    return "interrompido";
  if (h.includes("pausa") || h.includes("suspens")) return "pausado";
  if (h.includes("alta")) return "alta";
  if (h.includes("ativ")) return "ativo";
  return "ativo";
}

export const criarPacientesEmLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pacientes: z.array(
          z.object({
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
            responsavel2_nome: z.string().optional().nullable(),
            profissional_responsavel: z.string().optional().nullable(),
            especialidade: z.string().optional().nullable(),
            diagnostico: z.string().optional().nullable(),
            modalidade: z.string().optional().nullable(),
            local_atendimento: z.string().optional().nullable(),
            status: z.string().optional().nullable(),
            data_ultima_avaliacao: z.string().optional().nullable(),
            data_alta: z.string().optional().nullable(),
            convenio: z.string().optional().nullable(),
            queixa_principal: z.string().optional().nullable(),
            expectativas: z.string().optional().nullable(),
            observacoes: z.string().optional().nullable(),
            data_inicio: z.string().optional().nullable(),
            modelo_pagamento: z.string().optional().nullable(),
            valor_acordado: z.union([z.number(), z.string()]).optional().nullable(),
            dia_vencimento: z.union([z.number(), z.string()]).optional().nullable(),
            numero_parcelas: z.union([z.number(), z.string()]).optional().nullable(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // ---- Caches de catálogos (criam sob demanda quando fizer sentido) ----
    const { data: escolasExistentes } = await supabase.from("escolas").select("id, nome");
    const escolaMap = new Map<string, string>();
    (escolasExistentes ?? []).forEach((e: any) => escolaMap.set(norm(e.nome), e.id));

    const { data: modalidadesExistentes } = await supabase.from("modalidades").select("id, nome");
    const modalidadeMap = new Map<string, string>();
    (modalidadesExistentes ?? []).forEach((m: any) => modalidadeMap.set(norm(m.nome), m.id));

    const { data: profissionaisExistentes } = await supabase
      .from("profissionais_consultorio")
      .select("id, nome");
    // Casamento por nome: normalizado exato e por 1º nome, para tolerar
    // "Gabrielly" ↔ "Gabrielly Seabra".
    const profExato = new Map<string, string>();
    const profPrimeiroNome = new Map<string, string>();
    (profissionaisExistentes ?? []).forEach((p: any) => {
      const n = norm(p.nome);
      profExato.set(n, p.id);
      const primeiro = n.split(" ")[0];
      if (primeiro && !profPrimeiroNome.has(primeiro)) profPrimeiroNome.set(primeiro, p.id);
    });

    const { data: diagsExistentes } = await supabase.from("diagnosticos").select("id, nome");
    const diagMap = new Map<string, string>();
    (diagsExistentes ?? []).forEach((d: any) => diagMap.set(norm(d.nome), d.id));

    async function resolverEscola(nome?: string | null): Promise<string | null> {
      if (!nome?.trim()) return null;
      const key = norm(nome);
      if (escolaMap.has(key)) return escolaMap.get(key)!;
      const { data: nova } = await supabase
        .from("escolas")
        .insert({ nome: nome.trim() })
        .select("id")
        .single();
      if (nova) {
        escolaMap.set(key, nova.id);
        return nova.id;
      }
      return null;
    }

    function resolverModalidade(nome?: string | null): string | null {
      if (!nome?.trim()) return null;
      return modalidadeMap.get(norm(nome)) ?? null;
    }

    function resolverProfissional(valor?: string | null): string | null {
      if (!valor?.trim()) return null;
      const nome = limparNomeProfissional(valor);
      const n = norm(nome);
      if (!n) return null;
      return profExato.get(n) ?? profPrimeiroNome.get(n.split(" ")[0]) ?? null;
    }

    // "Em investigação", "suspeita", "a investigar"... não são diagnósticos —
    // viram hipótese diagnóstica no paciente, sem poluir o catálogo.
    const INVESTIG = [
      "investiga",
      "suspeita",
      "hipotese",
      "aguardando",
      "a definir",
      "sem diagnostico",
      "nao diagnosticado",
    ];
    const ehInvestigacao = (nome: string) => INVESTIG.some((t) => norm(nome).includes(t));

    async function resolverDiagnosticos(
      valor?: string | null,
    ): Promise<{ ids: string[]; hipotese: boolean }> {
      if (!valor?.trim()) return { ids: [], hipotese: false };
      const nomes = valor
        .split(/[,;/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const ids: string[] = [];
      let hipotese = false;
      for (const nomeDiag of nomes) {
        if (ehInvestigacao(nomeDiag)) {
          hipotese = true;
          continue;
        }
        const key = norm(nomeDiag);
        if (diagMap.has(key)) {
          ids.push(diagMap.get(key)!);
          continue;
        }
        const { data: novo } = await supabase
          .from("diagnosticos")
          .insert({ nome: nomeDiag })
          .select("id")
          .single();
        if (novo) {
          diagMap.set(key, novo.id);
          ids.push(novo.id);
        }
      }
      return { ids, hipotese };
    }

    let criados = 0;
    let escolasCriadas = 0;
    const escolasAntes = escolaMap.size;
    const avisos: { nome: string; aviso: string }[] = [];
    const erros: { nome: string; erro: string }[] = [];

    for (const p of data.pacientes) {
      try {
        const escola_id = await resolverEscola(p.escola);
        const modalidade_id = resolverModalidade(p.modalidade);
        const profissional_responsavel_id = resolverProfissional(p.profissional_responsavel);
        const { ids: diagnosticoIds, hipotese: hipoteseDiag } = await resolverDiagnosticos(
          p.diagnostico,
        );

        if (p.modalidade && !modalidade_id) {
          avisos.push({ nome: p.nome, aviso: `Modalidade "${p.modalidade}" não encontrada` });
        }
        if (p.profissional_responsavel && !profissional_responsavel_id) {
          avisos.push({
            nome: p.nome,
            aviso: `Profissional "${p.profissional_responsavel}" não encontrado na equipe`,
          });
        }

        const genero = p.genero && GENEROS.has(p.genero) ? p.genero : null;
        const modelo_pagamento =
          p.modelo_pagamento && MODELOS_PAGAMENTO.has(p.modelo_pagamento)
            ? p.modelo_pagamento
            : null;
        const status = normalizarStatus(p.status);

        // Notas que não têm campo próprio vão para observações.
        const notas = [
          p.convenio ? `Convênio: ${p.convenio}` : null,
          p.especialidade ? `Especialidade: ${p.especialidade}` : null,
          p.local_atendimento ? `Local de atendimento: ${p.local_atendimento}` : null,
          p.profissional_responsavel && !profissional_responsavel_id
            ? `Profissional responsável (importado): ${p.profissional_responsavel}`
            : null,
          p.observacoes || null,
        ].filter(Boolean);

        const { data: pac, error } = await supabase
          .from("pacientes")
          .insert({
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
            modalidade_id,
            profissional_responsavel_id,
            queixa_principal: p.queixa_principal || null,
            expectativas: p.expectativas || null,
            observacoes: notas.join("\n") || null,
            telefone: p.responsavel_telefone || null,
            data_inicio: p.data_inicio || null,
            data_ultima_avaliacao: p.data_ultima_avaliacao || null,
            data_alta: p.data_alta || null,
            modelo_pagamento,
            valor_acordado: numOrNull(p.valor_acordado),
            dia_vencimento: numOrNull(p.dia_vencimento),
            numero_parcelas: numOrNull(p.numero_parcelas),
            // Marca hipótese quando o diagnóstico informado é "em investigação".
            hipotese_diagnostica: hipoteseDiag,
            status,
          })
          .select("id")
          .single();
        if (error || !pac) throw new Error(error?.message ?? "insert falhou");

        // Diagnósticos (N:N)
        if (diagnosticoIds.length) {
          await supabase
            .from("paciente_diagnosticos")
            .insert(
              diagnosticoIds.map((diagnostico_id) => ({ paciente_id: pac.id, diagnostico_id })),
            );
        }

        // Responsáveis
        const responsaveis: any[] = [];
        if (p.responsavel_nome) {
          responsaveis.push({
            paciente_id: pac.id,
            nome: p.responsavel_nome,
            telefone: p.responsavel_telefone || null,
            email: p.responsavel_email || null,
            documento: p.responsavel_documento || null,
            parentesco: p.responsavel_parentesco || null,
            principal: true,
          });
        }
        if (p.responsavel2_nome) {
          responsaveis.push({
            paciente_id: pac.id,
            nome: p.responsavel2_nome,
            principal: responsaveis.length === 0,
          });
        }
        if (responsaveis.length) {
          await supabase.from("responsaveis").insert(responsaveis);
        }

        criados++;
      } catch (e: any) {
        erros.push({ nome: p.nome, erro: e.message ?? String(e) });
      }
    }

    escolasCriadas = escolaMap.size - escolasAntes;
    return { criados, escolasCriadas, avisos, erros };
  });
