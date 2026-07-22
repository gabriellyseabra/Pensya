-- Resumo financeiro PESSOAL do profissional (terapeuta): quanto ele recebe no
-- mês pelos próprios atendimentos, conforme a forma de repasse configurada.
-- SECURITY DEFINER porque colaborador_config é restrita ao admin — aqui o
-- profissional só enxerga o resumo dele mesmo (auth.uid()), sem acessar dados
-- financeiros da clínica.
CREATE OR REPLACE FUNCTION public.meu_financeiro_mensal(_competencia date)
RETURNS TABLE(
  forma text,
  qtd_sessoes int,
  salario_base numeric,
  comissoes numeric,
  beneficios numeric,
  descontos numeric,
  total numeric,
  folha_status text,
  folha_paga_em date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof uuid;
  cfg public.colaborador_config%ROWTYPE;
  has_cfg boolean := false;
  ini timestamptz;
  fim timestamptz;
  comp date;
  v_sessoes int := 0;
  v_receita numeric := 0;
  v_comissoes numeric := 0;
  v_salario numeric := 0;
  v_forma text := 'nao_configurado';
BEGIN
  SELECT id INTO v_prof FROM public.profissionais_consultorio
    WHERE user_id = auth.uid() LIMIT 1;
  IF v_prof IS NULL THEN
    RETURN; -- não é profissional vinculado
  END IF;

  SELECT * INTO cfg FROM public.colaborador_config WHERE profissional_id = v_prof LIMIT 1;
  has_cfg := FOUND;

  comp := date_trunc('month', _competencia)::date;
  ini := comp::timestamptz;
  fim := (comp + interval '1 month')::timestamptz - interval '1 second';

  -- Sessões contadas no mês (respeita status que não conta presença).
  SELECT count(*) INTO v_sessoes
  FROM public.atendimentos a
  LEFT JOIN public.status_frequencia sf ON sf.id = a.status_frequencia_id
  WHERE a.profissional_id = v_prof
    AND a.inicio >= ini AND a.inicio <= fim
    AND coalesce(sf.conta_presenca, true) <> false;

  IF has_cfg THEN
    v_forma := coalesce(cfg.forma_repasse, 'auto');
    v_salario := coalesce(cfg.salario_base, 0);

    IF v_forma = 'fixo_mensal' THEN
      v_comissoes := 0;
    ELSIF v_forma = 'por_sessao' THEN
      v_salario := 0;
      v_comissoes := v_sessoes * coalesce(cfg.valor_por_sessao, 0);
    ELSIF v_forma = 'percentual' THEN
      v_salario := 0;
      SELECT coalesce(sum(p.valor), 0) INTO v_receita
      FROM public.pagamentos p
      WHERE p.paciente_id IN (
          SELECT paciente_id FROM public.paciente_profissionais WHERE profissional_id = v_prof)
        AND p.status = 'pago'
        AND p.pago_em >= comp AND p.pago_em <= (comp + interval '1 month' - interval '1 day')::date;
      v_comissoes := v_receita * (coalesce(cfg.comissao_percentual, 0) / 100);
    ELSIF v_forma = 'por_paciente' THEN
      v_salario := 0;
      SELECT coalesce(sum(
        CASE WHEN cpv.modo = 'fixo_mensal'
             THEN (CASE WHEN coalesce(cnt.n, 0) > 0 THEN cpv.valor ELSE 0 END)
             ELSE cpv.valor * coalesce(cnt.n, 0) END), 0)
      INTO v_comissoes
      FROM public.colaborador_paciente_valor cpv
      LEFT JOIN (
        SELECT a.paciente_id, count(*) AS n
        FROM public.atendimentos a
        LEFT JOIN public.status_frequencia sf ON sf.id = a.status_frequencia_id
        WHERE a.profissional_id = v_prof AND a.inicio >= ini AND a.inicio <= fim
          AND coalesce(sf.conta_presenca, true) <> false
        GROUP BY a.paciente_id
      ) cnt ON cnt.paciente_id = cpv.paciente_id
      WHERE cpv.profissional_id = v_prof;
    ELSE -- auto (legado)
      IF coalesce(cfg.valor_por_sessao, 0) > 0 THEN
        v_comissoes := v_sessoes * cfg.valor_por_sessao;
      ELSIF coalesce(cfg.comissao_percentual, 0) > 0 THEN
        SELECT coalesce(sum(p.valor), 0) INTO v_receita
        FROM public.pagamentos p
        WHERE p.paciente_id IN (
            SELECT paciente_id FROM public.paciente_profissionais WHERE profissional_id = v_prof)
          AND p.status = 'pago'
          AND p.pago_em >= comp AND p.pago_em <= (comp + interval '1 month' - interval '1 day')::date;
        v_comissoes := v_receita * (cfg.comissao_percentual / 100);
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_forma,
    v_sessoes,
    v_salario,
    v_comissoes,
    coalesce(cfg.beneficios, 0),
    coalesce(cfg.descontos_fixos, 0),
    (v_salario + v_comissoes + coalesce(cfg.beneficios, 0) - coalesce(cfg.descontos_fixos, 0)),
    fp.status,
    fp.paga_em
  FROM (SELECT 1) x
  LEFT JOIN public.folha_pagamento fp
    ON fp.profissional_id = v_prof AND fp.competencia = comp;
END $$;

GRANT EXECUTE ON FUNCTION public.meu_financeiro_mensal(date) TO authenticated;
