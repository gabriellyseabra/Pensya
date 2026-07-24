-- Bloco C — Pacote/saldo consumível de sessões.
create table if not exists public.pacotes_sessao (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  descricao text,
  total_sessoes integer not null default 1,
  sessoes_usadas integer not null default 0,
  valor numeric not null default 0,
  data_compra date not null default current_date,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pacotes_sessao_pac_idx on public.pacotes_sessao (paciente_id);
alter table public.pacotes_sessao enable row level security;
create policy "Isolamento por organizacao" on public.pacotes_sessao for select
  using ((org_id = my_org_id()) or (org_id is null) or (is_pensya_admin() and (my_org_id() is null)));
create policy "paciente scoped pacotes" on public.pacotes_sessao for all
  using (has_role(auth.uid(),'admin'::app_role) or is_assigned_to_paciente(paciente_id))
  with check (has_role(auth.uid(),'admin'::app_role) or is_assigned_to_paciente(paciente_id));
