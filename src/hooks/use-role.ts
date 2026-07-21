import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "profissional" | "secretaria";

/* ============================================================
 * "Ver como" — pré-visualização de papel (apenas para admins).
 * Sobrepõe o papel efetivo NO CLIENTE (menu, páginas visíveis).
 * Não altera permissões reais (o banco/RLS usa o papel real).
 * ============================================================ */
const PREVIEW_KEY = "nave-preview-role";
const listeners = new Set<() => void>();

function readPreview(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(PREVIEW_KEY);
  return v === "profissional" || v === "secretaria" ? (v as AppRole) : null;
}

export function setPreviewRole(r: AppRole | null) {
  if (typeof window === "undefined") return;
  if (r) window.sessionStorage.setItem(PREVIEW_KEY, r);
  else window.sessionStorage.removeItem(PREVIEW_KEY);
  listeners.forEach((l) => l());
}

export function usePreviewRole(): AppRole | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    readPreview,
    () => null,
  );
}

function useRawRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async (): Promise<AppRole[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 5 * 60_000,
  });
  return { roles: data ?? [], isLoading };
}

/** Papéis do usuário logado (respeitando a pré-visualização de admin). */
export function useRoles() {
  const { roles: realRoles, isLoading } = useRawRoles();
  const preview = usePreviewRole();
  const realIsAdmin = realRoles.includes("admin");
  // Só admins podem pré-visualizar como outro papel.
  const previewing = !!preview && realIsAdmin;
  const roles = previewing ? [preview as AppRole] : realRoles;

  return {
    roles,
    isLoading,
    isAdmin: roles.includes("admin"),
    isSecretaria: roles.includes("secretaria"),
    isProfissional: roles.includes("profissional"),
    // Terapeuta "puro": só profissional (sem admin/secretaria) → acesso restrito
    isTerapeutaRestrito:
      roles.includes("profissional") && !roles.includes("admin") && !roles.includes("secretaria"),
    // Metadados para a UI de pré-visualização
    realIsAdmin,
    previewing,
    previewRole: previewing ? (preview as AppRole) : null,
  };
}

export function useIsAdmin() {
  const { isAdmin } = useRoles();
  return isAdmin;
}
