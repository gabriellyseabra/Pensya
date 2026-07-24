-- Portal da família: expõe os documentos fiscais marcados como visíveis no
-- portal (recibos, recibos de saúde e NFs emitidas com PDF anexado).
-- Segue o padrão das demais funções portal_* (SECURITY DEFINER, dados curados,
-- valida o vínculo usuário ↔ paciente via tem_acesso_portal). Devolve o
-- pdf_path; o cliente do portal gera a signed URL para download.
CREATE OR REPLACE FUNCTION public.portal_documentos_fiscais(_paciente_id uuid)
RETURNS TABLE (
  id uuid, tipo text, status text, competencia text, data_documento date,
  valor numeric, descricao text, numero text, pdf_path text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT df.id, df.tipo, df.status, df.competencia::text, df.data_documento::date,
    df.valor, df.descricao, df.numero, df.pdf_path
  FROM public.documentos_fiscais df
  WHERE df.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
    AND df.visivel_portal
    AND df.pdf_path IS NOT NULL
    AND df.status <> 'cancelada'
  ORDER BY df.data_documento DESC
  LIMIT 60
$$;
REVOKE EXECUTE ON FUNCTION public.portal_documentos_fiscais(uuid) FROM anon;
