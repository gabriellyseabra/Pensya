
-- Sprint 4: Plano Vivo & Evolução
-- 1) sessao_metas ganha "desempenho" (escala 1-5) para registro obrigatório por sessão
ALTER TABLE public.sessao_metas
  ADD COLUMN IF NOT EXISTS desempenho smallint CHECK (desempenho BETWEEN 1 AND 5);

-- 2) plano_metas ganha status do ciclo
ALTER TABLE public.plano_metas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa','concluida','suspensa','revisada'));

-- 3) Revisões de ciclo do plano (histórico de revisões + sugestões IA/regras)
CREATE TABLE IF NOT EXISTS public.plano_ciclo_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  data_revisao date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('automatica_regras','ia','manual')),
  resumo jsonb,
  sugestoes jsonb,
  aprovado_por uuid REFERENCES auth.users(id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_ciclo_revisoes TO authenticated;
GRANT ALL ON public.plano_ciclo_revisoes TO service_role;

ALTER TABLE public.plano_ciclo_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam revisões de ciclo"
  ON public.plano_ciclo_revisoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_plano_ciclo_revisoes_plano
  ON public.plano_ciclo_revisoes(plano_id, data_revisao DESC);

CREATE TRIGGER trg_plano_ciclo_revisoes_updated
  BEFORE UPDATE ON public.plano_ciclo_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
