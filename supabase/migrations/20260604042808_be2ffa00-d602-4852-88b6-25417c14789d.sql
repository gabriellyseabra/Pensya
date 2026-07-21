
-- Loosen anon UPDATE policy so the public form can save status transitions reliably
DROP POLICY IF EXISTS "anon update by token" ON public.cadastro_publico;
CREATE POLICY "anon update by token"
  ON public.cadastro_publico
  FOR UPDATE
  TO anon
  USING ((status = ANY (ARRAY['pendente'::text, 'em_preenchimento'::text, 'preenchido'::text])) AND (expires_at > now()))
  WITH CHECK ((status = ANY (ARRAY['pendente'::text, 'em_preenchimento'::text, 'preenchido'::text])) AND (expires_at > now()));

-- Allow the public form to also read its own row after saving as 'preenchido'
DROP POLICY IF EXISTS "anon read by token" ON public.cadastro_publico;
CREATE POLICY "anon read by token"
  ON public.cadastro_publico
  FOR SELECT
  TO anon
  USING ((status = ANY (ARRAY['pendente'::text, 'em_preenchimento'::text, 'preenchido'::text])) AND (expires_at > now()));

-- Allow anon to read/sign URLs for files they uploaded to cadastro-publico bucket
DROP POLICY IF EXISTS "anon read cadastro-publico" ON storage.objects;
CREATE POLICY "anon read cadastro-publico"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'cadastro-publico');
