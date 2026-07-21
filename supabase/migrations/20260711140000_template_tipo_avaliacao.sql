-- Permite o tipo "avaliacao" nos templates de documentos (Relatório de
-- Avaliação Psicopedagógica no padrão Nave), usado tanto na geração quanto
-- na importação de modelos em PDF.
alter table public.documento_templates
  drop constraint if exists documento_templates_tipo_check;

alter table public.documento_templates
  add constraint documento_templates_tipo_check
  check (tipo = any (array['avaliacao','evolucao','plano_terapeutico','laudo','reuniao','livre']));
