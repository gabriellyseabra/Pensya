-- configuracoes_clinica era um singleton (pré multi-clínica); os mesmos
-- campos já existem em organizacoes (uma linha por clínica). Tabela
-- estava vazia (0 linhas) — sem dado a migrar.
DROP TABLE IF EXISTS public.configuracoes_clinica;

-- Bucket clinica-branding: escopar por organização (path = {org_id}/arquivo),
-- senão a admin de uma clínica conseguiria sobrescrever a logo de outra.
DROP POLICY IF EXISTS "clinica-branding admin insere" ON storage.objects;
DROP POLICY IF EXISTS "clinica-branding admin atualiza" ON storage.objects;
DROP POLICY IF EXISTS "clinica-branding admin remove" ON storage.objects;

CREATE POLICY "clinica-branding org admin insere" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinica-branding'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = public.my_org_id()::text
  );

CREATE POLICY "clinica-branding org admin atualiza" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clinica-branding'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = public.my_org_id()::text
  );

CREATE POLICY "clinica-branding org admin remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinica-branding'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = public.my_org_id()::text
  );
