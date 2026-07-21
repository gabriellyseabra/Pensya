-- ============================================================
-- 1) Portal do sublocador: link por token, reserva e troca de horários
--    e fechamento automático do mês
-- 2) Financeiro estratégico: contas fixas recorrentes, metas do
--    negócio e séries para projeção/novos pacientes
-- ============================================================

-- ===== 1. Portal do sublocador =====
ALTER TABLE public.sublocadores
  ADD COLUMN IF NOT EXISTS portal_token text UNIQUE
    DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
UPDATE public.sublocadores
  SET portal_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  WHERE portal_token IS NULL;

CREATE OR REPLACE FUNCTION public._sublocador_por_token(_token text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.sublocadores WHERE portal_token = _token AND ativo LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public._sublocador_por_token(text) FROM anon, authenticated;

-- Valor de um uso conforme o modelo do contrato (espelha o cálculo do app)
CREATE OR REPLACE FUNCTION public._sublocacao_valor(_contrato public.sublocacao_contratos, _dur_min int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _contrato.modelo
    WHEN 'fixo_sessao' THEN COALESCE(_contrato.valor_base, 0)
    WHEN 'fixo_hora' THEN COALESCE(_contrato.valor_base, 0) * (_dur_min / 60.0)
    WHEN 'mensal_extras' THEN COALESCE(_contrato.valor_extra, 0)
    ELSE 0
  END
$$;

-- Agenda completa do sublocador: salas, janelas, ocupações (com "minha") e contratos
CREATE OR REPLACE FUNCTION public.sublocador_portal(_token text, _de date, _ate date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := public._sublocador_por_token(_token);
  resultado jsonb;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'Link inválido ou inativo'; END IF;
  IF _ate < _de OR _ate - _de > 31 THEN RAISE EXCEPTION 'Período inválido'; END IF;
  SELECT jsonb_build_object(
    'sublocador', (SELECT jsonb_build_object('id', s.id, 'nome', s.nome) FROM public.sublocadores s WHERE s.id = sid),
    'contratos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'sala_id', c.sala_id, 'modelo', c.modelo,
        'valor_base', c.valor_base, 'percentual', c.percentual, 'valor_extra', c.valor_extra))
      FROM public.sublocacao_contratos c WHERE c.sublocador_id = sid AND c.ativo
    ), '[]'::jsonb),
    'salas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'cor', s.cor) ORDER BY s.nome)
      FROM public.salas s WHERE s.ativo
    ), '[]'::jsonb),
    'janelas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('sala_id', d.sala_id, 'inicio', d.inicio, 'fim', d.fim, 'tipo', d.tipo))
      FROM public.sublocacao_disponibilidade d
      WHERE d.inicio < (_ate + 1)::timestamptz AND d.fim > _de::timestamptz
    ), '[]'::jsonb),
    'ocupacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id, 'sala_id', u.sala_id, 'inicio', u.inicio, 'fim', u.fim,
        'minha', u.sublocador_id = sid,
        'valor', CASE WHEN u.sublocador_id = sid THEN u.valor_calculado END,
        'faturado', CASE WHEN u.sublocador_id = sid THEN u.lancamento_id IS NOT NULL END))
      FROM public.sublocacao_usos u
      WHERE u.data BETWEEN _de AND _ate
    ), '[]'::jsonb)
  ) INTO resultado;
  RETURN resultado;
END $$;
GRANT EXECUTE ON FUNCTION public.sublocador_portal(text, date, date) TO anon, authenticated;

-- Fechamento do mês: sessões previstas/realizadas e valor total
CREATE OR REPLACE FUNCTION public.sublocador_fechamento(_token text, _ano int, _mes int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := public._sublocador_por_token(_token);
  ini date := make_date(_ano, _mes, 1);
  fim date := (make_date(_ano, _mes, 1) + interval '1 month')::date;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'Link inválido ou inativo'; END IF;
  RETURN jsonb_build_object(
    'competencia', to_char(ini, 'YYYY-MM'),
    'total', COALESCE((SELECT sum(u.valor_calculado) FROM public.sublocacao_usos u
      WHERE u.sublocador_id = sid AND u.data >= ini AND u.data < fim), 0),
    'sessoes', (SELECT count(*) FROM public.sublocacao_usos u
      WHERE u.sublocador_id = sid AND u.data >= ini AND u.data < fim),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('data', u.data, 'inicio', u.inicio, 'fim', u.fim,
        'sala', s.nome, 'valor', u.valor_calculado) ORDER BY u.data, u.inicio)
      FROM public.sublocacao_usos u JOIN public.salas s ON s.id = u.sala_id
      WHERE u.sublocador_id = sid AND u.data >= ini AND u.data < fim
    ), '[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.sublocador_fechamento(text, int, int) TO anon, authenticated;

-- Valida sala livre e dentro de janela disponível
CREATE OR REPLACE FUNCTION public._sublocacao_valida_slot(_sala uuid, _inicio timestamptz, _fim timestamptz, _ignorar_uso uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _fim <= _inicio OR _fim - _inicio > interval '8 hours' THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;
  IF _inicio < now() THEN
    RAISE EXCEPTION 'Só é possível reservar horários futuros';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sublocacao_disponibilidade d
    WHERE d.sala_id = _sala AND d.tipo = 'disponivel'
      AND d.inicio <= _inicio AND d.fim >= _fim
  ) THEN
    RAISE EXCEPTION 'Fora da janela de disponibilidade da sala';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sublocacao_disponibilidade d
    WHERE d.sala_id = _sala AND d.tipo = 'bloqueada'
      AND d.inicio < _fim AND d.fim > _inicio
  ) THEN
    RAISE EXCEPTION 'Horário bloqueado pela clínica';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sublocacao_usos u
    WHERE u.sala_id = _sala AND u.inicio < _fim AND u.fim > _inicio
      AND (u.id IS DISTINCT FROM _ignorar_uso)
  ) THEN
    RAISE EXCEPTION 'Horário já reservado';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._sublocacao_valida_slot(uuid, timestamptz, timestamptz, uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sublocador_reservar(_token text, _contrato_id uuid, _inicio timestamptz, _fim timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := public._sublocador_por_token(_token);
  c public.sublocacao_contratos;
  dur int;
  novo uuid;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'Link inválido ou inativo'; END IF;
  SELECT * INTO c FROM public.sublocacao_contratos
    WHERE id = _contrato_id AND sublocador_id = sid AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  PERFORM public._sublocacao_valida_slot(c.sala_id, _inicio, _fim, NULL);
  dur := round(extract(epoch FROM _fim - _inicio) / 60);
  INSERT INTO public.sublocacao_usos
    (contrato_id, sala_id, sublocador_id, data, inicio, fim, duracao_min, valor_calculado, observacoes)
  VALUES (c.id, c.sala_id, sid, (_inicio AT TIME ZONE 'America/Sao_Paulo')::date, _inicio, _fim, dur,
    public._sublocacao_valor(c, dur), 'Reservado pelo portal do sublocador')
  RETURNING id INTO novo;
  RETURN novo;
END $$;
GRANT EXECUTE ON FUNCTION public.sublocador_reservar(text, uuid, timestamptz, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sublocador_mover(_token text, _uso_id uuid, _inicio timestamptz, _fim timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := public._sublocador_por_token(_token);
  u public.sublocacao_usos;
  c public.sublocacao_contratos;
  dur int;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'Link inválido ou inativo'; END IF;
  SELECT * INTO u FROM public.sublocacao_usos WHERE id = _uso_id AND sublocador_id = sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF u.lancamento_id IS NOT NULL THEN RAISE EXCEPTION 'Este horário já foi faturado — fale com a clínica'; END IF;
  IF u.inicio < now() THEN RAISE EXCEPTION 'Não é possível mover um horário passado'; END IF;
  SELECT * INTO c FROM public.sublocacao_contratos WHERE id = u.contrato_id;
  PERFORM public._sublocacao_valida_slot(u.sala_id, _inicio, _fim, u.id);
  dur := round(extract(epoch FROM _fim - _inicio) / 60);
  UPDATE public.sublocacao_usos SET
    data = (_inicio AT TIME ZONE 'America/Sao_Paulo')::date,
    inicio = _inicio, fim = _fim, duracao_min = dur,
    valor_calculado = public._sublocacao_valor(c, dur), updated_at = now()
  WHERE id = u.id;
END $$;
GRANT EXECUTE ON FUNCTION public.sublocador_mover(text, uuid, timestamptz, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sublocador_cancelar(_token text, _uso_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := public._sublocador_por_token(_token);
  u public.sublocacao_usos;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'Link inválido ou inativo'; END IF;
  SELECT * INTO u FROM public.sublocacao_usos WHERE id = _uso_id AND sublocador_id = sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF u.lancamento_id IS NOT NULL THEN RAISE EXCEPTION 'Este horário já foi faturado — fale com a clínica'; END IF;
  IF u.inicio < now() THEN RAISE EXCEPTION 'Não é possível cancelar um horário passado'; END IF;
  DELETE FROM public.sublocacao_usos WHERE id = u.id;
END $$;
GRANT EXECUTE ON FUNCTION public.sublocador_cancelar(text, uuid) TO anon, authenticated;

-- ===== 2. Financeiro estratégico =====

-- Contas fixas: geram contas a pagar/receber todo mês
CREATE TABLE public.contas_fixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'despesa' CHECK (tipo IN ('despesa','receita')),
  valor numeric NOT NULL,
  dia_vencimento int NOT NULL DEFAULT 5 CHECK (dia_vencimento BETWEEN 1 AND 28),
  plano_conta_id uuid REFERENCES public.plano_contas(id),
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contas_fixas TO authenticated;
ALTER TABLE public.contas_fixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia contas fixas" ON public.contas_fixas
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));
CREATE TRIGGER trg_contas_fixas_updated BEFORE UPDATE ON public.contas_fixas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gera os lançamentos do mês a partir das contas fixas (idempotente)
CREATE OR REPLACE FUNCTION public.gerar_contas_fixas(_ano int, _mes int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cf record;
  gerados int := 0;
  comp date := make_date(_ano, _mes, 1);
BEGIN
  IF NOT public.is_equipe(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  FOR cf IN SELECT * FROM public.contas_fixas WHERE ativo LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.lancamentos_financeiros l
      WHERE l.recorrencia_grupo = 'conta_fixa:' || cf.id
        AND date_trunc('month', l.competencia::date) = comp
    ) THEN
      INSERT INTO public.lancamentos_financeiros
        (tipo, status, descricao, valor, competencia, vencimento,
         plano_conta_id, fornecedor_id, centro_custo_id, recorrencia_grupo, created_by)
      VALUES (cf.tipo, 'previsto', cf.descricao, cf.valor, comp,
        make_date(_ano, _mes, cf.dia_vencimento),
        cf.plano_conta_id, cf.fornecedor_id, cf.centro_custo_id,
        'conta_fixa:' || cf.id, auth.uid());
      gerados := gerados + 1;
    END IF;
  END LOOP;
  RETURN gerados;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_contas_fixas(int, int) FROM anon;

-- Metas do negócio por ano (crescimento %, faturamento, novos pacientes…)
CREATE TABLE public.negocio_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  indicador text NOT NULL,
  alvo numeric NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, indicador)
);
GRANT ALL ON public.negocio_metas TO authenticated;
ALTER TABLE public.negocio_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia metas do negocio" ON public.negocio_metas
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

-- Faturamento (receitas) por mês para os anos pedidos
CREATE OR REPLACE FUNCTION public.financeiro_faturamento_mensal(_anos int[])
RETURNS TABLE (ano int, mes int, realizado numeric, previsto numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(year FROM l.competencia::date)::int AS ano,
    extract(month FROM l.competencia::date)::int AS mes,
    COALESCE(sum(l.valor) FILTER (WHERE l.status = 'pago'), 0) AS realizado,
    COALESCE(sum(l.valor) FILTER (WHERE l.status <> 'cancelado'), 0) AS previsto
  FROM public.lancamentos_financeiros l
  WHERE l.tipo = 'receita'
    AND public.is_equipe(auth.uid())
    AND extract(year FROM l.competencia::date)::int = ANY (_anos)
  GROUP BY 1, 2
  ORDER BY 1, 2
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_faturamento_mensal(int[]) FROM anon;

-- Novos pacientes e altas por mês
CREATE OR REPLACE FUNCTION public.pacientes_novos_por_mes(_desde date)
RETURNS TABLE (mes text, novos bigint, altas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH meses AS (
    SELECT generate_series(date_trunc('month', _desde), date_trunc('month', now()), '1 month')::date AS m
  )
  SELECT to_char(m.m, 'YYYY-MM') AS mes,
    (SELECT count(*) FROM public.pacientes p
      WHERE date_trunc('month', COALESCE(p.data_inicio, p.created_at::date)::timestamptz)::date = m.m) AS novos,
    (SELECT count(*) FROM public.pacientes p
      WHERE p.data_alta IS NOT NULL
        AND date_trunc('month', p.data_alta::timestamptz)::date = m.m) AS altas
  FROM meses m
  WHERE public.is_equipe(auth.uid())
  ORDER BY 1
$$;
REVOKE EXECUTE ON FUNCTION public.pacientes_novos_por_mes(date) FROM anon;
