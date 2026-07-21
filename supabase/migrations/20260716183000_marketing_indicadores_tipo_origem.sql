-- Torna a origem dos indicadores automáticos independente do nome editável do canal.
ALTER TABLE public.canais_marketing
  ADD COLUMN IF NOT EXISTS tipo_origem text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'canais_marketing_tipo_origem_check'
      AND conrelid = 'public.canais_marketing'::regclass
  ) THEN
    ALTER TABLE public.canais_marketing
      ADD CONSTRAINT canais_marketing_tipo_origem_check
      CHECK (tipo_origem IS NULL OR tipo_origem IN ('indicacao', 'escola'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_canais_marketing_tipo_origem_unique
  ON public.canais_marketing (tipo_origem)
  WHERE tipo_origem IS NOT NULL;

UPDATE public.canais_marketing
SET tipo_origem = 'indicacao'
WHERE lower(nome) = 'indicação'
  AND tipo_origem IS NULL;

UPDATE public.canais_marketing
SET tipo_origem = 'escola'
WHERE lower(nome) = 'escola'
  AND tipo_origem IS NULL;

UPDATE public.marketing_indicadores
SET fonte = 'canal:indicacao'
WHERE fonte = 'leads_indicacao';

UPDATE public.marketing_indicadores
SET fonte = 'canal:escola'
WHERE fonte = 'leads_escola';
