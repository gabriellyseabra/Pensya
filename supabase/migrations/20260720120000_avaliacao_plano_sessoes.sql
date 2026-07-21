-- =========================================================
-- Pré-planejamento das sessões de avaliação
-- Permite planejar as sessões de uma avaliação (Sessão 1, 2, 3…), atribuindo
-- a cada uma os testes da bateria que serão aplicados. No registro da sessão
-- o checklist já vem pré-marcado com esses testes (e continua editável).
-- Idempotente.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.avaliacao_sessoes_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  titulo text,
  data_prevista date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avaliacao_sessoes_plano_avaliacao
  ON public.avaliacao_sessoes_plano (avaliacao_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacao_sessoes_plano TO authenticated;
GRANT ALL ON public.avaliacao_sessoes_plano TO service_role;
ALTER TABLE public.avaliacao_sessoes_plano ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avaliacao_sessoes_plano'
      AND policyname = 'auth all avaliacao_sessoes_plano'
  ) THEN
    CREATE POLICY "auth all avaliacao_sessoes_plano" ON public.avaliacao_sessoes_plano
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Cada teste da bateria pode ser atribuído a uma sessão planejada
ALTER TABLE public.bateria_itens
  ADD COLUMN IF NOT EXISTS sessao_plano_id uuid
  REFERENCES public.avaliacao_sessoes_plano(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bateria_itens_sessao_plano
  ON public.bateria_itens (sessao_plano_id);
