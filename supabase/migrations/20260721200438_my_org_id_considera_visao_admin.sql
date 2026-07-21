-- Ajuste solicitado pela dona da plataforma (pensya_admin): ao ativar a
-- "visão de clínica", my_org_id() devolve a clínica visitada, ESCOPANDO o
-- acesso dela àquela organização. Isso NÃO amplia acesso: a pensya_admin já
-- enxerga todas as organizações hoje (bypass nas políticas restritivas);
-- esta mudança restringe a navegação dela a uma clínica por vez.
-- Para usuários comuns nada muda: a 1ª perna do COALESCE (vínculo em
-- organizacao_membros) continua idêntica à definição atual.
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM public.organizacao_membros WHERE user_id = auth.uid() AND ativo LIMIT 1),
    (SELECT v.org_id FROM public.admin_visao_org v
     JOIN public.user_roles r ON r.user_id = v.user_id AND r.role = 'pensya_admin'
     WHERE v.user_id = auth.uid())
  );
$$;