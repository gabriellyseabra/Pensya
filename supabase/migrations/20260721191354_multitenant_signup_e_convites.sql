-- =========================================================
-- Fase 1 — Cadastro e convites no modelo multi-clínica
-- =========================================================

-- Primeira pessoa a se cadastrar no Pensya vira administradora da
-- PLATAFORMA (pensya_admin). Todo mundo depois entra sem organização:
-- ganha uma ao aceitar convite de equipe, ao criar a própria clínica
-- (RPC criar_organizacao) ou fica sem organização (portal da família,
-- que usa portal_acessos e não passa por aqui).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pensya_admin');
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-cadastro de clínica nova (onboarding self-service).
CREATE OR REPLACE FUNCTION public.criar_organizacao(_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN novo_org_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.criar_organizacao(text) TO authenticated;

-- Convites de equipe agora amarram a uma organização específica
-- (org_id já ganhou DEFAULT public.my_org_id() na migration anterior,
-- então convites criados por um admin de clínica já saem com o org_id certo).
ALTER TABLE public.convites_equipe ALTER COLUMN org_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.equipe_aceitar_convite(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            registro_profissional = COALESCE(registro_profissional, c.registro_profissional)
      WHERE id = prof_id;
    ELSE
      INSERT INTO public.profissionais_consultorio (org_id, nome, email, user_id, registro_profissional, ativo)
      VALUES (c.org_id, COALESCE(c.nome, meu_nome, 'Profissional'), COALESCE(c.email, meu_email), auth.uid(), c.registro_profissional, true);
    END IF;
  END IF;

  UPDATE public.convites_equipe
    SET usado_em = COALESCE(usado_em, now()), usado_por = auth.uid()
  WHERE id = c.id;
END $$;
