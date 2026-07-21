ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS engajamento smallint,
  ADD COLUMN IF NOT EXISTS motivacao smallint,
  ADD COLUMN IF NOT EXISTS persistencia smallint,
  ADD COLUMN IF NOT EXISTS autorregulacao smallint,
  ADD COLUMN IF NOT EXISTS participacao smallint,
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS transcricao text;

ALTER TABLE public.planos_terapeuticos
  ADD COLUMN IF NOT EXISTS raciocinio_clinico jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.testes_catalogo
  ADD COLUMN IF NOT EXISTS variaveis jsonb DEFAULT '[]'::jsonb;