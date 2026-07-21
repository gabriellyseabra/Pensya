-- RPCs do modo visão de clínica: entrar (grava/atualiza a visão ativa,
-- exclusivo da pensya_admin) e sair (remove a própria visão).
CREATE OR REPLACE FUNCTION public.admin_entrar_clinica(_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_pensya_admin() THEN
    RAISE EXCEPTION 'Apenas a administração Pensya pode usar a visão de clínica';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = _org_id) THEN
    RAISE EXCEPTION 'Clínica não encontrada';
  END IF;
  INSERT INTO public.admin_visao_org (user_id, org_id)
  VALUES (auth.uid(), _org_id)
  ON CONFLICT (user_id) DO UPDATE SET org_id = _org_id, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_sair_clinica()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.admin_visao_org WHERE user_id = auth.uid();
$$;