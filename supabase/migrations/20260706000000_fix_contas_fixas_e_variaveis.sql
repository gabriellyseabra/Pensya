-- ============================================================
-- Corrige bug de tipo (recorrencia_grupo é uuid, não text) e
-- adiciona suporte a contas fixas de valor variável (INSS/Simples,
-- energia, combustível, estacionamento…): o valor cadastrado vira
-- uma projeção; o lançamento gerado pode ser ajustado livremente
-- ao registrar o pagamento real.
-- ============================================================

ALTER TABLE public.contas_fixas
  ADD COLUMN IF NOT EXISTS variavel boolean NOT NULL DEFAULT false;

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
      WHERE l.recorrencia_grupo = cf.id
        AND date_trunc('month', l.competencia::date) = comp
    ) THEN
      INSERT INTO public.lancamentos_financeiros
        (tipo, status, descricao, valor, competencia, vencimento,
         plano_conta_id, fornecedor_id, centro_custo_id, recorrencia_grupo, created_by)
      VALUES (cf.tipo, 'previsto',
        cf.descricao || CASE WHEN cf.variavel THEN ' (estimado)' ELSE '' END,
        cf.valor, comp, make_date(_ano, _mes, cf.dia_vencimento),
        cf.plano_conta_id, cf.fornecedor_id, cf.centro_custo_id,
        cf.id, auth.uid());
      gerados := gerados + 1;
    END IF;
  END LOOP;
  RETURN gerados;
END $$;
REVOKE EXECUTE ON FUNCTION public.gerar_contas_fixas(int, int) FROM anon;

-- Lançamentos já gerados por conta fixa, mês a mês (para editar o valor real e dar baixa)
CREATE OR REPLACE FUNCTION public.contas_fixas_lancamentos(_ano int, _mes int)
RETURNS TABLE (
  conta_fixa_id uuid, lancamento_id uuid, valor numeric,
  status text, vencimento date, pago_em timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.recorrencia_grupo, l.id, l.valor, l.status, l.vencimento::date, l.pago_em
  FROM public.lancamentos_financeiros l
  WHERE public.is_equipe(auth.uid())
    AND l.recorrencia_grupo IN (SELECT id FROM public.contas_fixas)
    AND date_trunc('month', l.competencia::date) = make_date(_ano, _mes, 1)
$$;
REVOKE EXECUTE ON FUNCTION public.contas_fixas_lancamentos(int, int) FROM anon;
