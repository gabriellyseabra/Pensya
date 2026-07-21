
-- Helper: is current user a professional assigned to this patient?
CREATE OR REPLACE FUNCTION public.is_assigned_to_paciente(_paciente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.paciente_profissionais pp
    JOIN public.profissionais_consultorio pc ON pc.id = pp.profissional_id
    WHERE pp.paciente_id = _paciente_id
      AND pc.user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_paciente(uuid) FROM anon;

-- ===== cadastro_publico: drop anon RLS, expose via SECURITY DEFINER RPCs =====
DROP POLICY IF EXISTS "anon read by token" ON public.cadastro_publico;
DROP POLICY IF EXISTS "anon update by token" ON public.cadastro_publico;
DROP POLICY IF EXISTS "auth full" ON public.cadastro_publico;

CREATE POLICY "Admin manages cadastro_publico" ON public.cadastro_publico
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Auth read cadastro_publico" ON public.cadastro_publico
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert cadastro_publico" ON public.cadastro_publico
FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cadastro_publico_get(_token text)
RETURNS TABLE(id uuid, status text, dados_json jsonb, etapa_atual int, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, status, dados_json, etapa_atual, expires_at
  FROM public.cadastro_publico
  WHERE token = _token AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.cadastro_publico_save(
  _token text, _dados jsonb, _etapa int, _concluir boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.cadastro_publico
  SET dados_json = _dados,
      etapa_atual = LEAST(5, GREATEST(1, _etapa)),
      status = CASE WHEN _concluir THEN 'preenchido' ELSE 'em_preenchimento' END,
      preenchido_em = CASE WHEN _concluir THEN now() ELSE preenchido_em END,
      updated_at = now()
  WHERE token = _token
    AND expires_at > now()
    AND status IN ('pendente','em_preenchimento','preenchido');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro inválido ou expirado';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.cadastro_publico_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadastro_publico_save(text, jsonb, int, boolean) TO anon, authenticated;

-- ===== Storage policies for cadastro-publico bucket =====
DROP POLICY IF EXISTS "anon read cadastro-publico" ON storage.objects;
DROP POLICY IF EXISTS "anon upload cadastro-publico" ON storage.objects;

CREATE POLICY "anon upload cadastro-publico by valid token" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'cadastro-publico'
  AND EXISTS (
    SELECT 1 FROM public.cadastro_publico c
    WHERE c.id::text = split_part(name,'/',1)
      AND c.expires_at > now()
      AND c.status IN ('pendente','em_preenchimento','preenchido')
  )
);

-- ===== Pacientes =====
DROP POLICY IF EXISTS "Auth read" ON public.pacientes;
DROP POLICY IF EXISTS "Auth write" ON public.pacientes;

CREATE POLICY "Admin manages pacientes" ON public.pacientes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Assigned prof reads pacientes" ON public.pacientes FOR SELECT TO authenticated
USING (public.is_assigned_to_paciente(id));

CREATE POLICY "Assigned prof updates pacientes" ON public.pacientes FOR UPDATE TO authenticated
USING (public.is_assigned_to_paciente(id)) WITH CHECK (public.is_assigned_to_paciente(id));

CREATE POLICY "Auth inserts pacientes" ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- ===== paciente_profissionais =====
DROP POLICY IF EXISTS "Auth read" ON public.paciente_profissionais;
DROP POLICY IF EXISTS "Auth write" ON public.paciente_profissionais;

CREATE POLICY "Admin manages assignments" ON public.paciente_profissionais FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Prof reads own assignments" ON public.paciente_profissionais FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profissionais_consultorio pc WHERE pc.id = profissional_id AND pc.user_id = auth.uid()));

-- ===== responsaveis =====
DROP POLICY IF EXISTS "Auth read" ON public.responsaveis;
DROP POLICY IF EXISTS "Auth write" ON public.responsaveis;

CREATE POLICY "Patient-linked access responsaveis" ON public.responsaveis FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== paciente_pre_anamnese =====
DROP POLICY IF EXISTS "auth all" ON public.paciente_pre_anamnese;

CREATE POLICY "Patient-linked access pre_anamnese" ON public.paciente_pre_anamnese FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== contratos =====
DROP POLICY IF EXISTS "auth all" ON public.contratos;

CREATE POLICY "Patient-linked access contratos" ON public.contratos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== pagamentos =====
DROP POLICY IF EXISTS "auth all" ON public.pagamentos;

CREATE POLICY "Patient-linked access pagamentos" ON public.pagamentos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== prontuario_sessoes =====
DROP POLICY IF EXISTS "auth all sessoes" ON public.prontuario_sessoes;

CREATE POLICY "Patient-linked access sessoes" ON public.prontuario_sessoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== avaliacoes =====
DROP POLICY IF EXISTS "auth manage avaliacoes" ON public.avaliacoes;

CREATE POLICY "Patient-linked access avaliacoes" ON public.avaliacoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));

-- ===== planos_terapeuticos =====
DROP POLICY IF EXISTS "Autenticados gerenciam planos terapêuticos" ON public.planos_terapeuticos;

CREATE POLICY "Patient-linked access planos" ON public.planos_terapeuticos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_assigned_to_paciente(paciente_id));
