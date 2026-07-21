-- Melhorias na tabela de tarefas
-- 1. Adicionar campo para referenciar sessões "para casa"
-- 2. Atualizar status padrão para "pendente" (antes era "a_fazer")

-- Adiciona coluna para rastrear sessões que ficaram para casa
ALTER TABLE public.tarefas
ADD COLUMN IF NOT EXISTS sessao_para_casa uuid REFERENCES public.sessoes(id) ON DELETE CASCADE;

-- Cria índice para filtrar tarefas de sessões "para casa"
CREATE INDEX IF NOT EXISTS idx_tarefas_sessao_para_casa ON public.tarefas (sessao_para_casa)
WHERE sessao_para_casa IS NOT NULL;

-- Atualiza status padrão de "a_fazer" para "pendente"
ALTER TABLE public.tarefas
ALTER COLUMN status SET DEFAULT 'pendente';

-- Atualiza registros existentes com status "a_fazer" para "pendente"
UPDATE public.tarefas SET status = 'pendente' WHERE status = 'a_fazer';
