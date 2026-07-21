// Identidade da clínica (nome, CNPJ, contato, logo), configurável em
// Configurações > Clínica > Identidade e usada nos documentos gerados
// (contrato, relatório, plano terapêutico).
import { supabase } from "@/integrations/supabase/client";

export const CLINICA_LOGO_BUCKET = "clinica-branding";

export type ConfiguracaoClinica = {
  id: string;
  nome_clinica: string | null;
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  responsavel_nome: string | null;
  logo_path: string | null;
};

/** URL pública da logo da clínica, ou null se ainda não configurada. */
export function clinicaLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const { data } = supabase.storage.from(CLINICA_LOGO_BUCKET).getPublicUrl(logoPath);
  return data.publicUrl || null;
}

/** Busca a configuração única da clínica (singleton). Retorna null se ainda não cadastrada. */
export async function getConfiguracaoClinica(): Promise<ConfiguracaoClinica | null> {
  const { data } = await supabase
    .from("configuracoes_clinica")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConfiguracaoClinica) ?? null;
}

/** Carrega a logo da clínica como data URI, para embutir em documentos impressos/PDF. */
export async function clinicaLogoDataUrl(): Promise<string> {
  try {
    const cfg = await getConfiguracaoClinica();
    const url = clinicaLogoUrl(cfg?.logo_path);
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
