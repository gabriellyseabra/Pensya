
-- Metas terapêuticas (esqueleto F1; expandido na F3)
CREATE TABLE public.metas_terapeuticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  dominio_cognitivo text,
  prioridade integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'planejamento',
  ordem integer NOT NULL DEFAULT 0,
  iniciada_em date,
  concluida_em date,
  plano_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_terapeuticas TO authenticated;
GRANT ALL ON public.metas_terapeuticas TO service_role;
ALTER TABLE public.metas_terapeuticas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all metas" ON public.metas_terapeuticas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_metas_paciente ON public.metas_terapeuticas(paciente_id);

-- Sessões clínicas (separadas dos atendimentos/agenda)
CREATE TABLE public.prontuario_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  profissional_id uuid,
  atendimento_id uuid,
  data_sessao date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time,
  duracao_min integer,
  engajamento integer,
  nivel_suporte text,
  recursos_utilizados text[],
  evolucao text,
  observacoes text,
  orientacao_casa boolean NOT NULL DEFAULT false,
  orientacao_texto text,
  orientacao_anexo_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prontuario_sessoes TO authenticated;
GRANT ALL ON public.prontuario_sessoes TO service_role;
ALTER TABLE public.prontuario_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sessoes" ON public.prontuario_sessoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_sessoes_paciente ON public.prontuario_sessoes(paciente_id, data_sessao DESC);

-- Sessão ↔ metas (N:N) com progresso por meta naquela sessão
CREATE TABLE public.sessao_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.prontuario_sessoes(id) ON DELETE CASCADE,
  meta_id uuid NOT NULL REFERENCES public.metas_terapeuticas(id) ON DELETE CASCADE,
  engajamento integer,
  nivel_suporte text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sessao_id, meta_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessao_metas TO authenticated;
GRANT ALL ON public.sessao_metas TO service_role;
ALTER TABLE public.sessao_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all sessao_metas" ON public.sessao_metas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Frequência (registro clínico - presente, falta justif/n-justif, reposição, cancelado)
CREATE TABLE public.frequencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  profissional_id uuid,
  atendimento_id uuid,
  sessao_id uuid REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL,
  data_referencia date NOT NULL,
  tipo text NOT NULL,
  motivo text,
  reposto_em date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia TO authenticated;
GRANT ALL ON public.frequencia TO service_role;
ALTER TABLE public.frequencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all frequencia" ON public.frequencia FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_frequencia_paciente ON public.frequencia(paciente_id, data_referencia DESC);

-- Triggers updated_at
CREATE TRIGGER trg_metas_updated BEFORE UPDATE ON public.metas_terapeuticas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sessoes_updated BEFORE UPDATE ON public.prontuario_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
