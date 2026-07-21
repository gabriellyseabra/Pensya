-- Captura de detalhes de origem para gestão de leads cadastrados manualmente.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origem_detalhe text,
  ADD COLUMN IF NOT EXISTS indicador_nome text,
  ADD COLUMN IF NOT EXISTS parceiro_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

CREATE INDEX IF NOT EXISTS idx_leads_origem_detalhe ON public.leads (origem_detalhe);
CREATE INDEX IF NOT EXISTS idx_leads_parceiro ON public.leads (parceiro_id);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON public.leads (utm_campaign);
