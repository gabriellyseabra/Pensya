-- =========================================================
-- Ajustes financeiros:
--  1) Folha: forma de repasse explícita + valores por paciente
--  2) Investimentos: aportes (para meta com acompanhamento e projeção)
-- (Status "pago" da folha já existe: folha_pagamento.status='paga' + paga_em.)
-- =========================================================

-- 1) Forma de repasse escolhida pela clínica para cada colaborador.
--    'auto' preserva o comportamento anterior (valor_por_sessao>0 ? sessão : %).
ALTER TABLE public.colaborador_config
  ADD COLUMN IF NOT EXISTS forma_repasse text NOT NULL DEFAULT 'auto';
  -- valores: 'auto' | 'fixo_mensal' | 'por_sessao' | 'por_paciente' | 'percentual'

-- Valores por paciente (usado quando forma_repasse = 'por_paciente').
-- Cada paciente pode ter modo próprio: por sessão do mês ou fixo mensal.
CREATE TABLE IF NOT EXISTS public.colaborador_paciente_valor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE DEFAULT public.my_org_id(),
  profissional_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  modo text NOT NULL DEFAULT 'por_sessao', -- 'por_sessao' | 'fixo_mensal'
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profissional_id, paciente_id)
);
CREATE INDEX IF NOT EXISTS idx_colab_pac_valor_prof ON public.colaborador_paciente_valor(profissional_id);
CREATE INDEX IF NOT EXISTS idx_colab_pac_valor_org ON public.colaborador_paciente_valor(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaborador_paciente_valor TO authenticated;
GRANT ALL ON public.colaborador_paciente_valor TO service_role;
ALTER TABLE public.colaborador_paciente_valor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages colab_paciente_valor" ON public.colaborador_paciente_valor;
CREATE POLICY "admin manages colab_paciente_valor" ON public.colaborador_paciente_valor
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Isolamento por organizacao" ON public.colaborador_paciente_valor;
CREATE POLICY "Isolamento por organizacao" ON public.colaborador_paciente_valor
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.my_org_id() OR org_id IS NULL OR public.is_pensya_admin())
  WITH CHECK (org_id = public.my_org_id() OR public.is_pensya_admin());

DROP TRIGGER IF EXISTS colab_pac_valor_updated ON public.colaborador_paciente_valor;
CREATE TRIGGER colab_pac_valor_updated BEFORE UPDATE ON public.colaborador_paciente_valor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Aportes de investimento — cada valor guardado/investido ao longo do tempo.
--    A meta é o investimentos.valor; o acumulado é a soma dos aportes.
CREATE TABLE IF NOT EXISTS public.investimento_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE DEFAULT public.my_org_id(),
  investimento_id uuid NOT NULL REFERENCES public.investimentos(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  valor numeric NOT NULL DEFAULT 0,
  observacoes text,
  lancamento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invest_aportes_inv ON public.investimento_aportes(investimento_id);
CREATE INDEX IF NOT EXISTS idx_invest_aportes_org ON public.investimento_aportes(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investimento_aportes TO authenticated;
GRANT ALL ON public.investimento_aportes TO service_role;
ALTER TABLE public.investimento_aportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages investimento_aportes" ON public.investimento_aportes;
CREATE POLICY "admin manages investimento_aportes" ON public.investimento_aportes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Isolamento por organizacao" ON public.investimento_aportes;
CREATE POLICY "Isolamento por organizacao" ON public.investimento_aportes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.my_org_id() OR org_id IS NULL OR public.is_pensya_admin())
  WITH CHECK (org_id = public.my_org_id() OR public.is_pensya_admin());
