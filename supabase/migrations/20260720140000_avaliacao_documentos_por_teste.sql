-- =========================================================
-- Anexos por teste no registro da sessão de avaliação
-- Cada documento de avaliação pode ser vinculado a um teste específico
-- (e à sessão em que foi anexado), permitindo anexar PNG/JPEG/PDF ao lado de
-- cada teste no checklist da sessão. Idempotente.
-- =========================================================

ALTER TABLE public.avaliacao_documentos
  ADD COLUMN IF NOT EXISTS teste_id uuid
  REFERENCES public.testes_catalogo(id) ON DELETE SET NULL;

ALTER TABLE public.avaliacao_documentos
  ADD COLUMN IF NOT EXISTS sessao_id uuid
  REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_avaliacao_documentos_teste
  ON public.avaliacao_documentos (avaliacao_id, teste_id);
