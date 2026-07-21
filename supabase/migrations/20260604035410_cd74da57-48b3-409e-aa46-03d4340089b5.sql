
-- Storage policies for pacientes-docs (auth only)
CREATE POLICY "auth read pacientes-docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'pacientes-docs');
CREATE POLICY "auth insert pacientes-docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pacientes-docs');
CREATE POLICY "auth update pacientes-docs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'pacientes-docs');
CREATE POLICY "auth delete pacientes-docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'pacientes-docs');

-- Storage policies for cadastro-publico (anon upload, auth manage)
CREATE POLICY "anon upload cadastro-publico" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'cadastro-publico');
CREATE POLICY "auth read cadastro-publico" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cadastro-publico');
CREATE POLICY "auth manage cadastro-publico" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'cadastro-publico') WITH CHECK (bucket_id = 'cadastro-publico');
