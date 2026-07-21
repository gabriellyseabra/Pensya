-- =========================================================
-- Seed dos processos (POPs) a partir do quadro do Notion.
-- Idempotente por título: rodar de novo não duplica.
-- =========================================================

-- Processos por departamento (nível raiz e subitens; parent_id definido logo abaixo).
INSERT INTO public.processos (titulo, emoji, departamento_id, categoria, conteudo)
SELECT v.titulo, v.emoji, d.id, v.categoria, '{}'::jsonb
FROM (VALUES
  -- P&D
  ('Pesquisa e estudos', '🔬', 'P&D', 'Tático'),
  ('Estrutura de produtos e serviços', '📦', 'P&D', 'Tático'),
  ('Estrutura de entregas', '🚚', 'P&D', 'Tático'),
  ('Experiência do cliente', '✨', 'P&D', 'Tático'),
  -- Marketing
  ('Planejamento e desenvolvimento de estratégias de marketing', '📣', 'Marketing', 'Estratégico'),
  ('Escrever copys de conteúdos', '✍️', 'Marketing', 'Operacional'),
  ('Produção de conteúdo', '🎨', 'Marketing', 'Operacional'),
  ('Gravação e edição de vídeos', '🎬', 'Marketing', 'Operacional'),
  -- Comercial
  ('Acolhimento Inicial de Pacientes', '🤝', 'Comercial', 'Tático'),
  ('Follow-up de leads', '📞', 'Comercial', 'Operacional'),
  ('CRM - Organização de leads e fluxo de vendas', '🗂️', 'Comercial', 'Tático'),
  ('Encaminhamento para outros profissionais', '🔀', 'Comercial', 'Operacional'),
  ('Nutrição de Leads não-convertidos', '🌱', 'Comercial', 'Operacional'),
  ('Estratégias de Vendas', '💡', 'Comercial', 'Estratégico'),
  ('Processo de Vendas', '💰', 'Comercial', 'Tático'),
  -- Operações
  ('Onboarding de Novo Cliente', '🚀', 'Operações', 'Tático'),
  ('Emissão e envio de contrato (Authentique)', '📄', 'Operações', 'Operacional'),
  ('Cadastro do cliente e cobrança recorrente no InfinitePay', '💳', 'Operações', 'Operacional'),
  ('Avaliação Psicopedagógica - Gabrielly', '🧠', 'Operações', 'Tático'),
  ('Avaliação Psicopedagógica - Equipe', '👥', 'Operações', 'Tático'),
  -- Atendimento ao Cliente
  ('Plataformas', '💻', 'Atendimento ao Cliente', 'Operacional'),
  ('Cultura de atendimento', '💛', 'Atendimento ao Cliente', 'Estratégico'),
  ('Processo de atendimento', '🎧', 'Atendimento ao Cliente', 'Tático'),
  ('Método de suporte', '🛟', 'Atendimento ao Cliente', 'Tático'),
  ('Pós-vendas', '🔁', 'Atendimento ao Cliente', 'Tático')
) AS v(titulo, emoji, dep, categoria)
JOIN public.departamentos d ON d.nome = v.dep
WHERE NOT EXISTS (SELECT 1 FROM public.processos p WHERE p.titulo = v.titulo);

-- Hierarquia: subitens de "Acolhimento Inicial de Pacientes".
UPDATE public.processos child
SET parent_id = parent.id
FROM public.processos parent
WHERE parent.titulo = 'Acolhimento Inicial de Pacientes'
  AND child.titulo IN (
    'Follow-up de leads',
    'CRM - Organização de leads e fluxo de vendas',
    'Encaminhamento para outros profissionais',
    'Nutrição de Leads não-convertidos'
  );

-- Hierarquia: subitens de "Onboarding de Novo Cliente".
UPDATE public.processos child
SET parent_id = parent.id
FROM public.processos parent
WHERE parent.titulo = 'Onboarding de Novo Cliente'
  AND child.titulo IN (
    'Emissão e envio de contrato (Authentique)',
    'Cadastro do cliente e cobrança recorrente no InfinitePay'
  );
