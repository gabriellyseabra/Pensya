-- =========================================================
-- Fase 1 — Fundação multi-clínica (núcleo)
-- Organizações + membros + funções centrais de segurança.
-- =========================================================

-- ============ ORGANIZAÇÕES (clínicas clientes do Pensya) ============
CREATE TABLE public.organizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  razao_social text,
  cnpj text,
  endereco text,
  cidade text,
  telefone text,
  email text,
  responsavel_nome text,
  logo_path text,
  cor_primaria text,
  whatsapp text,
  plano text NOT NULL DEFAULT 'trial' CHECK (plano IN ('trial', 'essencial', 'equipe', 'clinica')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'ativa', 'inadimplente', 'cancelada')),
  trial_termina_em timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_organizacoes_updated BEFORE UPDATE ON public.organizacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MEMBROS (usuário ↔ organização ↔ papel) ============
CREATE TABLE public.organizacao_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.app_role NOT NULL CHECK (papel IN ('admin', 'profissional', 'secretaria')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX idx_organizacao_membros_org ON public.organizacao_membros(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizacoes TO authenticated;
GRANT ALL ON public.organizacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizacao_membros TO authenticated;
GRANT ALL ON public.organizacao_membros TO service_role;
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacao_membros ENABLE ROW LEVEL SECURITY;

-- ============ FUNÇÕES DE APOIO ============
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organizacao_membros WHERE user_id = auth.uid() AND ativo LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_pensya_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'pensya_admin');
$$;
GRANT EXECUTE ON FUNCTION public.my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pensya_admin() TO authenticated, anon;

-- has_role(): mantém a MESMA assinatura usada em ~40 policies já existentes.
-- 'pensya_admin' continua olhando user_roles (papel de plataforma).
-- 'admin' | 'profissional' | 'secretaria' passam a olhar organizacao_membros
-- (papel DENTRO da organização do usuário) em vez do antigo modelo de
-- inquilino único. Isso preserva todas as policies atuais sem reescrevê-las.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _role = 'pensya_admin' THEN
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'pensya_admin')
    ELSE
      EXISTS (SELECT 1 FROM public.organizacao_membros WHERE user_id = _user_id AND papel = _role AND ativo)
      OR public.is_pensya_admin()
  END;
$$;

-- is_equipe(): pertence à equipe de ALGUMA organização (qualquer papel), ou é pensya_admin.
CREATE OR REPLACE FUNCTION public.is_equipe(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizacao_membros WHERE user_id = _user_id AND ativo)
    OR public.is_pensya_admin();
$$;

-- ============ RLS: organizacoes / organizacao_membros ============
CREATE POLICY "Pensya admin gerencia organizacoes" ON public.organizacoes
  FOR ALL TO authenticated USING (public.is_pensya_admin()) WITH CHECK (public.is_pensya_admin());
CREATE POLICY "Membros leem a propria organizacao" ON public.organizacoes
  FOR SELECT TO authenticated USING (id = public.my_org_id());
CREATE POLICY "Org admin atualiza a propria organizacao" ON public.organizacoes
  FOR UPDATE TO authenticated USING (id = public.my_org_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.my_org_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Pensya admin gerencia membros" ON public.organizacao_membros
  FOR ALL TO authenticated USING (public.is_pensya_admin()) WITH CHECK (public.is_pensya_admin());
CREATE POLICY "Org admin gerencia membros da propria org" ON public.organizacao_membros
  FOR ALL TO authenticated
  USING (org_id = public.my_org_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (org_id = public.my_org_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Usuario le seu proprio vinculo" ON public.organizacao_membros
  FOR SELECT TO authenticated USING (user_id = auth.uid());
