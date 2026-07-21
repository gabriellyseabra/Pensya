-- =========================================================
-- Módulo de Gestão de Processos (POPs)
-- Departamentos (colunas do board) + Processos (cards, template completo)
-- + acessos granulares + link público read-only.
-- =========================================================

-- ============ DEPARTAMENTOS (lookup semeado = colunas do Kanban) ============
CREATE TABLE public.departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#5585b1',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_departamentos_ordem ON public.departamentos (ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departamentos TO authenticated;
GRANT ALL ON public.departamentos TO service_role;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
-- Todos os autenticados leem; só admin gerencia as colunas.
CREATE POLICY "Departamentos - leitura" ON public.departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Departamentos - admin gerencia" ON public.departamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.departamentos (nome, ordem, cor) VALUES
  ('P&D', 1, '#5585b1'),
  ('Marketing', 2, '#c77dff'),
  ('Comercial', 3, '#10b981'),
  ('Operações', 4, '#f9ca0a'),
  ('Atendimento ao Cliente', 5, '#f59e0b'),
  ('Financeiro', 6, '#064570'),
  ('RH', 7, '#ef4444'),
  ('Departamento Pessoal', 8, '#8b5cf6'),
  ('Jurídico', 9, '#64748b');

-- ============ PROCESSOS (cards / POPs) ============
CREATE TABLE public.processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  emoji text,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  frequencia text,
  categoria text,
  objetivo text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('rascunho','ativo','em_revisao','arquivado')),
  parent_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  visibilidade text NOT NULL DEFAULT 'equipe' CHECK (visibilidade IN ('equipe','restrito','publico')),
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Corpo do template (passo a passo, recursos, rotinas, riscos, métricas, tarefas pendentes)
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_processos_departamento ON public.processos (departamento_id);
CREATE INDEX idx_processos_parent ON public.processos (parent_id);
CREATE INDEX idx_processos_share_token ON public.processos (share_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos TO authenticated;
GRANT ALL ON public.processos TO service_role;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_processos_updated BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACESSOS GRANULARES (compartilhamento interno restrito) ============
CREATE TABLE public.processo_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'leitor' CHECK (papel IN ('leitor','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, user_id)
);
CREATE INDEX idx_processo_acessos_processo ON public.processo_acessos (processo_id);
CREATE INDEX idx_processo_acessos_user ON public.processo_acessos (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_acessos TO authenticated;
GRANT ALL ON public.processo_acessos TO service_role;
ALTER TABLE public.processo_acessos ENABLE ROW LEVEL SECURITY;

-- Helper: usuário pode editar um processo? (admin, criador ou acesso 'editor')
CREATE OR REPLACE FUNCTION public.pode_editar_processo(_processo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.processos p WHERE p.id = _processo_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.processo_acessos pa WHERE pa.processo_id = _processo_id AND pa.user_id = auth.uid() AND pa.papel = 'editor');
$$;
GRANT EXECUTE ON FUNCTION public.pode_editar_processo(uuid) TO authenticated;

-- ===== RLS de processos =====
CREATE POLICY "Processos - leitura" ON public.processos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
  OR visibilidade IN ('equipe','publico')
  OR EXISTS (SELECT 1 FROM public.processo_acessos pa WHERE pa.processo_id = processos.id AND pa.user_id = auth.uid())
);
CREATE POLICY "Processos - criar" ON public.processos FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Processos - editar" ON public.processos FOR UPDATE TO authenticated
USING (public.pode_editar_processo(id))
WITH CHECK (public.pode_editar_processo(id));
CREATE POLICY "Processos - excluir" ON public.processos FOR DELETE TO authenticated
USING (public.pode_editar_processo(id));

-- ===== RLS de processo_acessos (quem edita o processo gerencia os acessos) =====
CREATE POLICY "Acessos - leitura" ON public.processo_acessos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.pode_editar_processo(processo_id));
CREATE POLICY "Acessos - gerenciar" ON public.processo_acessos FOR ALL TO authenticated
USING (public.pode_editar_processo(processo_id))
WITH CHECK (public.pode_editar_processo(processo_id));

-- ============ LINK PÚBLICO (read-only, sem login) ============
CREATE OR REPLACE FUNCTION public.processo_publico_get(_token uuid)
RETURNS TABLE(
  id uuid, titulo text, emoji text, objetivo text, categoria text, frequencia text,
  status text, conteudo jsonb, departamento_nome text, departamento_cor text, atualizado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id, p.titulo, p.emoji, p.objetivo, p.categoria, p.frequencia,
         p.status, p.conteudo, d.nome, d.cor, p.updated_at
  FROM public.processos p
  LEFT JOIN public.departamentos d ON d.id = p.departamento_id
  WHERE p.share_token = _token AND p.visibilidade = 'publico'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.processo_publico_get(uuid) TO anon, authenticated;

-- ============ Vínculo opcional Tarefa -> Processo ============
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL;
