-- Multi-tenant: UNIQUE(nome) global impedia duas clínicas de terem itens de
-- catálogo com o mesmo nome (ex.: ambas com "Psicologia"). Passa a valer
-- unicidade POR organização, mantendo os padrões globais (org_id NULL) únicos.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['especialidades','modalidades','status_frequencia','categorias_habilidades'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', t, t || '_nome_key');
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (nome) WHERE org_id IS NULL;', t || '_nome_global_uidx', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (org_id, nome) WHERE org_id IS NOT NULL;', t || '_org_nome_uidx', t);
  END LOOP;
END $$;
