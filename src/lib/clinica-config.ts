// Identidade da clínica (organização) — nome, CNPJ, contato, logo.
// "Minha organização" = a clínica do usuário autenticado (via my_org_id()
// no banco). Telas públicas/família sem sessão de equipe (cadastro
// público, convite do portal, portal já logado) usam a versão "pública",
// que só expõe nome + logo (dado não sensível) a partir de um token ou
// paciente com acesso liberado.
import { supabase } from "@/integrations/supabase/client";

export const CLINICA_LOGO_BUCKET = "clinica-branding";

export type Organizacao = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  responsavel_nome: string | null;
  logo_path: string | null;
  plano: string;
  status: string;
};

export function clinicaLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const { data } = supabase.storage.from(CLINICA_LOGO_BUCKET).getPublicUrl(logoPath);
  return data.publicUrl || null;
}

/**
 * Organização (clínica) do usuário autenticado. Null se ele não pertence a
 * nenhuma. Resolve primeiro o id via my_org_id() porque a admin da
 * plataforma enxerga todas as organizações — um select sem filtro
 * devolveria várias linhas para ela.
 */
export async function getMinhaOrganizacao(): Promise<Organizacao | null> {
  const { data: orgId } = await supabase.rpc("my_org_id");
  if (!orgId) return null;
  const { data } = await supabase.from("organizacoes").select("*").eq("id", orgId).maybeSingle();
  return (data as Organizacao) ?? null;
}

/** Visão de clínica da admin Pensya: em qual clínica ela está navegando agora. */
export async function getVisaoAdmin(): Promise<{ orgId: string; nome: string } | null> {
  const { data: isAdmin } = await supabase.rpc("is_pensya_admin");
  if (!isAdmin) return null;
  const org = await getMinhaOrganizacao();
  return org ? { orgId: org.id, nome: org.nome } : null;
}

/** Nome + logo de uma organização, resolvidos a partir de um contexto público. */
export async function getOrganizacaoBrandingPublica(params: {
  cadastroToken?: string;
  conviteToken?: string;
  pacienteId?: string;
}): Promise<{ nome: string; logo_path: string | null } | null> {
  const { data } = await supabase.rpc("organizacao_branding_publica", {
    _cadastro_token: params.cadastroToken ?? undefined,
    _convite_token: params.conviteToken ?? undefined,
    _paciente_id: params.pacienteId ?? undefined,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

/** Logo da MINHA organização como data URI, para embutir em documentos impressos/PDF. */
export async function minhaOrganizacaoLogoDataUrl(): Promise<string> {
  try {
    const org = await getMinhaOrganizacao();
    const url = clinicaLogoUrl(org?.logo_path);
    if (!url) return "";
    const res = await fetch(url);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}
