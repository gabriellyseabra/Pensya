import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Pendencia = {
  key: string;
  label: string;
  /** Destino na ficha: ?aba= / ?sub= */
  aba: string;
  sub?: string;
};

export type JornadaEtapa = "cadastro" | "anamnese" | "avaliacao" | "plano" | "acompanhamento";

export const ETAPAS: { key: JornadaEtapa; label: string }[] = [
  { key: "cadastro", label: "Cadastro" },
  { key: "anamnese", label: "Anamnese" },
  { key: "avaliacao", label: "Avaliação" },
  { key: "plano", label: "Plano" },
  { key: "acompanhamento", label: "Acompanhamento" },
];

async function contar(tabela: string, filtro: (q: any) => any): Promise<number> {
  try {
    const { count, error } = await filtro(
      supabase.from(tabela as any).select("id", { count: "exact", head: true }),
    );
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Jornada e completude do paciente, computadas dos dados existentes
 * (sem tabela nova). Alimenta o PacienteJornadaCard no Resumo.
 */
export function usePacienteCompletude(pacienteId: string) {
  const { data } = useQuery({
    queryKey: ["paciente-completude", pacienteId],
    enabled: !!pacienteId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [{ data: p }, responsaveis, preAnamnese, avaliacoes, planos, sessoes] =
        await Promise.all([
          supabase
            .from("pacientes")
            .select("data_nascimento, telefone, queixa_principal, modalidade_id, profissional_responsavel_id, modelo_pagamento")
            .eq("id", pacienteId)
            .maybeSingle(),
          contar("responsaveis", (q) => q.eq("paciente_id", pacienteId)),
          contar("paciente_pre_anamnese", (q) => q.eq("paciente_id", pacienteId)),
          contar("avaliacoes", (q) => q.eq("paciente_id", pacienteId)),
          contar("planos_terapeuticos", (q) => q.eq("paciente_id", pacienteId).eq("status", "ativo")),
          contar("prontuario_sessoes", (q) => q.eq("paciente_id", pacienteId)),
        ]);
      return { p: p ?? {}, responsaveis, preAnamnese, avaliacoes, planos, sessoes };
    },
  });

  if (!data) {
    return { carregado: false, pct: 0, etapaAtual: "cadastro" as JornadaEtapa, etapasFeitas: {} as Record<JornadaEtapa, boolean>, pendencias: [] as Pendencia[] };
  }

  const p: any = data.p;
  const camposCadastro: { ok: boolean; label: string }[] = [
    { ok: !!p.data_nascimento, label: "Data de nascimento" },
    { ok: !!p.telefone || data.responsaveis > 0, label: "Contato ou responsável" },
    { ok: !!p.queixa_principal, label: "Queixa principal" },
    { ok: !!p.modalidade_id, label: "Modalidade de atendimento" },
    { ok: !!p.profissional_responsavel_id, label: "Profissional responsável" },
    { ok: !!p.modelo_pagamento, label: "Forma de pagamento" },
  ];
  const cadastroOk = camposCadastro.every((c) => c.ok);
  const pct = Math.round((camposCadastro.filter((c) => c.ok).length / camposCadastro.length) * 100);

  const etapasFeitas: Record<JornadaEtapa, boolean> = {
    cadastro: cadastroOk,
    anamnese: data.preAnamnese > 0,
    avaliacao: data.avaliacoes > 0,
    plano: data.planos > 0,
    acompanhamento: data.sessoes > 0,
  };
  const etapaAtual: JornadaEtapa =
    (ETAPAS.find((e) => !etapasFeitas[e.key])?.key as JornadaEtapa) ?? "acompanhamento";

  const pendencias: Pendencia[] = [];
  for (const c of camposCadastro) {
    if (!c.ok) pendencias.push({ key: c.label, label: `Cadastro: ${c.label.toLowerCase()}`, aba: "cadastro" });
  }
  if (!etapasFeitas.anamnese)
    pendencias.push({ key: "anamnese", label: "Preencher a anamnese", aba: "clinico", sub: "avaliacao" });
  if (!etapasFeitas.plano)
    pendencias.push({ key: "plano", label: "Criar o plano terapêutico", aba: "clinico", sub: "plano" });
  if (!etapasFeitas.acompanhamento)
    pendencias.push({ key: "sessao", label: "Registrar a primeira sessão", aba: "clinico", sub: "sessoes" });

  return { carregado: true, pct, etapaAtual, etapasFeitas, pendencias: pendencias.slice(0, 4) };
}
