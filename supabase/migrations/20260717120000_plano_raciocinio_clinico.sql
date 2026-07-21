-- =========================================================
-- Plano Terapêutico — Raciocínio Clínico Assistido (Fase 1)
-- Formulação Clínica estruturada (CIF) + Priorização + Objetivos funcionais
-- + Mapa da Meta (componentes clínicos, fontes/evidências, grau de confiança)
-- + critérios de progressão/alta por meta.
-- A síntese do raciocínio + priorização + fontes usadas reaproveitam a coluna
-- planos_terapeuticos.raciocinio_clinico (jsonb) já existente.
-- Migração idempotente (segura para reaplicar).
-- =========================================================

-- ============ FORMULAÇÃO CLÍNICA (itens estruturados por categoria CIF) ============
-- categoria:
--   restricao_participacao | limitacao_atividade | funcao_relacionada
--   | fator_ambiental | fator_pessoal
-- impacto  → restrições/limitações (leve/moderado/grave)
-- confianca → funções relacionadas (hipóteses explicativas: alta/media/baixa)
-- os 4 escores (1-5) alimentam a priorização automática (ETAPA 4)
CREATE TABLE IF NOT EXISTS public.plano_formulacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN (
    'restricao_participacao','limitacao_atividade','funcao_relacionada',
    'fator_ambiental','fator_pessoal'
  )),
  descricao text NOT NULL,
  cif_codigo text,
  impacto text CHECK (impacto IN ('leve','moderado','grave')),
  confianca text CHECK (confianca IN ('alta','media','baixa')),
  impacto_funcional smallint CHECK (impacto_funcional BETWEEN 1 AND 5),
  urgencia smallint CHECK (urgencia BETWEEN 1 AND 5),
  potencial_mudanca smallint CHECK (potencial_mudanca BETWEEN 1 AND 5),
  frequencia smallint CHECK (frequencia BETWEEN 1 AND 5),
  prioridade smallint,
  origem text NOT NULL DEFAULT 'ia',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_formulacao_plano ON public.plano_formulacao_itens (plano_id, categoria);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_formulacao_itens TO authenticated;
GRANT ALL ON public.plano_formulacao_itens TO service_role;
ALTER TABLE public.plano_formulacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam formulação" ON public.plano_formulacao_itens;
CREATE POLICY "Autenticados gerenciam formulação"
  ON public.plano_formulacao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_plano_formulacao_updated ON public.plano_formulacao_itens;
CREATE TRIGGER trg_plano_formulacao_updated BEFORE UPDATE ON public.plano_formulacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ OBJETIVOS TERAPÊUTICOS (poucos, cada um = domínio funcional) ============
CREATE TABLE IF NOT EXISTS public.plano_objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_terapeuticos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  dominio_funcional text,
  descricao text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','suspenso')),
  origem text NOT NULL DEFAULT 'ia',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_objetivos_plano ON public.plano_objetivos (plano_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_objetivos TO authenticated;
GRANT ALL ON public.plano_objetivos TO service_role;
ALTER TABLE public.plano_objetivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam objetivos" ON public.plano_objetivos;
CREATE POLICY "Autenticados gerenciam objetivos"
  ON public.plano_objetivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_plano_objetivos_updated ON public.plano_objetivos;
CREATE TRIGGER trg_plano_objetivos_updated BEFORE UPDATE ON public.plano_objetivos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MAPA DA META: componentes clínicos que SUSTENTAM a meta ============
-- (NÃO são metas — são os fatores/funções que a meta mobiliza)
CREATE TABLE IF NOT EXISTS public.plano_meta_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.plano_metas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_meta_componentes_meta ON public.plano_meta_componentes (meta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_meta_componentes TO authenticated;
GRANT ALL ON public.plano_meta_componentes TO service_role;
ALTER TABLE public.plano_meta_componentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam componentes de meta" ON public.plano_meta_componentes;
CREATE POLICY "Autenticados gerenciam componentes de meta"
  ON public.plano_meta_componentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MAPA DA META: fontes/evidências que ORIGINARAM a meta ============
-- (distinto de plano_evidencias, que guarda artigos PubMed)
CREATE TABLE IF NOT EXISTS public.plano_meta_fontes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.plano_metas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'anamnese','entrevista_familiar','avaliacao','teste','protocolo','observacao',
    'sessao_avaliacao','reuniao_escolar','relatorio_escolar','relatorio_medico',
    'arquivo','complementar'
  )),
  referencia text,
  detalhe text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_meta_fontes_meta ON public.plano_meta_fontes (meta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_meta_fontes TO authenticated;
GRANT ALL ON public.plano_meta_fontes TO service_role;
ALTER TABLE public.plano_meta_fontes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam fontes de meta" ON public.plano_meta_fontes;
CREATE POLICY "Autenticados gerenciam fontes de meta"
  ON public.plano_meta_fontes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MAPA DA META + PLANO POR META: novas colunas em plano_metas ============
ALTER TABLE public.plano_metas
  ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES public.plano_objetivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restricao_funcional text,
  ADD COLUMN IF NOT EXISTS grau_confianca text CHECK (grau_confianca IN ('alta','media','baixa')),
  ADD COLUMN IF NOT EXISTS confianca_justificativa text,
  ADD COLUMN IF NOT EXISTS recursos text,
  ADD COLUMN IF NOT EXISTS ordem_progressao smallint,
  ADD COLUMN IF NOT EXISTS criterios_progressao text,
  ADD COLUMN IF NOT EXISTS criterios_alta text;

CREATE INDEX IF NOT EXISTS idx_plano_metas_objetivo ON public.plano_metas (objetivo_id);
