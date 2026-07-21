
-- =========================================================
-- Expansão de pacientes
-- =========================================================
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS escolaridade text,
  ADD COLUMN IF NOT EXISTS serie_curso text,
  ADD COLUMN IF NOT EXISTS contato_escola text,
  ADD COLUMN IF NOT EXISTS autoriza_imagem boolean,
  ADD COLUMN IF NOT EXISTS hipotese_diagnostica boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS queixa_principal text,
  ADD COLUMN IF NOT EXISTS expectativas text,
  ADD COLUMN IF NOT EXISTS modelo_pagamento text CHECK (modelo_pagamento IN ('sessao','pacote','mensalidade')),
  ADD COLUMN IF NOT EXISTS valor_acordado numeric(10,2),
  ADD COLUMN IF NOT EXISTS dia_vencimento integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS numero_parcelas integer,
  ADD COLUMN IF NOT EXISTS motivo_status text,
  ADD COLUMN IF NOT EXISTS data_ultima_avaliacao date,
  ADD COLUMN IF NOT EXISTS data_alta date,
  ADD COLUMN IF NOT EXISTS data_inicio date;

-- =========================================================
-- Expansão de responsaveis
-- =========================================================
ALTER TABLE public.responsaveis
  ADD COLUMN IF NOT EXISTS idade integer,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS deseja_nf boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dados_nf text;

-- =========================================================
-- Cadastros públicos (tokens enviados para famílias)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cadastro_publico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_preenchimento','preenchido','convertido','expirado','arquivado')),
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  etapa_atual integer NOT NULL DEFAULT 1,
  paciente_id_criado uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  enviado_para_nome text,
  enviado_para_telefone text,
  observacoes_admin text,
  created_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  preenchido_em timestamptz,
  convertido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadastro_publico_token ON public.cadastro_publico(token);
CREATE INDEX IF NOT EXISTS idx_cadastro_publico_status ON public.cadastro_publico(status);

GRANT SELECT, INSERT, UPDATE ON public.cadastro_publico TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadastro_publico TO authenticated;
GRANT ALL ON public.cadastro_publico TO service_role;

ALTER TABLE public.cadastro_publico ENABLE ROW LEVEL SECURITY;

-- Anônimo só lê/atualiza se o token é válido e o cadastro está pendente/em preenchimento
CREATE POLICY "anon read by token" ON public.cadastro_publico
  FOR SELECT TO anon
  USING (status IN ('pendente','em_preenchimento') AND expires_at > now());

CREATE POLICY "anon update by token" ON public.cadastro_publico
  FOR UPDATE TO anon
  USING (status IN ('pendente','em_preenchimento') AND expires_at > now())
  WITH CHECK (status IN ('em_preenchimento','preenchido'));

CREATE POLICY "auth full" ON public.cadastro_publico
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cadastro_publico_updated
  BEFORE UPDATE ON public.cadastro_publico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Pré-anamnese vinculada ao paciente
-- =========================================================
CREATE TABLE IF NOT EXISTS public.paciente_pre_anamnese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL UNIQUE REFERENCES public.pacientes(id) ON DELETE CASCADE,
  cadastro_publico_id uuid REFERENCES public.cadastro_publico(id) ON DELETE SET NULL,
  contexto_familiar jsonb NOT NULL DEFAULT '{}'::jsonb,
  gestacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  parto jsonb NOT NULL DEFAULT '{}'::jsonb,
  saude jsonb NOT NULL DEFAULT '{}'::jsonb,
  tratamentos_anteriores jsonb NOT NULL DEFAULT '{}'::jsonb,
  outros_especialistas jsonb NOT NULL DEFAULT '{}'::jsonb,
  exames_clinicos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paciente_pre_anamnese TO authenticated;
GRANT ALL ON public.paciente_pre_anamnese TO service_role;
ALTER TABLE public.paciente_pre_anamnese ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.paciente_pre_anamnese FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pre_anamnese_updated BEFORE UPDATE ON public.paciente_pre_anamnese
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Documentos do paciente (Storage)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.paciente_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  categoria text,
  titulo text NOT NULL,
  descricao text,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  link_externo text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente ON public.paciente_documentos(paciente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paciente_documentos TO authenticated;
GRANT ALL ON public.paciente_documentos TO service_role;
ALTER TABLE public.paciente_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.paciente_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- Pagamentos (parcelas mensais)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  valor numeric(10,2) NOT NULL,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado','isento')),
  pago_em date,
  forma_pagamento text,
  observacoes text,
  nf_emitida boolean DEFAULT false,
  nf_numero text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, competencia)
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente ON public.pagamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.pagamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Templates de contrato + contratos emitidos (estrutura)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  modalidade_id uuid REFERENCES public.modalidades(id) ON DELETE SET NULL,
  conteudo_html text NOT NULL DEFAULT '',
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON public.contract_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage" ON public.contract_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_contract_templates_updated BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','assinado','expirado','cancelado')),
  signatario_nome text,
  signatario_email text,
  signatario_cpf text,
  dados_preenchimento jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path text,
  pdf_assinado_path text,
  provider text,
  provider_doc_id text,
  enviado_em timestamptz,
  assinado_em timestamptz,
  ip_assinatura text,
  hash_documento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contratos_paciente ON public.contratos(paciente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
