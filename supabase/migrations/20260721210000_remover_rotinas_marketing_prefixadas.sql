-- Remove as 9 rotinas de marketing pré-configuradas
-- As rotinas serão criadas conforme necessário pela clínica, evitando tarefas automáticas

DELETE FROM public.marketing_rotinas
WHERE titulo IN (
  'Publicar conteúdos no Instagram',
  'Realizar 1 enquete',
  'Convite para a Comunidade',
  'Social selling',
  'Publicar 1 conteúdo na Comunidade',
  'Planejar conteúdos do mês',
  'Aula gratuita ao vivo (30 min)',
  'Enviar lembrete do programa de indicações',
  'Contato com cada escola parceira'
);
