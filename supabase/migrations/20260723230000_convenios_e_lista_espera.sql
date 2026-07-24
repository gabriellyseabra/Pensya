-- Bloco B — Convênios, valores por convênio×procedimento e lista de espera.
create table if not exists public.convenios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);
alter table public.convenios enable row level security;
create policy "Isolamento por organizacao" on public.convenios for select
  using ((org_id = my_org_id()) or (org_id is null) or (is_pensya_admin() and (my_org_id() is null)));
create policy "admin manages convenios" on public.convenios for all
  using (has_role(auth.uid(),'admin'::app_role)) with check (has_role(auth.uid(),'admin'::app_role));

create table if not exists public.convenio_valores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  tipo_servico_id uuid references public.tipos_servico(id) on delete cascade,
  valor numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (convenio_id, tipo_servico_id)
);
alter table public.convenio_valores enable row level security;
create policy "Isolamento por organizacao" on public.convenio_valores for select
  using ((org_id = my_org_id()) or (org_id is null));
create policy "admin manages convenio_valores" on public.convenio_valores for all
  using (has_role(auth.uid(),'admin'::app_role)) with check (has_role(auth.uid(),'admin'::app_role));

alter table public.atendimentos add column if not exists convenio_id uuid references public.convenios(id) on delete set null;
alter table public.pacientes add column if not exists convenio_id uuid references public.convenios(id) on delete set null;
alter table public.pagamentos add column if not exists convenio_id uuid references public.convenios(id) on delete set null;

create table if not exists public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  paciente_id uuid references public.pacientes(id) on delete cascade,
  nome_contato text,
  telefone text,
  profissional_id uuid references public.profissionais_consultorio(id) on delete set null,
  convenio_id uuid references public.convenios(id) on delete set null,
  prioridade text not null default 'normal',
  observacoes text,
  status text not null default 'aguardando',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lista_espera_org_idx on public.lista_espera (org_id);
alter table public.lista_espera enable row level security;
create policy "Isolamento por organizacao" on public.lista_espera for all
  using ((org_id = my_org_id()) or (org_id is null))
  with check ((org_id = my_org_id()) or (org_id is null));
