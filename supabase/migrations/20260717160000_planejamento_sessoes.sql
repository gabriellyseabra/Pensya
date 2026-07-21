-- =========================================================
-- Planejamento de Sessões (Módulo A)
-- Planeja as próximas sessões de intervenção por paciente/plano: metas-foco
-- (pela ordem de progressão), objetivo/estratégias da sessão e status.
-- Complementa a "nota para a próxima sessão" (carry-forward) já existente.
-- Idempotente.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.sessao_planejamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos_terapeuticos(id) ON DELETE SET NULL,
  data_prevista date,
  ordem integer NOT NULL DEFAULT 0,
  -- ids de metas_terapeuticas a trabalhar nesta sessão
  metas_foco uuid[] NOT NULL DEFAULT '{}',
  foco text,
  estrategias text,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','realizada','cancelada')),
  -- sessão realizada vinculada (quando registrada)
  sessao_id uuid REFERENCES public.prontuario_sessoes(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessao_planejamentos_paciente
  ON public.sessao_planejamentos (paciente_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessao_planejamentos TO authenticated;
GRANT ALL ON public.sessao_planejamentos TO service_role;
ALTER TABLE public.sessao_planejamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam planejamento de sessões" ON public.sessao_planejamentos;
CREATE POLICY "Autenticados gerenciam planejamento de sessões"
  ON public.sessao_planejamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_sessao_planejamentos_updated ON public.sessao_planejamentos;
CREATE TRIGGER trg_sessao_planejamentos_updated BEFORE UPDATE ON public.sessao_planejamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
