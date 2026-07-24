-- Bloco J — Gestão de documentos fiscais (NF, recibo, recibo de saúde)
create table if not exists public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  tipo text not null default 'nota_fiscal',
  paciente_id uuid references public.pacientes(id) on delete set null,
  tomador_nome text,
  tomador_documento text,
  competencia date,
  data_documento date not null default current_date,
  valor numeric not null default 0,
  descricao text,
  status text not null default 'pendente',
  numero text,
  pdf_path text,
  xml_path text,
  visivel_portal boolean not null default true,
  observacoes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documentos_fiscais_pac_idx on public.documentos_fiscais (paciente_id);
create index if not exists documentos_fiscais_org_idx on public.documentos_fiscais (org_id);
alter table public.documentos_fiscais enable row level security;
create policy "Isolamento por organizacao" on public.documentos_fiscais for select
  using ((org_id = my_org_id()) or (org_id is null) or (is_pensya_admin() and (my_org_id() is null)));
create policy "gestao documentos fiscais" on public.documentos_fiscais for all
  using (has_role(auth.uid(),'admin'::app_role) or (paciente_id is not null and is_assigned_to_paciente(paciente_id)))
  with check (has_role(auth.uid(),'admin'::app_role) or (paciente_id is not null and is_assigned_to_paciente(paciente_id)));
alter table public.pagamentos add column if not exists documento_fiscal_id uuid references public.documentos_fiscais(id) on delete set null;
alter table public.lancamentos_financeiros add column if not exists documento_fiscal_id uuid references public.documentos_fiscais(id) on delete set null;
alter table public.organizacoes
  add column if not exists inscricao_municipal text,
  add column if not exists codigo_servico_municipal text,
  add column if not exists aliquota_iss numeric,
  add column if not exists regime_tributario text,
  add column if not exists discriminacao_padrao text,
  add column if not exists prestador_registro text;
