
-- colaborador_config: configuração financeira por profissional
CREATE TABLE public.colaborador_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL UNIQUE,
  vinculo text NOT NULL DEFAULT 'autonomo', -- 'clt' | 'pj' | 'autonomo'
  salario_base numeric NOT NULL DEFAULT 0,
  comissao_percentual numeric NOT NULL DEFAULT 0, -- % sobre atendimentos
  valor_por_sessao numeric NOT NULL DEFAULT 0,    -- alternativa fixa por sessão
  beneficios numeric NOT NULL DEFAULT 0,
  descontos_fixos numeric NOT NULL DEFAULT 0,
  dependentes integer NOT NULL DEFAULT 0,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaborador_config TO authenticated;
GRANT ALL ON public.colaborador_config TO service_role;
ALTER TABLE public.colaborador_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages colaborador_config" ON public.colaborador_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER colab_config_updated BEFORE UPDATE ON public.colaborador_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- folha_pagamento: folha mensal por colaborador
CREATE TABLE public.folha_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL,
  competencia date NOT NULL, -- primeiro dia do mês de referência
  salario_base numeric NOT NULL DEFAULT 0,
  comissoes numeric NOT NULL DEFAULT 0,
  beneficios numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  encargos numeric NOT NULL DEFAULT 0,     -- INSS/FGTS estimados
  descontos numeric NOT NULL DEFAULT 0,    -- INSS, IRRF, faltas
  liquido numeric NOT NULL DEFAULT 0,
  qtd_sessoes integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb, -- breakdown do cálculo
  status text NOT NULL DEFAULT 'aberta', -- 'aberta' | 'fechada' | 'paga'
  fechada_em timestamptz,
  paga_em date,
  lancamento_id uuid, -- referência ao lançamento de despesa criado
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profissional_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_pagamento TO authenticated;
GRANT ALL ON public.folha_pagamento TO service_role;
ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages folha" ON public.folha_pagamento
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER folha_updated BEFORE UPDATE ON public.folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- investimentos: intenções e planejamento
CREATE TABLE public.investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL, -- 'curso' | 'equipamento' | 'software' | 'reforma' | 'manutencao' | 'marketing' | 'outro'
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  prazo date, -- quando se pretende fazer
  prioridade text NOT NULL DEFAULT 'media', -- 'alta' | 'media' | 'baixa'
  status text NOT NULL DEFAULT 'ideia', -- 'ideia' | 'aprovado' | 'em_andamento' | 'concluido' | 'descartado'
  roi_esperado text,
  reserva_mensal numeric NOT NULL DEFAULT 0, -- quanto guardar por mês
  plano_conta_id uuid,
  fornecedor_id uuid,
  lancamento_id uuid, -- lançamento previsto criado ao aprovar
  aprovado_em timestamptz,
  concluido_em timestamptz,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investimentos TO authenticated;
GRANT ALL ON public.investimentos TO service_role;
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages investimentos" ON public.investimentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER invest_updated BEFORE UPDATE ON public.investimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
