import { supabase } from "@/integrations/supabase/client";

/**
 * Funções do Portal da Família/Paciente.
 * Todo o acesso a dados clínicos do portal passa por RPCs SECURITY DEFINER
 * (portal_*) que devolvem apenas campos curados e validam o vínculo
 * usuário ↔ paciente (portal_acessos).
 */

export type PortalPaciente = { paciente_id: string; nome: string; tipo: string };
export type PortalAgendaItem = {
  id: string; inicio: string; fim: string;
  profissional: string | null; modalidade: string | null; local_nome: string | null;
};
export type PortalSessao = {
  id: string; data_sessao: string; tipo: string; duracao_min: number | null;
  habilidades_trabalhadas: unknown; orientacao_casa: boolean;
  orientacao_texto: string | null; orientacao_status: string;
  orientacao_atualizado_em: string | null;
};
export type PortalMeta = {
  id: string; titulo: string; dominio: string | null; status: string;
  nivel_gas_atingido: number | null; prazo_semanas: number | null;
};
export type PortalPlano = {
  id: string; titulo: string; status: string; data_inicio: string | null;
  frequencia_sessoes: string | null; orientacoes_familia: string | null;
};
export type PortalMensalidade = {
  id: string; competencia: string; valor: number; vencimento: string;
  status: string; pago_em: string | null; forma_pagamento: string | null;
  checkout_url: string | null;
};
export type PortalRegistro = {
  id: string; paciente_id: string; autor_user_id: string; autor_nome: string;
  autor_tipo: string; tipo: string; texto: string; humor: number | null;
  created_at: string;
};

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function portalMeusPacientes() {
  return unwrap<PortalPaciente[]>(supabase.rpc("portal_meus_pacientes"));
}

export function portalConviteInfo(token: string) {
  return unwrap(supabase.rpc("portal_convite_info", { _token: token })).then((rows) => rows?.[0] ?? null);
}

export function portalAceitarConvite(token: string) {
  return unwrap<string>(supabase.rpc("portal_aceitar_convite", { _token: token }));
}

export function portalAgenda(pacienteId: string) {
  return unwrap<PortalAgendaItem[]>(supabase.rpc("portal_agenda", { _paciente_id: pacienteId }));
}

export function portalSessoes(pacienteId: string, limite = 60) {
  return unwrap<PortalSessao[]>(supabase.rpc("portal_sessoes", { _paciente_id: pacienteId, _limite: limite }));
}

export function portalOrientacaoFeedback(sessaoId: string, status: "feita" | "nao_feita" | "pendente") {
  return unwrap(supabase.rpc("portal_orientacao_feedback", { _sessao_id: sessaoId, _status: status }));
}

export function portalPlano(pacienteId: string) {
  return unwrap<PortalPlano[]>(supabase.rpc("portal_plano", { _paciente_id: pacienteId })).then((rows) => rows?.[0] ?? null);
}

export function portalMetas(pacienteId: string) {
  return unwrap<PortalMeta[]>(supabase.rpc("portal_metas", { _paciente_id: pacienteId }));
}

export function portalMensalidades(pacienteId: string) {
  return unwrap<PortalMensalidade[]>(supabase.rpc("portal_mensalidades", { _paciente_id: pacienteId }));
}

export type PortalDocumentoFiscal = {
  id: string; tipo: string; status: string; competencia: string | null;
  data_documento: string; valor: number; descricao: string | null;
  numero: string | null; pdf_path: string | null;
};

export function portalDocumentosFiscais(pacienteId: string) {
  // RPC nova (migration 20260724110000) — ainda não consta no types.ts gerado.
  return unwrap<PortalDocumentoFiscal[]>(
    (supabase.rpc as any)("portal_documentos_fiscais", { _paciente_id: pacienteId }),
  );
}

/** Gera uma signed URL (7 dias) para baixar o PDF de um documento fiscal do portal. */
export async function portalDocumentoFiscalUrl(pdfPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("pacientes-docs")
    .createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function portalRegistros(pacienteId: string) {
  const { data, error } = await supabase
    .from("portal_registros")
    .select("*")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalRegistro[];
}

export async function portalCriarRegistro(input: {
  pacienteId: string; tipo: string; texto: string; humor?: number | null; autorNome: string;
  autorTipo?: "familia" | "equipe";
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");
  const { error } = await supabase.from("portal_registros").insert({
    paciente_id: input.pacienteId,
    autor_user_id: u.user.id,
    autor_nome: input.autorNome,
    autor_tipo: input.autorTipo ?? "familia",
    tipo: input.tipo,
    texto: input.texto,
    humor: input.humor ?? null,
  });
  if (error) throw new Error(error.message);
}

export type RelatorioMensal = {
  competencia: string;
  sessoes: number;
  engajamento_medio: number | null;
  frequencia: Record<string, number>;
  habilidades: { nome: string; vezes: number }[];
  orientacoes: { total: number; feitas: number; nao_feitas: number; pendentes: number };
  metas: {
    titulo: string; dominio: string | null; gas_ultimo: number | null;
    gas_medio: number | null; desempenho_medio: number | null; registros: number;
  }[];
  registros_familia: number;
};

const RELATORIO_VISTO_KEY = "portal-relatorio-visto";

/** Última competência de relatório vista por paciente (aviso de "novo relatório"). */
export function relatorioVisto(pacienteId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const map = JSON.parse(localStorage.getItem(RELATORIO_VISTO_KEY) ?? "{}");
    return map[pacienteId] ?? null;
  } catch {
    return null;
  }
}

export function marcarRelatorioVisto(pacienteId: string, competencia: string) {
  if (typeof window === "undefined") return;
  try {
    const map = JSON.parse(localStorage.getItem(RELATORIO_VISTO_KEY) ?? "{}");
    map[pacienteId] = competencia;
    localStorage.setItem(RELATORIO_VISTO_KEY, JSON.stringify(map));
  } catch {
    /* armazenamento indisponível — o aviso apenas continua aparecendo */
  }
}

export function portalRelatoriosDisponiveis(pacienteId: string) {
  return unwrap<{ competencia: string }[]>(
    supabase.rpc("portal_relatorios_disponiveis", { _paciente_id: pacienteId }),
  ).then((rows) => rows.map((r) => r.competencia));
}

/** Nomes de habilidades trabalhadas numa sessão (jsonb flexível). */
export function habilidadesLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => {
      if (typeof h === "string") return h;
      if (h && typeof h === "object") {
        const o = h as Record<string, unknown>;
        return (o.nome ?? o.habilidade ?? o.titulo ?? o.label ?? "") as string;
      }
      return "";
    })
    .filter(Boolean);
}
