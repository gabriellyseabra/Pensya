-- Seed de catálogos por organização: o sistema "nasce funcionando".
-- Modalidades, status de frequência, tipos de serviço, contas e plano de contas
-- já existem como padrões globais da plataforma (org_id NULL, visíveis a todas).
-- As lacunas reais são locais (tabela vazia — select da Agenda sem opções) e
-- especialidades (sem padrão). Semeia por org, só quando o catálogo está vazio.
CREATE OR REPLACE FUNCTION public.seed_catalogos_padrao(_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _org_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.locais WHERE org_id = _org_id) THEN
    INSERT INTO public.locais (org_id, nome, ativo) VALUES
      (_org_id, 'Sala 1', true),
      (_org_id, 'Online', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.especialidades WHERE org_id = _org_id) THEN
    INSERT INTO public.especialidades (org_id, nome) VALUES
      (_org_id, 'Psicopedagogia'),
      (_org_id, 'Psicologia'),
      (_org_id, 'Fonoaudiologia'),
      (_org_id, 'Terapia Ocupacional');
  END IF;
END $$;

-- Nova clínica já nasce com os catálogos mínimos.
CREATE OR REPLACE FUNCTION public.criar_organizacao(_nome text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  novo_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado';
  END IF;
  IF public.my_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Você já pertence a uma organização';
  END IF;
  IF _nome IS NULL OR length(trim(_nome)) = 0 THEN
    RAISE EXCEPTION 'Informe o nome da clínica';
  END IF;

  INSERT INTO public.organizacoes (nome) VALUES (trim(_nome)) RETURNING id INTO novo_org_id;
  INSERT INTO public.organizacao_membros (org_id, user_id, papel) VALUES (novo_org_id, auth.uid(), 'admin');
  PERFORM public.seed_catalogos_padrao(novo_org_id);
  RETURN novo_org_id;
END;
$$;

-- Backfill: organizações existentes com catálogos vazios ganham os padrões.
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM public.organizacoes LOOP
    PERFORM public.seed_catalogos_padrao(o.id);
  END LOOP;
END $$;
