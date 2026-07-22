import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

/**
 * Cria a conta do convidado JÁ CONFIRMADA (via service role), a partir de um
 * convite válido. Assim o acesso da equipe não depende do e-mail de confirmação
 * do Supabase (que pode não chegar no SMTP padrão). O convite é validado no
 * servidor; em seguida o cliente faz login normal e aceita o convite.
 */
export const criarContaConvite = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().trim().min(4),
        email: z.string().trim().email(),
        password: z.string().min(6).max(200),
        nome: z.string().trim().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida o convite (não revogado, não expirado, não utilizado).
    const { data: conv, error: eConv } = await supabaseAdmin
      .from("convites_equipe")
      .select("id, revogado, expira_em, usado_em, nome")
      .eq("token", data.token)
      .maybeSingle();
    if (eConv) throw new Error(eConv.message);
    if (!conv || conv.revogado || new Date(conv.expira_em) < new Date() || conv.usado_em) {
      throw new Error("Convite inválido, expirado ou já utilizado");
    }

    // Cria o usuário já confirmado — nenhum e-mail de confirmação é necessário.
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome || conv.nome || undefined },
    });

    if (error) {
      // Já existe conta com esse e-mail. Pode ter ficado presa sem confirmação
      // (e-mail não chegou) → confirma para liberar o login com a senha dela.
      if (/registered|already|exists/i.test(error.message)) {
        try {
          for (let page = 1; page <= 10; page++) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
            const u = list?.users?.find(
              (x) => x.email?.toLowerCase() === data.email.toLowerCase(),
            );
            if (u) {
              await supabaseAdmin.auth.admin.updateUserById(u.id, { email_confirm: true });
              break;
            }
            if (!list?.users?.length || list.users.length < 200) break;
          }
        } catch {
          /* segue com login normal mesmo assim */
        }
        return { jaExiste: true };
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
