CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.documento_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('evolucao','plano_terapeutico','laudo','reuniao','livre')),
  descricao TEXT,
  estrutura TEXT NOT NULL,
  instrucoes_extra TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_templates TO authenticated;
GRANT ALL ON public.documento_templates TO service_role;

ALTER TABLE public.documento_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver templates"
  ON public.documento_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem criar templates"
  ON public.documento_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Criador pode editar template"
  ON public.documento_templates FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Criador pode excluir template"
  ON public.documento_templates FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_documento_templates_updated_at
  BEFORE UPDATE ON public.documento_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_documento_templates_tipo ON public.documento_templates(tipo) WHERE ativo;