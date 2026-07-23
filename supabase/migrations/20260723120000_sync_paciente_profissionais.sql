-- =========================================================
-- Espelha paciente_profissionais a partir de pacientes.profissional_responsavel_id
--
-- O vínculo real do paciente com o profissional é pacientes.profissional_responsavel_id,
-- mas a tabela paciente_profissionais (usada pela Folha "por paciente" e pelo
-- "meu financeiro") nunca era populada — por isso a folha dizia "nenhum paciente
-- selecionado" mesmo com pacientes vinculados. Backfill + trigger de sincronização.
-- (Multi-tenant: leva o org_id do paciente para o vínculo.)
-- =========================================================

-- 1) Backfill dos vínculos já existentes.
INSERT INTO public.paciente_profissionais (paciente_id, profissional_id, org_id)
SELECT id, profissional_responsavel_id, org_id
FROM public.pacientes
WHERE profissional_responsavel_id IS NOT NULL
ON CONFLICT (paciente_id, profissional_id) DO NOTHING;

-- 2) Mantém sincronizado quando o profissional responsável muda.
CREATE OR REPLACE FUNCTION public.sync_paciente_profissional_responsavel()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.paciente_profissionais WHERE paciente_id = NEW.id;
  IF NEW.profissional_responsavel_id IS NOT NULL THEN
    INSERT INTO public.paciente_profissionais (paciente_id, profissional_id, org_id)
    VALUES (NEW.id, NEW.profissional_responsavel_id, NEW.org_id)
    ON CONFLICT (paciente_id, profissional_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_paciente_prof ON public.pacientes;
CREATE TRIGGER trg_sync_paciente_prof
  AFTER INSERT OR UPDATE OF profissional_responsavel_id ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.sync_paciente_profissional_responsavel();
