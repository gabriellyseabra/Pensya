
-- RPC para obter contrato por token (público)
CREATE OR REPLACE FUNCTION public.get_contrato_por_token(_token text)
RETURNS TABLE(
  id uuid,
  status text,
  conteudo_html text,
  signatario_nome text,
  signatario_cpf text,
  signatario_email text,
  paciente_nome text,
  paciente_id uuid,
  assinado_em timestamptz,
  assinatura_imagem text,
  hash_documento text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.status,
         coalesce((c.dados_preenchimento->>'conteudo_html')::text, ct.conteudo_html) AS conteudo_html,
         c.signatario_nome, c.signatario_cpf, c.signatario_email,
         p.nome AS paciente_nome, p.id AS paciente_id,
         c.assinado_em, c.assinatura_imagem, c.hash_documento
  FROM public.contratos c
  LEFT JOIN public.contract_templates ct ON ct.id = c.template_id
  LEFT JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.token_assinatura = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_contrato_por_token(text) TO anon, authenticated;

-- RPC para assinar contrato (público)
CREATE OR REPLACE FUNCTION public.assinar_contrato(
  _token text,
  _assinatura_imagem text,
  _signatario_nome text,
  _signatario_cpf text,
  _ip text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_hash text;
BEGIN
  SELECT id, status INTO v_id, v_status
  FROM public.contratos
  WHERE token_assinatura = _token
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  IF v_status = 'assinado' THEN
    RAISE EXCEPTION 'Contrato já assinado';
  END IF;

  v_hash := encode(digest(_assinatura_imagem || _signatario_nome || _signatario_cpf || now()::text, 'sha256'), 'hex');

  UPDATE public.contratos
  SET status = 'assinado',
      assinado_em = now(),
      assinatura_imagem = _assinatura_imagem,
      signatario_nome = coalesce(_signatario_nome, signatario_nome),
      signatario_cpf = coalesce(_signatario_cpf, signatario_cpf),
      ip_assinatura = _ip,
      hash_documento = v_hash
  WHERE id = v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assinar_contrato(text, text, text, text, text) TO anon, authenticated;

-- pgcrypto for digest
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
