-- =========================================================
-- Modelos de cadastro público por faixa de idade
-- (pré-escolar, escolar, adulto, idoso, ...). A adm cria/edita
-- perguntas EXTRAS que são anexadas ao formulário público conforme
-- a faixa etária do paciente (auto por idade, com override manual).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.cadastro_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE DEFAULT public.my_org_id(),
  nome text NOT NULL,
  faixa text,                         -- rótulo da faixa (ex.: "Escolar")
  idade_min int,                      -- idade mínima (anos) — null = sem limite inferior
  idade_max int,                      -- idade máxima (anos) — null = sem limite superior
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false, -- modelo usado quando nenhuma faixa casa
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastro_modelos_org ON public.cadastro_modelos(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadastro_modelos TO authenticated;
GRANT ALL ON public.cadastro_modelos TO service_role;

ALTER TABLE public.cadastro_modelos ENABLE ROW LEVEL SECURITY;

-- Equipe autenticada gerencia os modelos da própria organização.
DROP POLICY IF EXISTS "equipe gerencia modelos" ON public.cadastro_modelos;
CREATE POLICY "equipe gerencia modelos" ON public.cadastro_modelos
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid()))
  WITH CHECK (public.is_equipe(auth.uid()));

-- Isolamento por organização (RESTRICTIVE, combinada com AND).
DROP POLICY IF EXISTS "Isolamento por organizacao" ON public.cadastro_modelos;
CREATE POLICY "Isolamento por organizacao" ON public.cadastro_modelos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.my_org_id() OR org_id IS NULL OR public.is_pensya_admin())
  WITH CHECK (org_id = public.my_org_id() OR public.is_pensya_admin());

DROP TRIGGER IF EXISTS trg_cadastro_modelos_updated ON public.cadastro_modelos;
CREATE TRIGGER trg_cadastro_modelos_updated
  BEFORE UPDATE ON public.cadastro_modelos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vincula (opcionalmente) um modelo específico a um link de cadastro.
ALTER TABLE public.cadastro_publico
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.cadastro_modelos(id) ON DELETE SET NULL;

-- =========================================================
-- RPC pública: resolve o modelo aplicável a um cadastro.
-- Prioridade: modelo fixado no link > faixa que casa com a idade >
-- modelo padrão da organização. Retorna as perguntas para renderizar.
-- =========================================================
CREATE OR REPLACE FUNCTION public.cadastro_modelo_resolver(_token text, _idade int DEFAULT NULL)
RETURNS TABLE(id uuid, nome text, faixa text, perguntas jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_modelo_id uuid;
BEGIN
  SELECT cp.org_id, cp.modelo_id INTO v_org, v_modelo_id
  FROM public.cadastro_publico cp
  WHERE cp.token = _token AND cp.expires_at > now()
  LIMIT 1;

  IF v_org IS NULL AND v_modelo_id IS NULL THEN
    RETURN;
  END IF;

  -- 1) Modelo fixado explicitamente no link.
  IF v_modelo_id IS NOT NULL THEN
    RETURN QUERY
      SELECT m.id, m.nome, m.faixa, m.perguntas
      FROM public.cadastro_modelos m
      WHERE m.id = v_modelo_id AND m.ativo
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2) Faixa que casa com a idade informada.
  IF _idade IS NOT NULL THEN
    RETURN QUERY
      SELECT m.id, m.nome, m.faixa, m.perguntas
      FROM public.cadastro_modelos m
      WHERE m.org_id = v_org AND m.ativo
        AND (m.idade_min IS NULL OR _idade >= m.idade_min)
        AND (m.idade_max IS NULL OR _idade <= m.idade_max)
      ORDER BY (m.idade_min IS NOT NULL) DESC, (m.idade_max IS NOT NULL) DESC, m.ordem, m.created_at
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3) Modelo padrão da organização.
  RETURN QUERY
    SELECT m.id, m.nome, m.faixa, m.perguntas
    FROM public.cadastro_modelos m
    WHERE m.org_id = v_org AND m.ativo AND m.padrao
    ORDER BY m.ordem, m.created_at
    LIMIT 1;
END $$;

GRANT EXECUTE ON FUNCTION public.cadastro_modelo_resolver(text, int) TO anon, authenticated;
