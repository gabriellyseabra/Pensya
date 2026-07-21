-- =========================================================
-- Fontes Documentais (Fase 1.5 · ETAPA 1)
-- Permite anexar documentos ao paciente (relatórios de avaliação/evolução,
-- registro de sessões de plano anterior, laudos) e usá-los como FONTE do
-- "Gerar com IA" — sem precisar digitar todos os dados estruturados.
-- O texto é extraído por IA e cacheado em texto_extraido.
-- Colunas aditivas em paciente_documentos (idempotente).
-- =========================================================

ALTER TABLE public.paciente_documentos
  -- incluir este documento como fonte na geração do plano
  ADD COLUMN IF NOT EXISTS usar_como_fonte boolean NOT NULL DEFAULT false,
  -- classificação da fonte (relatorio_avaliacao | relatorio_evolucao |
  -- registro_sessoes | relatorio_medico | relatorio_escolar | anamnese | outro)
  ADD COLUMN IF NOT EXISTS fonte_tipo text,
  -- texto extraído do documento (cacheado para não reprocessar a cada geração)
  ADD COLUMN IF NOT EXISTS texto_extraido text,
  ADD COLUMN IF NOT EXISTS extraido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_paciente_documentos_fonte
  ON public.paciente_documentos (paciente_id) WHERE usar_como_fonte;
