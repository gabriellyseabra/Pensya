ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'intervencao'
    CHECK (tipo IN ('avaliacao', 'intervencao'));

ALTER TABLE public.sessao_metas
  ADD COLUMN IF NOT EXISTS observacoes_meta text;
