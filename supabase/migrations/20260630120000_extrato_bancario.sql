-- =========================================================
-- Importação de extrato bancário (OFX) com categorização
-- automática e aprovação manual
-- =========================================================

CREATE TABLE public.extrato_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_financeira_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  nome_arquivo text,
  periodo_inicio date,
  periodo_fim date,
  total_linhas integer NOT NULL DEFAULT 0,
  total_novas integer NOT NULL DEFAULT 0,
  total_duplicadas integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_lotes TO authenticated;
GRANT ALL ON public.extrato_lotes TO service_role;
ALTER TABLE public.extrato_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.extrato_lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.extrato_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.extrato_lotes(id) ON DELETE CASCADE,
  conta_financeira_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  fitid text NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  natureza text NOT NULL CHECK (natureza IN ('receita','despesa')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','ignorado','duplicado')),
  sugestao_origem text,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_financeira_id, fitid)
);
CREATE INDEX idx_extrato_transacoes_lote ON public.extrato_transacoes(lote_id);
CREATE INDEX idx_extrato_transacoes_status ON public.extrato_transacoes(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_transacoes TO authenticated;
GRANT ALL ON public.extrato_transacoes TO service_role;
ALTER TABLE public.extrato_transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.extrato_transacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.extrato_identificadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao text NOT NULL,
  natureza text NOT NULL CHECK (natureza IN ('receita','despesa')),
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  plano_conta_id uuid REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  ocorrencias integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (padrao, natureza)
);
CREATE INDEX idx_extrato_identificadores_padrao ON public.extrato_identificadores(padrao);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extrato_identificadores TO authenticated;
GRANT ALL ON public.extrato_identificadores TO service_role;
ALTER TABLE public.extrato_identificadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.extrato_identificadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_extrato_identificadores_updated BEFORE UPDATE ON public.extrato_identificadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
