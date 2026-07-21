
-- Fase 10/12: vínculo clínico para tarefas + cache de insights por paciente
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS sessao_id uuid REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reuniao_id uuid REFERENCES public.reunioes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_id uuid REFERENCES public.plano_metas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_paciente_status ON public.tarefas(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_tarefas_sessao ON public.tarefas(sessao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_reuniao ON public.tarefas(reuniao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_meta ON public.tarefas(meta_id);

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS insight_cache jsonb,
  ADD COLUMN IF NOT EXISTS insight_gerado_em timestamptz;
