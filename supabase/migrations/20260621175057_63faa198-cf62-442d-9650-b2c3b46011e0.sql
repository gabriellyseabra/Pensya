
CREATE TABLE public.baterias_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  demanda text NOT NULL,
  descricao text,
  faixa_etaria text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baterias_modelo TO authenticated;
GRANT ALL ON public.baterias_modelo TO service_role;
ALTER TABLE public.baterias_modelo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage baterias_modelo" ON public.baterias_modelo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_baterias_modelo_upd BEFORE UPDATE ON public.baterias_modelo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.baterias_modelo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bateria_id uuid NOT NULL REFERENCES public.baterias_modelo(id) ON DELETE CASCADE,
  teste_id uuid NOT NULL REFERENCES public.testes_catalogo(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  obrigatorio boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baterias_modelo_itens TO authenticated;
GRANT ALL ON public.baterias_modelo_itens TO service_role;
ALTER TABLE public.baterias_modelo_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage baterias_modelo_itens" ON public.baterias_modelo_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_bmi_bateria ON public.baterias_modelo_itens(bateria_id, ordem);

ALTER TABLE public.testes_aplicados
  ADD COLUMN IF NOT EXISTS variaveis_valores jsonb NOT NULL DEFAULT '{}'::jsonb;
