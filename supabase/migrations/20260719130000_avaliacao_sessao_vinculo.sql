-- =========================================================
-- Vínculo Sessão de Avaliação ↔ Avaliação ↔ Testes
-- Permite registrar uma sessão de avaliação atrelada a uma avaliação específica,
-- marcar quais testes da bateria foram administrados naquele dia e lançar os
-- resultados já vinculados à sessão. Com isso o status do planejamento
-- (bateria_itens) passa a mudar automaticamente conforme a sessão é registrada.
-- Idempotente.
-- =========================================================

-- Sessão de avaliação vinculada a uma avaliação (nullable; não afeta intervenção)
ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS avaliacao_id uuid
  REFERENCES public.avaliacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessoes_avaliacao
  ON public.prontuario_sessoes (avaliacao_id);

-- Resultado lançado durante uma sessão fica rastreável a ela
ALTER TABLE public.testes_aplicados
  ADD COLUMN IF NOT EXISTS sessao_id uuid
  REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_testes_aplicados_sessao
  ON public.testes_aplicados (sessao_id);

-- Registra em qual sessão o item da bateria foi administrado
ALTER TABLE public.bateria_itens
  ADD COLUMN IF NOT EXISTS sessao_aplicacao_id uuid
  REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bateria_itens_sessao
  ON public.bateria_itens (sessao_aplicacao_id);
