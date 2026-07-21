
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'profissional', 'secretaria');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  avatar_url TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles viewable by self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + first user becomes admin
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
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'profissional');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ CONFIG TABLES ============
-- Generic helper: create a simple lookup table
-- Diagnósticos
CREATE TABLE public.diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.status_frequencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT,
  conta_presenca BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.especialidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.categorias_habilidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.habilidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.categorias_habilidades(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.escolas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  parceira BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.profissionais_consultorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  registro_profissional TEXT,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.profissionais_consultorio_especialidades (
  profissional_id UUID NOT NULL REFERENCES public.profissionais_consultorio(id) ON DELETE CASCADE,
  especialidade_id UUID NOT NULL REFERENCES public.especialidades(id) ON DELETE CASCADE,
  PRIMARY KEY (profissional_id, especialidade_id)
);
CREATE TABLE public.profissionais_externos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  especialidade_id UUID REFERENCES public.especialidades(id) ON DELETE SET NULL,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PACIENTES ============
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  genero TEXT,
  foto_url TEXT,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  escola_id UUID REFERENCES public.escolas(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.modalidades(id) ON DELETE SET NULL,
  profissional_responsavel_id UUID REFERENCES public.profissionais_consultorio(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pacientes_nome ON public.pacientes (lower(nome));
CREATE INDEX idx_pacientes_aniversario ON public.pacientes (EXTRACT(MONTH FROM data_nascimento));

CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  parentesco TEXT,
  telefone TEXT,
  email TEXT,
  documento TEXT,
  principal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_responsaveis_paciente ON public.responsaveis (paciente_id);

CREATE TABLE public.paciente_diagnosticos (
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  diagnostico_id UUID NOT NULL REFERENCES public.diagnosticos(id) ON DELETE CASCADE,
  data_diagnostico DATE,
  observacoes TEXT,
  PRIMARY KEY (paciente_id, diagnostico_id)
);

CREATE TABLE public.paciente_profissionais (
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais_consultorio(id) ON DELETE CASCADE,
  PRIMARY KEY (paciente_id, profissional_id)
);

-- ============ AGENDA ============
CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES public.profissionais_consultorio(id) ON DELETE SET NULL,
  local_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.modalidades(id) ON DELETE SET NULL,
  status_frequencia_id UUID REFERENCES public.status_frequencia(id) ON DELETE SET NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  recorrencia TEXT,
  recorrencia_grupo UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atendimentos_inicio ON public.atendimentos (inicio);
CREATE INDEX idx_atendimentos_paciente ON public.atendimentos (paciente_id);
CREATE INDEX idx_atendimentos_profissional ON public.atendimentos (profissional_id);

-- ============ TAREFAS ============
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prazo DATE,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'a_fazer',
  concluida_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefas_prazo ON public.tarefas (prazo);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas (responsavel_id);

-- ============ GRANTS + RLS for all data tables ============
-- Helper: apply standard policies (any authenticated user can read/write; admin-only for config tables)

-- Config tables: admin manages, all authenticated can read
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'diagnosticos','modalidades','locais','status_frequencia','especialidades',
    'categorias_habilidades','habilidades','escolas',
    'profissionais_consultorio','profissionais_consultorio_especialidades','profissionais_externos'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Read all auth" ON public.%I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admin manages" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''));', t);
  END LOOP;
END $$;

-- Operational tables: any authenticated user (admin, profissional, secretaria) can manage
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'pacientes','responsaveis','paciente_diagnosticos','paciente_profissionais',
    'atendimentos','tarefas'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Auth read" ON public.%I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Auth write" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles','diagnosticos','escolas','pacientes','atendimentos','tarefas'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

-- Seed minimal defaults
INSERT INTO public.modalidades (nome, cor) VALUES
  ('Presencial', '#7c9eff'),
  ('Online', '#9b87f5'),
  ('Domiciliar', '#67c4a7');

INSERT INTO public.status_frequencia (nome, cor, conta_presenca) VALUES
  ('Agendado', '#94a3b8', false),
  ('Presente', '#22c55e', true),
  ('Falta', '#ef4444', false),
  ('Falta justificada', '#f59e0b', false),
  ('Remarcado', '#8b5cf6', false);
