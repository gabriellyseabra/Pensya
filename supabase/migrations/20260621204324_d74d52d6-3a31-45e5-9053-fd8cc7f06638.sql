ALTER TABLE public.testes_catalogo
ADD COLUMN IF NOT EXISTS formula_agregacao text;

COMMENT ON COLUMN public.testes_catalogo.formula_agregacao IS 'Como agregar variáveis em um escore global: nenhuma | soma_brutos | media_padrao | media_percentil | min_percentil | max_percentil';