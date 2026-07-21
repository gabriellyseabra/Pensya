-- =========================================================
-- Planejamento de Sessões — integração com a Agenda (Módulo 1)
-- Ancora o planejamento a um atendimento real (data segue a agenda) e
-- rastreia carry-forward quando há falta (o planejado passa p/ a próxima sessão).
-- Colunas aditivas em sessao_planejamentos (idempotente).
-- =========================================================

ALTER TABLE public.sessao_planejamentos
  -- atendimento real (agenda) ao qual este planejamento está ancorado
  ADD COLUMN IF NOT EXISTS atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  -- recursos planejados (texto livre; no banco de recursos vira também recurso_ids)
  ADD COLUMN IF NOT EXISTS recursos text,
  -- origem do carry-forward (atendimento anterior faltado de onde o plano veio)
  ADD COLUMN IF NOT EXISTS movido_de_atendimento_id uuid;

CREATE INDEX IF NOT EXISTS idx_sessao_planejamentos_atendimento
  ON public.sessao_planejamentos (atendimento_id);
