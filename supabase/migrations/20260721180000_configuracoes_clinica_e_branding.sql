-- Dados de identidade da clínica (nome, CNPJ, contato, logo), usados nos
-- documentos gerados (contrato, relatório, plano terapêutico) e na UI.
-- Singleton por enquanto (uma linha), preparado para virar por-organização
-- quando a Fase 1 (multi-clínica) for implementada.
CREATE TABLE public.configuracoes_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_clinica text,
  razao_social text,
  cnpj text,
  endereco text,
  cidade text,
  telefone text,
  email text,
  responsavel_nome text,
  logo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.configuracoes_clinica TO anon;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_clinica TO authenticated;
GRANT ALL ON public.configuracoes_clinica TO service_role;
ALTER TABLE public.configuracoes_clinica ENABLE ROW LEVEL SECURITY;

-- Leitura pública: necessário para páginas sem login (assinatura de
-- contrato por token, agenda pública de salas) mostrarem a logo/nome da clínica.
CREATE POLICY "Leitura publica configuracoes_clinica" ON public.configuracoes_clinica
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin gerencia configuracoes_clinica" ON public.configuracoes_clinica
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_configuracoes_clinica_updated BEFORE UPDATE ON public.configuracoes_clinica
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket público para a logo da clínica (precisa ser visível em documentos
-- impressos/PDF e na página pública de assinatura de contrato).
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinica-branding', 'clinica-branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "clinica-branding leitura publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinica-branding');

CREATE POLICY "clinica-branding admin insere" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinica-branding' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "clinica-branding admin atualiza" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinica-branding' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "clinica-branding admin remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinica-branding' AND public.has_role(auth.uid(), 'admin'::app_role));
