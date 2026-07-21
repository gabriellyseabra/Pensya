-- Modo "visão de clínica" da admin da plataforma: registra qual clínica
-- a pensya_admin está visitando no momento.
CREATE TABLE public.admin_visao_org (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_visao_org ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Pensya gerencia a propria visao" ON public.admin_visao_org
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_pensya_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_pensya_admin());