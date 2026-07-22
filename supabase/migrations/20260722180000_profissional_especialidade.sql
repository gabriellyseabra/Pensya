-- Vincula profissional interno a uma especialidade (faltava a coluna, então
-- a associação de especialidade na equipe nunca chegava a ser salva).
ALTER TABLE public.profissionais_consultorio
  ADD COLUMN IF NOT EXISTS especialidade_id uuid REFERENCES public.especialidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prof_consultorio_especialidade
  ON public.profissionais_consultorio(especialidade_id);
