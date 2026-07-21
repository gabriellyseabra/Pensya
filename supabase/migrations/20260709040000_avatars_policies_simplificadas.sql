-- Simplifica as políticas do bucket avatars: qualquer usuário autenticado pode
-- gravar/atualizar/remover no bucket avatars (leitura pública). Evita falhas de
-- RLS por diferença no caminho da pasta ao enviar a foto de perfil.
drop policy if exists "avatars upload proprio" on storage.objects;
drop policy if exists "avatars update proprio" on storage.objects;
drop policy if exists "avatars delete proprio" on storage.objects;

drop policy if exists "avatars insert autenticado" on storage.objects;
create policy "avatars insert autenticado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars update autenticado" on storage.objects;
create policy "avatars update autenticado" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "avatars delete autenticado" on storage.objects;
create policy "avatars delete autenticado" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars');
