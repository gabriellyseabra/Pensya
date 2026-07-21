-- =========================================================
-- Devolutivas Clínicas Automáticas (Fase 3 · ETAPA 13)
-- Síntese clínica do ciclo gerada por IA a partir das evidências registradas
-- nas sessões (GAS, evidências clínicas, componentes, progresso, variáveis
-- transversais). Idempotente.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.plano_devolutivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos_terapeuticos(id) ON DELETE SET NULL,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  ai_modelo text,
  gerado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_devolutivas_paciente
  ON public.plano_devolutivas (paciente_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_devolutivas TO authenticated;
GRANT ALL ON public.plano_devolutivas TO service_role;
ALTER TABLE public.plano_devolutivas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Autenticados gerenciam devolutivas" ON public.plano_devolutivas;
CREATE POLICY "Autenticados gerenciam devolutivas"
  ON public.plano_devolutivas FOR ALL TO authenticated USING (true) WITH CHECK (true);
