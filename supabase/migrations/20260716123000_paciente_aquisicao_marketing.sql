-- Persiste a origem comercial no paciente para relatórios históricos de aquisição.
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS lead_origem_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canal_origem_id uuid REFERENCES public.canais_marketing(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campanha_origem_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_criacao text NOT NULL DEFAULT 'manual' CHECK (origem_criacao IN ('manual', 'lead_marketing', 'cadastro_publico', 'importacao')),
  ADD COLUMN IF NOT EXISTS origem_detalhe text,
  ADD COLUMN IF NOT EXISTS data_conversao_marketing timestamptz;

CREATE INDEX IF NOT EXISTS idx_pacientes_lead_origem ON public.pacientes (lead_origem_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_canal_origem ON public.pacientes (canal_origem_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_campanha_origem ON public.pacientes (campanha_origem_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_data_conversao_marketing ON public.pacientes (data_conversao_marketing);

COMMENT ON COLUMN public.pacientes.lead_origem_id IS 'Lead que originou o paciente quando a criação veio do CRM.';
COMMENT ON COLUMN public.pacientes.canal_origem_id IS 'Canal comercial persistido no momento da conversão do lead.';
COMMENT ON COLUMN public.pacientes.campanha_origem_id IS 'Campanha comercial persistida no momento da conversão do lead.';
COMMENT ON COLUMN public.pacientes.origem_criacao IS 'Fonte de criação do paciente: manual, lead_marketing, cadastro_publico ou importacao.';
COMMENT ON COLUMN public.pacientes.origem_detalhe IS 'Detalhe livre da origem (quem indicou / qual escola / observação).';
COMMENT ON COLUMN public.pacientes.data_conversao_marketing IS 'Data/hora em que o lead foi convertido em paciente.';

-- Backfill: recupera a origem dos pacientes que já vieram de leads convertidos.
UPDATE public.pacientes p
SET
  lead_origem_id = COALESCE(p.lead_origem_id, l.id),
  canal_origem_id = COALESCE(p.canal_origem_id, l.canal_id),
  campanha_origem_id = COALESCE(p.campanha_origem_id, l.campanha_id),
  origem_criacao = CASE WHEN p.origem_criacao = 'manual' THEN 'lead_marketing' ELSE p.origem_criacao END,
  data_conversao_marketing = COALESCE(p.data_conversao_marketing, l.convertido_em)
FROM public.leads l
WHERE l.paciente_id_criado = p.id
  AND (p.lead_origem_id IS NULL OR p.canal_origem_id IS NULL);
