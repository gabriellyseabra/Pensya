-- O convite de equipe já enviava a especialidade escolhida, mas a coluna não
-- existia em convites_equipe. Adiciona a coluna e leva a especialidade para o
-- profissional criado ao aceitar o convite.
ALTER TABLE public.convites_equipe
  ADD COLUMN IF NOT EXISTS especialidade_id uuid REFERENCES public.especialidades(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.equipe_aceitar_convite(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  prof_id uuid;
  meu_email text;
  meu_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para aceitar o convite';
  END IF;

  SELECT * INTO c FROM public.convites_equipe
  WHERE token = _token AND NOT revogado AND expira_em > now()
    AND (usado_em IS NULL OR usado_por = auth.uid())
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado';
  END IF;

  IF public.my_org_id() IS NOT NULL AND public.my_org_id() <> c.org_id THEN
    RAISE EXCEPTION 'Esta conta já pertence a outra clínica';
  END IF;

  INSERT INTO public.organizacao_membros (org_id, user_id, papel)
  VALUES (c.org_id, auth.uid(), c.role)
  ON CONFLICT (user_id) DO UPDATE SET org_id = c.org_id, papel = c.role, ativo = true;

  IF c.role = 'profissional' THEN
    SELECT email INTO meu_email FROM auth.users WHERE id = auth.uid();
    SELECT nome INTO meu_nome FROM public.profiles WHERE id = auth.uid();

    SELECT id INTO prof_id FROM public.profissionais_consultorio
    WHERE user_id = auth.uid() LIMIT 1;

    IF prof_id IS NULL AND c.email IS NOT NULL THEN
      SELECT id INTO prof_id FROM public.profissionais_consultorio
      WHERE user_id IS NULL AND org_id = c.org_id AND lower(email) = lower(c.email) LIMIT 1;
    END IF;

    IF prof_id IS NOT NULL THEN
      UPDATE public.profissionais_consultorio
        SET user_id = auth.uid(),
            ativo = true,
            org_id = c.org_id,
            nome = COALESCE(NULLIF(nome, ''), c.nome, meu_nome),
            email = COALESCE(email, c.email, meu_email),
            registro_profissional = COALESCE(registro_profissional, c.registro_profissional),
            especialidade_id = COALESCE(especialidade_id, c.especialidade_id)
      WHERE id = prof_id;
    ELSE
      INSERT INTO public.profissionais_consultorio (org_id, nome, email, user_id, registro_profissional, especialidade_id, ativo)
      VALUES (c.org_id, COALESCE(c.nome, meu_nome, 'Profissional'), COALESCE(c.email, meu_email), auth.uid(), c.registro_profissional, c.especialidade_id, true);
    END IF;
  END IF;

  UPDATE public.convites_equipe
    SET usado_em = COALESCE(usado_em, now()), usado_por = auth.uid()
  WHERE id = c.id;
END $function$;
