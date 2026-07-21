import { supabase } from "@/integrations/supabase/client";

/**
 * Convites de equipe: o admin cria um convite (na página Equipe) e envia o
 * link. A pessoa abre o link, cria a senha, envia a foto e o aceite (RPC
 * SECURITY DEFINER) atribui o papel e vincula o profissional.
 */

export type EquipeConviteInfo = {
  valido: boolean;
  usado: boolean;
  expirado: boolean;
  nome: string | null;
  email: string | null;
  role: string | null;
};

async function unwrap<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export function equipeConviteInfo(token: string) {
  return unwrap<EquipeConviteInfo[]>(
    (supabase as any).rpc("equipe_convite_info", { _token: token }),
  ).then((rows) => rows?.[0] ?? null);
}

export function equipeAceitarConvite(token: string) {
  return unwrap((supabase as any).rpc("equipe_aceitar_convite", { _token: token }));
}
