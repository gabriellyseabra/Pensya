-- =========================================================
-- Tutorial guiado "Conheça o Pensya"
--
-- Progresso por usuário do passo a passo que usa o paciente modelo (Sofia)
-- para apresentar as funcionalidades. Cada pessoa da equipe tem o próprio
-- progresso; dispensar o tutorial não apaga nada (reversível pela Central
-- de Ajuda).
-- =========================================================

CREATE TABLE public.tutorial_progresso (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE DEFAULT public.my_org_id(),
  passos_concluidos text[] NOT NULL DEFAULT '{}',
  dispensado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progresso TO authenticated;
GRANT ALL ON public.tutorial_progresso TO service_role;
ALTER TABLE public.tutorial_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cada pessoa gerencia o proprio progresso"
  ON public.tutorial_progresso FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_tutorial_progresso_updated
  BEFORE UPDATE ON public.tutorial_progresso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
