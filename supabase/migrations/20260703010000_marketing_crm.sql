-- =========================================================
-- Módulo de Marketing / Comercial: CRM de pipeline de leads,
-- campanhas de marketing e biblioteca de scripts
-- =========================================================

-- ============ CANAIS DE MARKETING (lookup) ============
CREATE TABLE public.canais_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo_origem text UNIQUE CHECK (tipo_origem IS NULL OR tipo_origem IN ('indicacao', 'escola')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canais_marketing TO authenticated;
GRANT ALL ON public.canais_marketing TO service_role;
ALTER TABLE public.canais_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.canais_marketing FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.canais_marketing (nome, tipo_origem) VALUES
  ('Instagram', NULL), ('Facebook/Meta Ads', NULL), ('Google Ads', NULL), ('Indicação', 'indicacao'),
  ('Site', NULL), ('Evento', NULL), ('WhatsApp', NULL), ('Outro', NULL);

-- ============ ETAPAS DO PIPELINE (funil configurável) ============
CREATE TABLE public.pipeline_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#064570',
  tipo text NOT NULL DEFAULT 'ativo' CHECK (tipo IN ('ativo', 'ganho', 'perdido')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_etapas_ordem ON public.pipeline_etapas (ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_etapas TO authenticated;
GRANT ALL ON public.pipeline_etapas TO service_role;
ALTER TABLE public.pipeline_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.pipeline_etapas FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.pipeline_etapas (nome, ordem, cor, tipo) VALUES
  ('Novo lead', 1, '#064570', 'ativo'),
  ('Contato feito', 2, '#5585b1', 'ativo'),
  ('Qualificação', 3, '#5585b1', 'ativo'),
  ('Agendamento/Proposta', 4, '#f9ca0a', 'ativo'),
  ('Fechado', 5, '#10b981', 'ganho'),
  ('Perdido', 6, '#ef4444', 'perdido');

-- ============ CAMPANHAS ============
CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  canal_id uuid REFERENCES public.canais_marketing(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'ativa', 'pausada', 'encerrada')),
  data_inicio date,
  data_fim date,
  orcamento numeric,
  custo_realizado numeric,
  meta_leads integer,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.campanhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_campanhas_updated BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEADS ============
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_paciente text,
  telefone text,
  email text,
  canal_id uuid REFERENCES public.canais_marketing(id) ON DELETE SET NULL,
  campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL,
  etapa_id uuid NOT NULL REFERENCES public.pipeline_etapas(id) ON DELETE RESTRICT,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  valor_estimado numeric,
  motivo_perda text,
  observacoes text,
  paciente_id_criado uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  convertido_em timestamptz,
  entrou_em timestamptz NOT NULL DEFAULT now(),
  etapa_atualizada_em timestamptz NOT NULL DEFAULT now(),
  ultimo_contato_em timestamptz,
  proximo_contato_em timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_etapa ON public.leads (etapa_id);
CREATE INDEX idx_leads_campanha ON public.leads (campanha_id);
CREATE INDEX idx_leads_responsavel ON public.leads (responsavel_id);
CREATE INDEX idx_leads_proximo_contato ON public.leads (proximo_contato_em);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INTERAÇÕES DO LEAD (timeline/histórico) ============
CREATE TABLE public.lead_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ligacao', 'whatsapp', 'email', 'reuniao', 'nota', 'mudanca_etapa', 'conversao')),
  descricao text,
  etapa_anterior_id uuid REFERENCES public.pipeline_etapas(id) ON DELETE SET NULL,
  etapa_nova_id uuid REFERENCES public.pipeline_etapas(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_interacoes_lead ON public.lead_interacoes (lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_interacoes TO authenticated;
GRANT ALL ON public.lead_interacoes TO service_role;
ALTER TABLE public.lead_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.lead_interacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SCRIPTS (abordagem, objeções, follow-up etc.) ============
CREATE TABLE public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'outro' CHECK (categoria IN (
    'abordagem_inicial', 'qualificacao', 'agendamento', 'objecoes', 'follow_up', 'pos_venda', 'outro'
  )),
  conteudo text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  favorito boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scripts_categoria ON public.scripts (categoria);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_scripts_updated BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FOLLOW-UPS DE LEADS REAPROVEITANDO TAREFAS ============
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tarefas_lead ON public.tarefas (lead_id);
