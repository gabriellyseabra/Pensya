
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
SET search_path = public, extensions
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

  v_hash := encode(extensions.digest(_assinatura_imagem || _signatario_nome || _signatario_cpf || now()::text, 'sha256'), 'hex');

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
