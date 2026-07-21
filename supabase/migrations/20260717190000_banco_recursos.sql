-- =========================================================
-- Banco de Recursos do consultório (Módulo 2)
-- Jogos, materiais, estratégias, atividades e tecnologias organizados por
-- habilidades/domínios (tags), para apoiar a escolha de recursos nas sessões.
-- Idempotente.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'material' CHECK (tipo IN ('jogo','material','estrategia','atividade','tecnologia','outro')),
  descricao text,
  link text,
  arquivo_path text,
  dominio text,
  -- habilidades/temas trabalhados (organiza o banco)
  tags text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recursos_ativo ON public.recursos (ativo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos TO authenticated;
GRANT ALL ON public.recursos TO service_role;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam recursos" ON public.recursos;
CREATE POLICY "Autenticados gerenciam recursos"
  ON public.recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_recursos_updated ON public.recursos;
CREATE TRIGGER trg_recursos_updated BEFORE UPDATE ON public.recursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
