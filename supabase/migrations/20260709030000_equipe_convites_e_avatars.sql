-- Convites de equipe (admin cria; pessoa aceita via token e define senha + foto)
-- e bucket público "avatars" para fotos de perfil da equipe.

-- 1) Bucket público para fotos de perfil da equipe
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars leitura publica" on storage.objects;
create policy "avatars leitura publica" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars upload proprio" on storage.objects;
create policy "avatars upload proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update proprio" on storage.objects;
create policy "avatars update proprio" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete proprio" on storage.objects;
create policy "avatars delete proprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Convites de equipe
create table if not exists public.convites_equipe (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  nome text not null,
  email text,
  role public.app_role not null default 'profissional',
  registro_profissional text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '14 days',
  revogado boolean not null default false,
  usado_em timestamptz,
  usado_por uuid
);

alter table public.convites_equipe enable row level security;

drop policy if exists "Admin gerencia convites equipe" on public.convites_equipe;
create policy "Admin gerencia convites equipe" on public.convites_equipe
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select, insert, update, delete on public.convites_equipe to authenticated;

-- 3) Informações públicas do convite (por token)
create or replace function public.equipe_convite_info(_token text)
returns table (valido boolean, usado boolean, expirado boolean, nome text, email text, role text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare c record;
begin
  select * into c from public.convites_equipe where token = _token limit 1;
  if not found then
    return query select false, false, false, null::text, null::text, null::text;
    return;
  end if;
  return query select
    (not c.revogado and c.usado_em is null and c.expira_em > now()) as valido,
    (c.usado_em is not null) as usado,
    (c.expira_em <= now()) as expirado,
    c.nome, c.email, c.role::text;
end $$;

grant execute on function public.equipe_convite_info(text) to anon, authenticated;

-- 4) Aceite do convite (define papel + vínculo profissional)
create or replace function public.equipe_aceitar_convite(_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  prof_id uuid;
  meu_email text;
  meu_nome text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado para aceitar o convite';
  end if;

  select * into c from public.convites_equipe
  where token = _token and not revogado and expira_em > now()
    and (usado_em is null or usado_por = auth.uid())
  limit 1;
  if not found then
    raise exception 'Convite inválido, expirado ou já utilizado';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), c.role)
  on conflict (user_id, role) do nothing;

  if c.role = 'profissional' then
    select email into meu_email from auth.users where id = auth.uid();
    select nome into meu_nome from public.profiles where id = auth.uid();

    select id into prof_id from public.profissionais_consultorio
    where user_id = auth.uid() limit 1;

    if prof_id is null and c.email is not null then
      select id into prof_id from public.profissionais_consultorio
      where user_id is null and lower(email) = lower(c.email) limit 1;
    end if;

    if prof_id is not null then
      update public.profissionais_consultorio
        set user_id = auth.uid(),
            ativo = true,
            nome = coalesce(nullif(nome, ''), c.nome, meu_nome),
            email = coalesce(email, c.email, meu_email),
            registro_profissional = coalesce(registro_profissional, c.registro_profissional)
      where id = prof_id;
    else
      insert into public.profissionais_consultorio (nome, email, user_id, registro_profissional, ativo)
      values (coalesce(c.nome, meu_nome, 'Profissional'), coalesce(c.email, meu_email), auth.uid(), c.registro_profissional, true);
    end if;
  end if;

  update public.convites_equipe
    set usado_em = coalesce(usado_em, now()), usado_por = auth.uid()
  where id = c.id;
end $$;

grant execute on function public.equipe_aceitar_convite(text) to authenticated;
