-- =========================================================
-- Registro de Sessões como Raciocínio Clínico (Fase 2 · ETAPAS 9-10)
-- A sessão deixa de registrar "o que aconteceu" e passa a registrar
-- "como esta sessão aproxima a criança de suas metas funcionais":
-- componentes clínicos abordados, evidências clínicas que surgiram,
-- se houve progresso e se o plano precisa de ajuste.
-- Colunas aditivas em sessao_metas (idempotente).
-- =========================================================

ALTER TABLE public.sessao_metas
  -- componentes clínicos (do Mapa da Meta) efetivamente abordados na sessão
  ADD COLUMN IF NOT EXISTS componentes_trabalhados text[],
  -- evidências clínicas observadas (nunca só atividades)
  ADD COLUMN IF NOT EXISTS evidencias_clinicas text,
  -- houve progresso? (regressao | sem_mudanca | parcial | sim)
  ADD COLUMN IF NOT EXISTS houve_progresso text
    CHECK (houve_progresso IN ('regressao','sem_mudanca','parcial','sim')),
  -- o planejamento precisa de ajuste? (texto do ajuste; null = manter)
  ADD COLUMN IF NOT EXISTS ajuste_plano text;
