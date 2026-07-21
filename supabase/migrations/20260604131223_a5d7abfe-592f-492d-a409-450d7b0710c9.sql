
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacao_enviada_em timestamptz;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS token_assinatura text UNIQUE,
  ADD COLUMN IF NOT EXISTS assinatura_imagem text;

CREATE INDEX IF NOT EXISTS atendimentos_inicio_idx ON public.atendimentos(inicio);
CREATE INDEX IF NOT EXISTS atendimentos_paciente_idx ON public.atendimentos(paciente_id);
CREATE INDEX IF NOT EXISTS atendimentos_profissional_idx ON public.atendimentos(profissional_id);
