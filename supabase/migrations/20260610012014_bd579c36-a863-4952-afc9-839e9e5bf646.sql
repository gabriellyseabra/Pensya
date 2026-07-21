
-- ============= PLANOS TERAPÊUTICOS =============
CREATE TABLE public.planos_terapeuticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Plano Terapêutico',
  ciclo_semanas integer NOT NULL DEFAULT 12,
  data_inicio date DEFAULT CURRENT_DATE,
  data_revisao_prevista date,
  status text NOT NULL DEFAULT 'rascunho',
  -- Contexto clínico
  queixa_principal text,
  diagnostico_resumo text,
  medicacao text,
  frequencia_sessoes text,
  -- Perfil CIF
  cif_funcoes text,
  cif_funcoes_impacto text,
  cif_atividades text,
  cif_atividades_impacto text,
  cif_participacao text,
  cif_participacao_impacto text,
  cif_ambientais text,
  cif_pessoais text,
  -- Objetivo
  objetivo_participacao text,
  -- Orientações
  orientacoes_familia text,
  orientacoes_escola text,
  parceiros_clinicos text,
  -- Revisão
  observacoes_revisao text,
  data_revisao_realizada date,
  -- Metadados
  ai_gerado_em timestamptz,
  ai_modelo text,
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES auth.users(id),
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_planos_paciente ON public.planos_terapeuticos(paciente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_terapeuticos TO authenticated;
GRANT ALL ON public.planos_terapeuticos TO service_role;
ALTER TABLE public.planos_terapeuticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam planos terapêuticos"
  ON public.planos_terapeuticos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON public.planos_terapeuticos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= METAS DO PLANO =============
CREATE TABLE public.plano_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  meta_terapeutica_id uuid REFERENCES public.metas_terapeuticas(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  dominio text,
  titulo_smart text NOT NULL,
  baseline text,
  prazo_semanas integer,
  justificativa text,
  nivel_gas_atingido smallint,
  data_revisao date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plano_metas_plano ON public.plano_metas(plano_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_metas TO authenticated;
GRANT ALL ON public.plano_metas TO service_role;
ALTER TABLE public.plano_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam metas de plano"
  ON public.plano_metas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_plano_metas_updated BEFORE UPDATE ON public.plano_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ESCALA GAS POR META =============
CREATE TABLE public.plano_gas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.plano_metas(id) ON DELETE CASCADE,
  nivel smallint NOT NULL CHECK (nivel BETWEEN -2 AND 2),
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_id, nivel)
);
CREATE INDEX idx_plano_gas_meta ON public.plano_gas(meta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_gas TO authenticated;
GRANT ALL ON public.plano_gas TO service_role;
ALTER TABLE public.plano_gas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam GAS"
  ON public.plano_gas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============= ESTRATÉGIAS DE INTERVENÇÃO =============
CREATE TABLE public.plano_estrategias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.plano_metas(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  nome text NOT NULL,
  justificativa text,
  como_aplicar text,
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plano_estrategias_meta ON public.plano_estrategias(meta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_estrategias TO authenticated;
GRANT ALL ON public.plano_estrategias TO service_role;
ALTER TABLE public.plano_estrategias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam estratégias"
  ON public.plano_estrategias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_plano_estrategias_updated BEFORE UPDATE ON public.plano_estrategias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= EVIDÊNCIAS (PubMed) =============
CREATE TABLE public.plano_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  meta_id uuid REFERENCES public.plano_metas(id) ON DELETE SET NULL,
  pmid text,
  titulo text NOT NULL,
  autores text,
  ano integer,
  journal text,
  url text,
  resumo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plano_evidencias_plano ON public.plano_evidencias(plano_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_evidencias TO authenticated;
GRANT ALL ON public.plano_evidencias TO service_role;
ALTER TABLE public.plano_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam evidências"
  ON public.plano_evidencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============= Sessões: vincular GAS observado =============
ALTER TABLE public.sessao_metas
  ADD COLUMN IF NOT EXISTS plano_meta_id uuid REFERENCES public.plano_metas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nivel_gas_observado smallint;
