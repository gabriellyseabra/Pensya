-- ============================================================
-- PORTAL DA FAMÍLIA / PACIENTE
-- 1) Endurece a segurança existente (novos cadastros sem papel,
--    políticas permissivas passam a exigir papel de equipe)
-- 2) Cria tabelas de acesso, convites e diário da família
-- 3) Expõe dados curados do portal via funções SECURITY DEFINER
-- ============================================================

-- ===== 1. Papel de equipe =====
CREATE OR REPLACE FUNCTION public.is_equipe(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','profissional','secretaria')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_equipe(uuid) FROM anon;

-- Novos cadastros NÃO recebem mais papel automático de profissional.
-- O primeiro usuário vira admin; os demais ficam "sem papel" até um
-- admin atribuir na tela Equipe. Famílias entram via convite do portal.
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
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

-- Políticas "qualquer autenticado" passam a exigir papel de equipe.
-- Usuários do portal (família/paciente) são autenticados, mas só podem
-- enxergar dados através das funções portal_* abaixo.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  clauses text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'authenticated' = ANY (roles)
      AND tablename NOT IN ('profiles','user_roles')
      AND (lower(coalesce(qual,'')) = 'true' OR lower(coalesce(with_check,'')) = 'true')
  LOOP
    new_qual := CASE
      WHEN p.qual IS NULL THEN NULL
      WHEN lower(p.qual) = 'true' THEN 'public.is_equipe(auth.uid())'
      ELSE p.qual END;
    new_check := CASE
      WHEN p.with_check IS NULL THEN NULL
      WHEN lower(p.with_check) = 'true' THEN 'public.is_equipe(auth.uid())'
      ELSE p.with_check END;
    clauses := '';
    IF new_qual IS NOT NULL THEN clauses := clauses || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN clauses := clauses || format(' WITH CHECK (%s)', new_check); END IF;
    BEGIN
      EXECUTE format('ALTER POLICY %I ON public.%I%s', p.policyname, p.tablename, clauses);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível ajustar política % em %: %', p.policyname, p.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- Inserção de pacientes exigia apenas login; agora exige equipe.
DO $$
BEGIN
  ALTER POLICY "Auth inserts pacientes" ON public.pacientes
    WITH CHECK (public.is_equipe(auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Política "Auth inserts pacientes" não ajustada: %', SQLERRM;
END $$;

-- Perfis: equipe vê todos; usuário do portal vê apenas o próprio.
DO $$
BEGIN
  ALTER POLICY "Profiles are viewable by authenticated" ON public.profiles
    USING (public.is_equipe(auth.uid()) OR id = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Política de profiles não ajustada: %', SQLERRM;
END $$;

-- Storage: buckets internos passam a exigir papel de equipe.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  clauses text;
BEGIN
  FOR p IN
    SELECT policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND 'authenticated' = ANY (roles)
      AND coalesce(qual,'') NOT LIKE '%is_equipe%'
      AND coalesce(with_check,'') NOT LIKE '%is_equipe%'
  LOOP
    new_qual := CASE WHEN p.qual IS NULL THEN NULL
      ELSE format('public.is_equipe(auth.uid()) AND (%s)', p.qual) END;
    new_check := CASE WHEN p.with_check IS NULL THEN NULL
      ELSE format('public.is_equipe(auth.uid()) AND (%s)', p.with_check) END;
    clauses := '';
    IF new_qual IS NOT NULL THEN clauses := clauses || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN clauses := clauses || format(' WITH CHECK (%s)', new_check); END IF;
    BEGIN
      EXECUTE format('ALTER POLICY %I ON storage.objects%s', p.policyname, clauses);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Política de storage % não ajustada: %', p.policyname, SQLERRM;
    END;
  END LOOP;
END $$;

-- ===== 2. Tabelas do portal =====

CREATE TABLE public.portal_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'responsavel' CHECK (tipo IN ('responsavel','paciente')),
  parentesco text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, paciente_id)
);
CREATE INDEX idx_portal_acessos_user ON public.portal_acessos (user_id) WHERE ativo;
GRANT ALL ON public.portal_acessos TO authenticated;
ALTER TABLE public.portal_acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia acessos portal" ON public.portal_acessos
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));
CREATE POLICY "Portal user le proprio acesso" ON public.portal_acessos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tem_acesso_portal(_paciente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_acessos
    WHERE user_id = auth.uid() AND paciente_id = _paciente_id AND ativo
  )
$$;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_portal(uuid) FROM anon;

CREATE TABLE public.portal_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  tipo text NOT NULL DEFAULT 'responsavel' CHECK (tipo IN ('responsavel','paciente')),
  nome_convidado text,
  email text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  usado_em timestamptz,
  usado_por uuid,
  revogado boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.portal_convites TO authenticated;
ALTER TABLE public.portal_convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia convites portal" ON public.portal_convites
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

CREATE TABLE public.portal_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  autor_user_id uuid NOT NULL,
  autor_nome text NOT NULL DEFAULT '',
  autor_tipo text NOT NULL DEFAULT 'familia' CHECK (autor_tipo IN ('familia','equipe')),
  tipo text NOT NULL DEFAULT 'observacao' CHECK (tipo IN ('observacao','duvida','marco','resposta')),
  texto text NOT NULL,
  humor int CHECK (humor BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_registros_paciente ON public.portal_registros (paciente_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.portal_registros TO authenticated;
ALTER TABLE public.portal_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia registros portal" ON public.portal_registros
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));
CREATE POLICY "Portal user le registros" ON public.portal_registros
  FOR SELECT TO authenticated USING (public.tem_acesso_portal(paciente_id));
CREATE POLICY "Portal user cria registro" ON public.portal_registros
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_portal(paciente_id)
    AND autor_user_id = auth.uid()
    AND autor_tipo = 'familia'
  );

-- Sessões podem ser ocultadas do portal individualmente pela equipe.
ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS portal_ocultar boolean NOT NULL DEFAULT false;

-- ===== 3. Funções do portal (SECURITY DEFINER, dados curados) =====

-- Info pública do convite (para a página de aceite, antes do login)
CREATE OR REPLACE FUNCTION public.portal_convite_info(_token text)
RETURNS TABLE (
  valido boolean,
  paciente_nome text,
  tipo text,
  nome_convidado text,
  expirado boolean,
  usado boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (NOT c.revogado AND c.usado_em IS NULL AND c.expires_at > now()) AS valido,
    split_part(p.nome, ' ', 1) AS paciente_nome,
    c.tipo,
    c.nome_convidado,
    c.expires_at <= now() AS expirado,
    c.usado_em IS NOT NULL AS usado
  FROM public.portal_convites c
  JOIN public.pacientes p ON p.id = c.paciente_id
  WHERE c.token = _token AND NOT c.revogado
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.portal_convite_info(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_aceitar_convite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para aceitar o convite';
  END IF;
  SELECT * INTO c FROM public.portal_convites
  WHERE token = _token AND NOT revogado AND expires_at > now()
    AND (usado_em IS NULL OR usado_por = auth.uid())
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado';
  END IF;
  INSERT INTO public.portal_acessos (user_id, paciente_id, tipo)
  VALUES (auth.uid(), c.paciente_id, c.tipo)
  ON CONFLICT (user_id, paciente_id)
  DO UPDATE SET ativo = true, tipo = EXCLUDED.tipo;
  UPDATE public.portal_convites
  SET usado_em = COALESCE(usado_em, now()), usado_por = auth.uid()
  WHERE id = c.id;
  RETURN c.paciente_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal_aceitar_convite(text) FROM anon;

CREATE OR REPLACE FUNCTION public.portal_meus_pacientes()
RETURNS TABLE (paciente_id uuid, nome text, tipo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pa.paciente_id, p.nome, pa.tipo
  FROM public.portal_acessos pa
  JOIN public.pacientes p ON p.id = pa.paciente_id
  WHERE pa.user_id = auth.uid() AND pa.ativo
  ORDER BY p.nome
$$;
REVOKE EXECUTE ON FUNCTION public.portal_meus_pacientes() FROM anon;

CREATE OR REPLACE FUNCTION public.portal_agenda(_paciente_id uuid)
RETURNS TABLE (
  id uuid, inicio timestamptz, fim timestamptz,
  profissional text, modalidade text, local_nome text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.inicio, a.fim, pc.nome, m.nome, l.nome
  FROM public.atendimentos a
  LEFT JOIN public.profissionais_consultorio pc ON pc.id = a.profissional_id
  LEFT JOIN public.modalidades m ON m.id = a.modalidade_id
  LEFT JOIN public.locais l ON l.id = a.local_id
  WHERE a.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
    AND a.inicio >= now() - interval '2 hours'
  ORDER BY a.inicio
  LIMIT 20
$$;
REVOKE EXECUTE ON FUNCTION public.portal_agenda(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.portal_sessoes(_paciente_id uuid, _limite int DEFAULT 60)
RETURNS TABLE (
  id uuid, data_sessao date, tipo text, duracao_min int,
  habilidades_trabalhadas jsonb, orientacao_casa boolean,
  orientacao_texto text, orientacao_status text, orientacao_atualizado_em timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.data_sessao::date, s.tipo, s.duracao_min,
    s.habilidades_trabalhadas, s.orientacao_casa,
    s.orientacao_texto, s.orientacao_status, s.orientacao_atualizado_em
  FROM public.prontuario_sessoes s
  WHERE s.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
    AND NOT s.portal_ocultar
  ORDER BY s.data_sessao DESC, s.created_at DESC
  LIMIT GREATEST(1, LEAST(_limite, 200))
$$;
REVOKE EXECUTE ON FUNCTION public.portal_sessoes(uuid, int) FROM anon;

-- Família marca a orientação de casa como feita / não conseguimos
CREATE OR REPLACE FUNCTION public.portal_orientacao_feedback(_sessao_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('pendente','feita','nao_feita') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.prontuario_sessoes s
  SET orientacao_status = _status, orientacao_atualizado_em = now()
  WHERE s.id = _sessao_id
    AND s.orientacao_casa
    AND public.tem_acesso_portal(s.paciente_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada ou sem acesso';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal_orientacao_feedback(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.portal_plano(_paciente_id uuid)
RETURNS TABLE (
  id uuid, titulo text, status text, data_inicio date,
  frequencia_sessoes text, orientacoes_familia text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pt.id, pt.titulo, pt.status, pt.data_inicio::date,
    pt.frequencia_sessoes, pt.orientacoes_familia
  FROM public.planos_terapeuticos pt
  WHERE pt.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
    AND pt.status IN ('aprovado','em_andamento')
  ORDER BY pt.created_at DESC
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.portal_plano(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.portal_metas(_paciente_id uuid)
RETURNS TABLE (
  id uuid, titulo text, dominio text, status text,
  nivel_gas_atingido int, prazo_semanas int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pm.id, pm.titulo_smart, pm.dominio, pm.status,
    pm.nivel_gas_atingido, pm.prazo_semanas
  FROM public.plano_metas pm
  JOIN public.planos_terapeuticos pt ON pt.id = pm.plano_id
  WHERE pt.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
    AND pt.status IN ('aprovado','em_andamento')
  ORDER BY pm.ordem
$$;
REVOKE EXECUTE ON FUNCTION public.portal_metas(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.portal_mensalidades(_paciente_id uuid)
RETURNS TABLE (
  id uuid, competencia text, valor numeric, vencimento date,
  status text, pago_em timestamptz, forma_pagamento text, checkout_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pg.id, pg.competencia::text, pg.valor, pg.vencimento::date,
    pg.status, pg.pago_em, pg.forma_pagamento, pg.infinitepay_checkout_url
  FROM public.pagamentos pg
  WHERE pg.paciente_id = _paciente_id
    AND public.tem_acesso_portal(_paciente_id)
  ORDER BY pg.vencimento DESC
  LIMIT 24
$$;
REVOKE EXECUTE ON FUNCTION public.portal_mensalidades(uuid) FROM anon;
