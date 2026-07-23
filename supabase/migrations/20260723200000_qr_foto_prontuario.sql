-- Bloco D — QR-foto: upload de foto do celular direto para a galeria do paciente.

create table if not exists public.foto_upload_tokens (
  token text primary key,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  org_id uuid not null default my_org_id(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);
create index if not exists foto_upload_tokens_pac_idx on public.foto_upload_tokens (paciente_id);

alter table public.foto_upload_tokens enable row level security;

create policy "org gerencia foto tokens"
  on public.foto_upload_tokens for all
  using ((org_id = my_org_id()) or (org_id is null))
  with check ((org_id = my_org_id()) or (org_id is null));

-- Upload anônimo no bucket pacientes-docs quando há token válido para o paciente
-- do caminho (pacientes/{paciente_id}/galeria/...).
create policy "anon upload galeria por foto token"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'pacientes-docs'
    and split_part(name, '/', 1) = 'pacientes'
    and exists (
      select 1 from public.foto_upload_tokens t
      where t.paciente_id::text = split_part(name, '/', 2)
        and t.expires_at > now()
    )
  );

-- Info mínima para a página pública (paciente + branding da clínica).
create or replace function public.foto_token_info(_token text)
returns table (paciente_id uuid, paciente_nome text, clinica_nome text, logo_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, o.nome, o.logo_path
  from public.foto_upload_tokens t
  join public.pacientes p on p.id = t.paciente_id
  left join public.organizacoes o on o.id = t.org_id
  where t.token = _token and t.expires_at > now()
  limit 1;
$$;

-- Registra a foto enviada pelo celular como item de galeria do paciente.
create or replace function public.galeria_publica_add(_token text, _storage_path text, _mime text, _titulo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _pac uuid;
  _org uuid;
begin
  select paciente_id, org_id into _pac, _org
  from public.foto_upload_tokens
  where token = _token and expires_at > now()
  limit 1;

  if _pac is null then
    raise exception 'Link inválido ou expirado';
  end if;

  if split_part(_storage_path, '/', 2) <> _pac::text then
    raise exception 'Caminho inválido';
  end if;

  insert into public.paciente_documentos
    (paciente_id, org_id, categoria, titulo, storage_path, mime_type, galeria, origem)
  values
    (_pac, _org, 'Galeria', coalesce(nullif(_titulo, ''), 'Foto do celular'), _storage_path, _mime, true, 'qr');
end;
$$;

grant execute on function public.foto_token_info(text) to anon, authenticated;
grant execute on function public.galeria_publica_add(text, text, text, text) to anon, authenticated;
