
-- ========== PLANO DE CONTAS ==========
CREATE TABLE public.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  parent_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_contas TO authenticated;
GRANT ALL ON public.plano_contas TO service_role;
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages plano_contas" ON public.plano_contas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_plano_contas_updated BEFORE UPDATE ON public.plano_contas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== CONTAS / CAIXAS ==========
CREATE TABLE public.contas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('conta_corrente','caixa','pix','cartao_credito','aplicacao','outra')),
  saldo_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_financeiras TO authenticated;
GRANT ALL ON public.contas_financeiras TO service_role;
ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages contas" ON public.contas_financeiras
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_contas_updated BEFORE UPDATE ON public.contas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== TIPOS DE SERVIÇO / PRODUTO ==========
CREATE TABLE public.tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  valor_padrao numeric,
  plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_servico TO authenticated;
GRANT ALL ON public.tipos_servico TO service_role;
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages tipos_servico" ON public.tipos_servico
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_tipos_servico_updated BEFORE UPDATE ON public.tipos_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== CENTROS DE CUSTO ==========
CREATE TABLE public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages centros_custo" ON public.centros_custo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- ========== FORNECEDORES ==========
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages fornecedores" ON public.fornecedores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== LANÇAMENTOS FINANCEIROS ==========
CREATE TABLE public.lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','confirmado','cancelado')),
  descricao text NOT NULL,
  valor numeric NOT NULL,
  competencia date NOT NULL,
  vencimento date NOT NULL,
  pago_em date,
  conta_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  conta_destino_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  paciente_id uuid,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  pagamento_id uuid,
  forma_pagamento text,
  comprovante_path text,
  observacoes text,
  recorrencia_grupo uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lanc_vencimento ON public.lancamentos_financeiros(vencimento);
CREATE INDEX idx_lanc_status ON public.lancamentos_financeiros(status);
CREATE INDEX idx_lanc_tipo ON public.lancamentos_financeiros(tipo);
CREATE INDEX idx_lanc_paciente ON public.lancamentos_financeiros(paciente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_financeiros TO authenticated;
GRANT ALL ON public.lancamentos_financeiros TO service_role;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages lancamentos" ON public.lancamentos_financeiros
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== INFINITEPAY ==========
CREATE TABLE public.infinitepay_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  gerar_link_automatico boolean NOT NULL DEFAULT false,
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infinitepay_config TO authenticated;
GRANT ALL ON public.infinitepay_config TO service_role;
ALTER TABLE public.infinitepay_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages infinitepay_config" ON public.infinitepay_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_ipay_config_updated BEFORE UPDATE ON public.infinitepay_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.infinitepay_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  tipo text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pagamento_id uuid,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  status_processamento text NOT NULL DEFAULT 'processado',
  erro text,
  recebido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ipay_eventos_event_id ON public.infinitepay_eventos(event_id);
CREATE INDEX idx_ipay_eventos_pagamento ON public.infinitepay_eventos(pagamento_id);
GRANT SELECT ON public.infinitepay_eventos TO authenticated;
GRANT ALL ON public.infinitepay_eventos TO service_role;
ALTER TABLE public.infinitepay_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads infinitepay_eventos" ON public.infinitepay_eventos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- ========== AJUSTES EM PAGAMENTOS (Fase 2) ==========
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS infinitepay_invoice_id text,
  ADD COLUMN IF NOT EXISTS infinitepay_checkout_url text,
  ADD COLUMN IF NOT EXISTS infinitepay_status text,
  ADD COLUMN IF NOT EXISTS valor_recebido numeric,
  ADD COLUMN IF NOT EXISTS taxa_infinitepay numeric;
CREATE INDEX IF NOT EXISTS idx_pag_ipay_invoice ON public.pagamentos(infinitepay_invoice_id);

-- ========== SEEDS ==========
-- Plano de contas padrão
WITH receitas AS (
  INSERT INTO public.plano_contas (codigo,nome,tipo,ordem) VALUES ('3','Receitas','receita',1) RETURNING id
), despesas AS (
  INSERT INTO public.plano_contas (codigo,nome,tipo,ordem) VALUES ('4','Despesas','despesa',2) RETURNING id
)
INSERT INTO public.plano_contas (codigo,nome,tipo,parent_id,ordem)
SELECT * FROM (
  SELECT '3.1','Serviços prestados','receita',(SELECT id FROM receitas),1
  UNION ALL SELECT '3.2','Vendas de produtos','receita',(SELECT id FROM receitas),2
  UNION ALL SELECT '3.9','Outras receitas','receita',(SELECT id FROM receitas),9
  UNION ALL SELECT '4.1','Folha de pagamento','despesa',(SELECT id FROM despesas),1
  UNION ALL SELECT '4.2','Ocupação (aluguel, energia, água, internet)','despesa',(SELECT id FROM despesas),2
  UNION ALL SELECT '4.3','Materiais clínicos','despesa',(SELECT id FROM despesas),3
  UNION ALL SELECT '4.4','Material de escritório','despesa',(SELECT id FROM despesas),4
  UNION ALL SELECT '4.5','Marketing','despesa',(SELECT id FROM despesas),5
  UNION ALL SELECT '4.6','Capacitação e cursos','despesa',(SELECT id FROM despesas),6
  UNION ALL SELECT '4.7','Manutenção','despesa',(SELECT id FROM despesas),7
  UNION ALL SELECT '4.8','Impostos','despesa',(SELECT id FROM despesas),8
  UNION ALL SELECT '4.9','Taxas bancárias / maquininhas','despesa',(SELECT id FROM despesas),9
  UNION ALL SELECT '4.10','Software / SaaS','despesa',(SELECT id FROM despesas),10
  UNION ALL SELECT '4.99','Outras despesas','despesa',(SELECT id FROM despesas),99
) AS t(codigo,nome,tipo,parent_id,ordem);

-- Tipos de serviço comuns
INSERT INTO public.tipos_servico (nome, valor_padrao) VALUES
  ('Avaliação', NULL),
  ('Sessão individual', NULL),
  ('Sessão em grupo', NULL),
  ('Devolutiva', NULL),
  ('Relatório', NULL);

-- Contas/caixas padrão
INSERT INTO public.contas_financeiras (nome, tipo, ordem) VALUES
  ('Conta corrente principal', 'conta_corrente', 1),
  ('PIX', 'pix', 2),
  ('Caixa', 'caixa', 3);
