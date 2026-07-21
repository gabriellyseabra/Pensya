
-- Helper: check if current user is assigned to the patient owning a storage object
create or replace function public.storage_object_paciente_assigned(_bucket text, _name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  pid uuid;
  avid uuid;
begin
  if _name is null then return false; end if;
  if public.has_role(auth.uid(), 'admin') then return true; end if;
  parts := string_to_array(_name, '/');
  if _bucket = 'pacientes-docs' then
    if array_length(parts,1) >= 2 and parts[1] = 'pacientes' then
      begin pid := parts[2]::uuid; exception when others then return false; end;
      return public.is_assigned_to_paciente(pid);
    end if;
    return false;
  elsif _bucket = 'sessoes-audio' then
    if array_length(parts,1) >= 1 then
      begin pid := parts[1]::uuid; exception when others then return false; end;
      return public.is_assigned_to_paciente(pid);
    end if;
    return false;
  elsif _bucket = 'prontuario-docs' then
    if array_length(parts,1) >= 2 and parts[1] = 'planos' then
      begin pid := parts[2]::uuid; exception when others then return false; end;
      return public.is_assigned_to_paciente(pid);
    elsif array_length(parts,1) >= 2 and parts[1] = 'avaliacoes' then
      begin avid := parts[2]::uuid; exception when others then return false; end;
      return exists (
        select 1 from public.avaliacoes a
        where a.id = avid and public.is_assigned_to_paciente(a.paciente_id)
      );
    end if;
    return false;
  end if;
  return false;
end
$$;

-- Drop all existing policies on the targeted tables, then recreate scoped ones
do $$
declare
  t text;
  pol record;
  tbls text[] := array[
    'atendimentos','avaliacao_documentos','bateria_itens','frequencia',
    'metas_terapeuticas','paciente_diagnosticos','paciente_documentos',
    'plano_ciclo_revisoes','plano_estrategias','plano_evidencias','plano_gas',
    'plano_metas','reunioes','sessao_metas','tarefas','testes_aplicados'
  ];
begin
  foreach t in array tbls loop
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- Direct paciente_id tables
create policy "paciente scoped access" on public.atendimentos
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

create policy "paciente scoped access" on public.frequencia
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

create policy "paciente scoped access" on public.metas_terapeuticas
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

create policy "paciente scoped access" on public.paciente_diagnosticos
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

create policy "paciente scoped access" on public.paciente_documentos
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

create policy "paciente scoped access" on public.reunioes
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id))
  with check (public.has_role(auth.uid(),'admin') or public.is_assigned_to_paciente(paciente_id));

-- avaliacao_id -> avaliacoes.paciente_id
create policy "paciente scoped access" on public.avaliacao_documentos
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  );

create policy "paciente scoped access" on public.bateria_itens
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  );

create policy "paciente scoped access" on public.testes_aplicados
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.avaliacoes a where a.id = avaliacao_id
        and public.is_assigned_to_paciente(a.paciente_id)
    )
  );

-- plano_id -> planos_terapeuticos.paciente_id
create policy "paciente scoped access" on public.plano_ciclo_revisoes
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  );

create policy "paciente scoped access" on public.plano_evidencias
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  );

create policy "paciente scoped access" on public.plano_metas
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.planos_terapeuticos p where p.id = plano_id
        and public.is_assigned_to_paciente(p.paciente_id)
    )
  );

-- meta_id -> plano_metas.plano_id -> planos_terapeuticos.paciente_id
create policy "paciente scoped access" on public.plano_estrategias
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.plano_metas m
      join public.planos_terapeuticos p on p.id = m.plano_id
      where m.id = meta_id and public.is_assigned_to_paciente(p.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.plano_metas m
      join public.planos_terapeuticos p on p.id = m.plano_id
      where m.id = meta_id and public.is_assigned_to_paciente(p.paciente_id)
    )
  );

create policy "paciente scoped access" on public.plano_gas
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.plano_metas m
      join public.planos_terapeuticos p on p.id = m.plano_id
      where m.id = meta_id and public.is_assigned_to_paciente(p.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.plano_metas m
      join public.planos_terapeuticos p on p.id = m.plano_id
      where m.id = meta_id and public.is_assigned_to_paciente(p.paciente_id)
    )
  );

-- sessao_id -> prontuario_sessoes.paciente_id
create policy "paciente scoped access" on public.sessao_metas
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.prontuario_sessoes s where s.id = sessao_id
        and public.is_assigned_to_paciente(s.paciente_id)
    )
  )
  with check (
    public.has_role(auth.uid(),'admin') or exists (
      select 1 from public.prontuario_sessoes s where s.id = sessao_id
        and public.is_assigned_to_paciente(s.paciente_id)
    )
  );

-- tarefas: paciente_id is nullable -> restrict when set, allow when null
create policy "paciente scoped access" on public.tarefas
  for all to authenticated
  using (
    paciente_id is null
    or public.has_role(auth.uid(),'admin')
    or public.is_assigned_to_paciente(paciente_id)
  )
  with check (
    paciente_id is null
    or public.has_role(auth.uid(),'admin')
    or public.is_assigned_to_paciente(paciente_id)
  );

-- Storage policies: drop existing for the three buckets, then recreate scoped ones
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname='storage' and tablename='objects'
  loop
    -- only drop policies whose USING expression references one of our 3 buckets;
    -- pg_policies doesn't expose that cleanly, so drop everything we explicitly recreate
    if pol.policyname like 'pacientes-docs%'
       or pol.policyname like 'prontuario-docs%'
       or pol.policyname like 'sessoes-audio%' then
      execute format('drop policy %I on storage.objects', pol.policyname);
    end if;
  end loop;
end $$;

create policy "pacientes-docs scoped select" on storage.objects
  for select to authenticated
  using (bucket_id = 'pacientes-docs' and public.storage_object_paciente_assigned('pacientes-docs', name));
create policy "pacientes-docs scoped insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pacientes-docs' and public.storage_object_paciente_assigned('pacientes-docs', name));
create policy "pacientes-docs scoped update" on storage.objects
  for update to authenticated
  using (bucket_id = 'pacientes-docs' and public.storage_object_paciente_assigned('pacientes-docs', name))
  with check (bucket_id = 'pacientes-docs' and public.storage_object_paciente_assigned('pacientes-docs', name));
create policy "pacientes-docs scoped delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pacientes-docs' and public.storage_object_paciente_assigned('pacientes-docs', name));

create policy "prontuario-docs scoped select" on storage.objects
  for select to authenticated
  using (bucket_id = 'prontuario-docs' and public.storage_object_paciente_assigned('prontuario-docs', name));
create policy "prontuario-docs scoped insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prontuario-docs' and public.storage_object_paciente_assigned('prontuario-docs', name));
create policy "prontuario-docs scoped update" on storage.objects
  for update to authenticated
  using (bucket_id = 'prontuario-docs' and public.storage_object_paciente_assigned('prontuario-docs', name))
  with check (bucket_id = 'prontuario-docs' and public.storage_object_paciente_assigned('prontuario-docs', name));
create policy "prontuario-docs scoped delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'prontuario-docs' and public.storage_object_paciente_assigned('prontuario-docs', name));

create policy "sessoes-audio scoped select" on storage.objects
  for select to authenticated
  using (bucket_id = 'sessoes-audio' and public.storage_object_paciente_assigned('sessoes-audio', name));
create policy "sessoes-audio scoped insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sessoes-audio' and public.storage_object_paciente_assigned('sessoes-audio', name));
create policy "sessoes-audio scoped update" on storage.objects
  for update to authenticated
  using (bucket_id = 'sessoes-audio' and public.storage_object_paciente_assigned('sessoes-audio', name))
  with check (bucket_id = 'sessoes-audio' and public.storage_object_paciente_assigned('sessoes-audio', name));
create policy "sessoes-audio scoped delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sessoes-audio' and public.storage_object_paciente_assigned('sessoes-audio', name));
