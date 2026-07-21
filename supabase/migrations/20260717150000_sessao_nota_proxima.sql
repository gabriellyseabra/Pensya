-- =========================================================
-- Nota para a próxima sessão (lembrete carry-forward)
-- Registro rápido de algo importante para lembrar na próxima sessão;
-- aparece em destaque ao abrir o próximo registro de intervenção.
-- (Base para o futuro módulo de Planejamento de Sessões.)
-- Coluna aditiva em prontuario_sessoes (idempotente).
-- =========================================================

ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS nota_proxima_sessao text;
