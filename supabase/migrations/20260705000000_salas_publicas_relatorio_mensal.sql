-- ============================================================
-- 1) Agenda pública de salas para sublocadores (/salas)
--    Mostra janelas de disponibilidade e ocupações SEM expor nomes.
-- 2) Relatório mensal de evolução para o Portal da Família
-- ============================================================

-- ===== 1. Agenda pública de salas =====
CREATE OR REPLACE FUNCTION public.salas_agenda_publica(_de date, _ate date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resultado jsonb;
BEGIN
  IF _ate < _de OR _ate - _de > 31 THEN
    RAISE EXCEPTION 'Período inválido (máximo 31 dias)';
  END IF;
  SELECT jsonb_build_object(
    'salas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'cor', s.cor, 'capacidade', s.capacidade) ORDER BY s.nome)
      FROM public.salas s WHERE s.ativo
    ), '[]'::jsonb),
    'janelas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('sala_id', d.sala_id, 'inicio', d.inicio, 'fim', d.fim, 'tipo', d.tipo))
      FROM public.sublocacao_disponibilidade d
      WHERE d.inicio < (_ate + 1)::timestamptz AND d.fim > _de::timestamptz
    ), '[]'::jsonb),
    'ocupacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('sala_id', u.sala_id, 'inicio', u.inicio, 'fim', u.fim))
      FROM public.sublocacao_usos u
      WHERE u.data BETWEEN _de AND _ate
    ), '[]'::jsonb)
  ) INTO resultado;
  RETURN resultado;
END $$;
GRANT EXECUTE ON FUNCTION public.salas_agenda_publica(date, date) TO anon, authenticated;

-- ===== 2. Relatório mensal do portal =====

-- Meses que possuem dados (sessões ou frequência) para o paciente
CREATE OR REPLACE FUNCTION public.portal_relatorios_disponiveis(_paciente_id uuid)
RETURNS TABLE (competencia text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_char(m, 'YYYY-MM') AS competencia
  FROM (
    SELECT DISTINCT date_trunc('month', s.data_sessao)::date AS m
    FROM public.prontuario_sessoes s
    WHERE s.paciente_id = _paciente_id AND NOT s.portal_ocultar
    UNION
    SELECT DISTINCT date_trunc('month', f.data_referencia)::date
    FROM public.frequencia f
    WHERE f.paciente_id = _paciente_id
  ) t
  WHERE (public.tem_acesso_portal(_paciente_id) OR public.is_equipe(auth.uid()))
  ORDER BY 1 DESC
  LIMIT 36
$$;
REVOKE EXECUTE ON FUNCTION public.portal_relatorios_disponiveis(uuid) FROM anon;

-- Relatório agregado do mês (dados curados, sem texto clínico interno)
CREATE OR REPLACE FUNCTION public.portal_relatorio_mensal(_paciente_id uuid, _ano int, _mes int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ini date := make_date(_ano, _mes, 1);
  fim date := (make_date(_ano, _mes, 1) + interval '1 month')::date;
  resultado jsonb;
BEGIN
  IF NOT (public.tem_acesso_portal(_paciente_id) OR public.is_equipe(auth.uid())) THEN
    RAISE EXCEPTION 'Sem acesso';
  END IF;

  SELECT jsonb_build_object(
    'competencia', to_char(ini, 'YYYY-MM'),
    'sessoes', (
      SELECT count(*) FROM public.prontuario_sessoes s
      WHERE s.paciente_id = _paciente_id AND NOT s.portal_ocultar
        AND s.data_sessao >= ini AND s.data_sessao < fim
    ),
    'engajamento_medio', (
      SELECT round(avg(s.engajamento)::numeric, 1) FROM public.prontuario_sessoes s
      WHERE s.paciente_id = _paciente_id AND NOT s.portal_ocultar
        AND s.data_sessao >= ini AND s.data_sessao < fim AND s.engajamento IS NOT NULL
    ),
    'frequencia', (
      SELECT COALESCE(jsonb_object_agg(t.tipo, t.qtd), '{}'::jsonb)
      FROM (
        SELECT f.tipo, count(*) AS qtd FROM public.frequencia f
        WHERE f.paciente_id = _paciente_id AND f.data_referencia >= ini AND f.data_referencia < fim
        GROUP BY f.tipo
      ) t
    ),
    'habilidades', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', h.nome, 'vezes', h.qtd) ORDER BY h.qtd DESC)
      FROM (
        SELECT COALESCE(NULLIF(elem->>'habilidade',''), NULLIF(elem->>'nome',''), 'Outros') AS nome, count(*) AS qtd
        FROM public.prontuario_sessoes s,
             jsonb_array_elements(s.habilidades_trabalhadas) elem
        WHERE s.paciente_id = _paciente_id AND NOT s.portal_ocultar
          AND s.data_sessao >= ini AND s.data_sessao < fim
        GROUP BY 1 ORDER BY qtd DESC LIMIT 12
      ) h
    ), '[]'::jsonb),
    'orientacoes', (
      SELECT jsonb_build_object(
        'total', count(*) FILTER (WHERE s.orientacao_casa),
        'feitas', count(*) FILTER (WHERE s.orientacao_casa AND s.orientacao_status = 'feita'),
        'nao_feitas', count(*) FILTER (WHERE s.orientacao_casa AND s.orientacao_status = 'nao_feita'),
        'pendentes', count(*) FILTER (WHERE s.orientacao_casa AND s.orientacao_status = 'pendente')
      )
      FROM public.prontuario_sessoes s
      WHERE s.paciente_id = _paciente_id AND NOT s.portal_ocultar
        AND s.data_sessao >= ini AND s.data_sessao < fim
    ),
    'metas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'titulo', COALESCE(pm.titulo_smart, 'Meta'), 'dominio', pm.dominio,
        'gas_ultimo', agg.gas_ultimo, 'gas_medio', agg.gas_medio,
        'desempenho_medio', agg.desempenho_medio, 'registros', agg.registros
      ) ORDER BY pm.titulo_smart)
      FROM (
        SELECT sm.meta_id,
          (array_agg(sm.nivel_gas_observado ORDER BY ps.data_sessao DESC)
             FILTER (WHERE sm.nivel_gas_observado IS NOT NULL))[1] AS gas_ultimo,
          round(avg(sm.nivel_gas_observado)::numeric, 1) AS gas_medio,
          round(avg(sm.desempenho)::numeric, 1) AS desempenho_medio,
          count(*) AS registros
        FROM public.sessao_metas sm
        JOIN public.prontuario_sessoes ps ON ps.id = sm.sessao_id
        WHERE ps.paciente_id = _paciente_id AND NOT ps.portal_ocultar
          AND ps.data_sessao >= ini AND ps.data_sessao < fim
        GROUP BY sm.meta_id
      ) agg
      LEFT JOIN LATERAL (
        SELECT pm2.titulo_smart, pm2.dominio
        FROM public.plano_metas pm2
        WHERE pm2.meta_terapeutica_id = agg.meta_id
        ORDER BY pm2.created_at DESC LIMIT 1
      ) pm ON true
    ), '[]'::jsonb),
    'registros_familia', (
      SELECT count(*) FROM public.portal_registros r
      WHERE r.paciente_id = _paciente_id AND r.autor_tipo = 'familia'
        AND r.created_at >= ini AND r.created_at < fim
    )
  ) INTO resultado;

  RETURN resultado;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal_relatorio_mensal(uuid, int, int) FROM anon;
