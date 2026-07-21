-- Nome + logo de uma organização (dado não sensível), resolvido a partir
-- de um contexto público (token de cadastro, token de convite do portal
-- ou paciente com acesso liberado) — sem expor CNPJ/endereço/telefone.
CREATE OR REPLACE FUNCTION public.organizacao_branding_publica(
  _cadastro_token text DEFAULT NULL,
  _convite_token text DEFAULT NULL,
  _paciente_id uuid DEFAULT NULL
) RETURNS TABLE(nome text, logo_path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resolved_org uuid;
BEGIN
  IF _cadastro_token IS NOT NULL THEN
    SELECT cp.org_id INTO resolved_org FROM public.cadastro_publico cp WHERE cp.token = _cadastro_token;
  ELSIF _convite_token IS NOT NULL THEN
    SELECT pc.org_id INTO resolved_org FROM public.portal_convites pc WHERE pc.token = _convite_token;
  ELSIF _paciente_id IS NOT NULL AND (public.tem_acesso_portal(_paciente_id) OR public.is_equipe(auth.uid())) THEN
    SELECT p.org_id INTO resolved_org FROM public.pacientes p WHERE p.id = _paciente_id;
  END IF;

  IF resolved_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT o.nome, o.logo_path FROM public.organizacoes o WHERE o.id = resolved_org;
END;
$$;
GRANT EXECUTE ON FUNCTION public.organizacao_branding_publica(text, text, uuid) TO anon, authenticated;
