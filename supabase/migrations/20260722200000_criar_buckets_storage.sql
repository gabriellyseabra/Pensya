-- Os buckets de storage abaixo tinham policies definidas em migrations
-- anteriores, mas nunca eram criados por migration (eram criados à mão no
-- projeto original). Num projeto novo eles faltavam, causando "Bucket not
-- found" ao salvar sessão (áudio), anexar documentos, etc. Cria os buckets
-- (privados; o acesso é controlado pelas policies já existentes).
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('pacientes-docs',   'pacientes-docs',   false, 26214400),  -- 25 MB
  ('prontuario-docs',  'prontuario-docs',  false, 26214400),  -- 25 MB
  ('sessoes-audio',    'sessoes-audio',    false, 52428800),  -- 50 MB (áudio)
  ('cadastro-publico', 'cadastro-publico', false, 26214400)   -- 25 MB
on conflict (id) do nothing;
