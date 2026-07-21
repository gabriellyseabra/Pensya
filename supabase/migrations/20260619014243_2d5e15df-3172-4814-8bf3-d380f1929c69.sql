ALTER TABLE public.paciente_pre_anamnese
  ADD COLUMN IF NOT EXISTS secoes_estruturadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resumos_secao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS insights_validados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS radar_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modo_entrada text,
  ADD COLUMN IF NOT EXISTS concluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS campos_importados jsonb NOT NULL DEFAULT '{}'::jsonb;