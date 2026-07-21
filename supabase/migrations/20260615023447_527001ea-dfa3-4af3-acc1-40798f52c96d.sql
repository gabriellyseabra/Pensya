ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS criador_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_tarefas_departamento ON public.tarefas(departamento);
CREATE INDEX IF NOT EXISTS idx_tarefas_origem ON public.tarefas(origem);