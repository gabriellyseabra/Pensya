-- Melhorias na tabela de tarefas
-- Atualiza status padrão de "a_fazer" para "pendente" (mais intuitivo na UI).
-- Tarefas ligadas a uma sessão (orientações "para casa") já são filtradas na
-- aplicação por `sessao_id IS NULL`, sem necessidade de coluna extra.

ALTER TABLE public.tarefas
ALTER COLUMN status SET DEFAULT 'pendente';

-- Normaliza registros existentes.
UPDATE public.tarefas SET status = 'pendente' WHERE status = 'a_fazer';
