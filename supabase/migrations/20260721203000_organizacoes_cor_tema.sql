-- Cor do tema do sistema, configurável por clínica:
-- 'roxo' (violeta Pensya, padrão), 'azul' (azul Pensya) ou 'preto'.
ALTER TABLE public.organizacoes
  ADD COLUMN cor_tema text NOT NULL DEFAULT 'roxo'
  CHECK (cor_tema IN ('preto', 'azul', 'roxo'));
