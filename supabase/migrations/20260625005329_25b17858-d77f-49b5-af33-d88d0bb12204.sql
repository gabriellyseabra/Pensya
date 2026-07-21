
-- 1. Pacientes: soft delete
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS arquivado_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_pacientes_arquivado ON public.pacientes(arquivado);

-- 2. Salas
CREATE TABLE IF NOT EXISTS public.salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text DEFAULT '#3b82f6',
  capacidade integer,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salas TO authenticated;
GRANT ALL ON public.salas TO service_role;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salas read" ON public.salas FOR SELECT TO authenticated USING (true);
CREATE POLICY "salas admin write" ON public.salas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_salas_updated BEFORE UPDATE ON public.salas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Sublocadores
CREATE TABLE IF NOT EXISTS public.sublocadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  telefone text,
  email text,
  especialidade text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublocadores TO authenticated;
GRANT ALL ON public.sublocadores TO service_role;
ALTER TABLE public.sublocadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sublocadores read" ON public.sublocadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "sublocadores admin write" ON public.sublocadores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_sublocadores_updated BEFORE UPDATE ON public.sublocadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Contratos
CREATE TABLE IF NOT EXISTS public.sublocacao_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sublocador_id uuid NOT NULL REFERENCES public.sublocadores(id) ON DELETE CASCADE,
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  modelo text NOT NULL CHECK (modelo IN ('fixo_sessao','fixo_hora','percentual','mensal_extras')),
  valor_base numeric(12,2),
  percentual numeric(5,2),
  valor_mensal numeric(12,2),
  valor_extra numeric(12,2),
  vigencia_inicio date,
  vigencia_fim date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublocacao_contratos TO authenticated;
GRANT ALL ON public.sublocacao_contratos TO service_role;
ALTER TABLE public.sublocacao_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contratos read" ON public.sublocacao_contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "contratos admin write" ON public.sublocacao_contratos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subcontratos_updated BEFORE UPDATE ON public.sublocacao_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Disponibilidade
CREATE TABLE IF NOT EXISTS public.sublocacao_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  tipo text NOT NULL DEFAULT 'bloqueada' CHECK (tipo IN ('disponivel','bloqueada')),
  recorrencia_json jsonb,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublocacao_disponibilidade TO authenticated;
GRANT ALL ON public.sublocacao_disponibilidade TO service_role;
ALTER TABLE public.sublocacao_disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispo read" ON public.sublocacao_disponibilidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "dispo admin write" ON public.sublocacao_disponibilidade FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_dispo_updated BEFORE UPDATE ON public.sublocacao_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Usos / sessões da sublocação
CREATE TABLE IF NOT EXISTS public.sublocacao_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.sublocacao_contratos(id) ON DELETE RESTRICT,
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE RESTRICT,
  sublocador_id uuid NOT NULL REFERENCES public.sublocadores(id) ON DELETE RESTRICT,
  data date NOT NULL,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  duracao_min integer,
  valor_atendimento numeric(12,2),
  valor_calculado numeric(12,2) NOT NULL DEFAULT 0,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usos_data ON public.sublocacao_usos(data);
CREATE INDEX IF NOT EXISTS idx_usos_sala ON public.sublocacao_usos(sala_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sublocacao_usos TO authenticated;
GRANT ALL ON public.sublocacao_usos TO service_role;
ALTER TABLE public.sublocacao_usos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usos read" ON public.sublocacao_usos FOR SELECT TO authenticated USING (true);
CREATE POLICY "usos admin write" ON public.sublocacao_usos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_usos_updated BEFORE UPDATE ON public.sublocacao_usos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
