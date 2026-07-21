
ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duracao_seg integer,
  ADD COLUMN IF NOT EXISTS transcricao text,
  ADD COLUMN IF NOT EXISTS soap_subjetivo text,
  ADD COLUMN IF NOT EXISTS soap_objetivo text,
  ADD COLUMN IF NOT EXISTS soap_avaliacao text,
  ADD COLUMN IF NOT EXISTS soap_plano text,
  ADD COLUMN IF NOT EXISTS ia_resumo text,
  ADD COLUMN IF NOT EXISTS ia_processado_em timestamptz;

-- Storage policies para áudios das sessões (apenas autenticados)
CREATE POLICY "auth read sessoes-audio" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'sessoes-audio');
CREATE POLICY "auth upload sessoes-audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sessoes-audio');
CREATE POLICY "auth update sessoes-audio" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'sessoes-audio');
CREATE POLICY "auth delete sessoes-audio" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sessoes-audio');
