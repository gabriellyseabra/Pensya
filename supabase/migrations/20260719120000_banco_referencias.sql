-- =========================================================
-- Banco de Referências (Módulo 3)
-- Artigos, ebooks, capítulos e diretrizes que alimentam a IA (plano terapêutico,
-- síntese de sessão, raciocínio clínico e relatórios de avaliação). A profissional
-- cadastra uma vez; as referências relevantes (por tags/domínio) ou fixadas entram
-- automaticamente no contexto das gerações.
-- Idempotente.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  autores text,
  ano integer,
  tipo text NOT NULL DEFAULT 'artigo' CHECK (tipo IN ('artigo','ebook','livro','capitulo','diretriz','outro')),
  link text,
  arquivo_path text,
  resumo text,
  -- texto integral extraído do PDF (via IA), usado para fundamentar a IA
  texto_extraido text,
  -- habilidades/temas/domínios que a referência cobre (casa com o contexto do caso)
  tags text[] NOT NULL DEFAULT '{}',
  dominio text,
  -- pin global: sempre incluída no contexto da IA, independente das tags
  fixada boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referencias_ativo ON public.referencias (ativo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referencias TO authenticated;
GRANT ALL ON public.referencias TO service_role;
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam referencias" ON public.referencias;
CREATE POLICY "Autenticados gerenciam referencias"
  ON public.referencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_referencias_updated ON public.referencias;
CREATE TRIGGER trg_referencias_updated BEFORE UPDATE ON public.referencias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
