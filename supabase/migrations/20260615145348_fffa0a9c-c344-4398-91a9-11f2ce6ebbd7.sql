ALTER TABLE public.testes_catalogo
  ADD COLUMN IF NOT EXISTS cif_dimensoes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cif_descricao text;

ALTER TABLE public.testes_aplicados
  ADD COLUMN IF NOT EXISTS impactos_cif jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS interpretacao_clinica text;

COMMENT ON COLUMN public.testes_catalogo.cif_dimensoes IS 'Array de dimensões CIF que o instrumento avalia. Ex: [{"dim":"funcoes_corporais","detalhe":"Atenção sustentada"}]';
COMMENT ON COLUMN public.testes_aplicados.impactos_cif IS 'Array de impactos do resultado. Ex: [{"dim":"atividade_participacao","tipo":"fragilidade","nota":"dificuldade em tarefas escolares"}]';