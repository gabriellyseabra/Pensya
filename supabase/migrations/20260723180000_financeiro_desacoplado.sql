-- Bloco A — Financeiro desacoplado do adquirente
-- Dá identidade de banco (nome + cor + logo) às contas, cria o catálogo de
-- formas de recebimento com taxa configurável (independente de InfinitePay/
-- Stone/qualquer adquirente) e registra taxa/líquido nos lançamentos e
-- pagamentos. Tudo aditivo — nada é removido.

-- 1. Identidade do banco nas contas financeiras
alter table public.contas_financeiras
  add column if not exists banco text,
  add column if not exists banco_cor text,
  add column if not exists logo_path text;

-- 2. Catálogo de formas de recebimento (por organização)
create table if not exists public.formas_recebimento (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default my_org_id(),
  nome text not null,
  -- dinheiro | pix | debito | credito | boleto | transferencia | outro
  tipo text not null default 'outro',
  taxa_percentual numeric not null default 0,
  taxa_fixa numeric not null default 0,
  prazo_dias integer not null default 0,
  conta_padrao_id uuid references public.contas_financeiras(id) on delete set null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists formas_recebimento_org_idx on public.formas_recebimento (org_id);

alter table public.formas_recebimento enable row level security;

-- Leitura isolada por organização (mesmo padrão de contas_financeiras).
create policy "Isolamento por organizacao"
  on public.formas_recebimento for select
  using ((org_id = my_org_id()) or (org_id is null) or (is_pensya_admin() and (my_org_id() is null)));

-- Gestão restrita ao admin da clínica.
create policy "admin manages formas_recebimento"
  on public.formas_recebimento for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- 3. Taxa e líquido nos lançamentos (forma_pagamento texto continua p/ retrocompat)
alter table public.lancamentos_financeiros
  add column if not exists forma_recebimento_id uuid references public.formas_recebimento(id) on delete set null,
  add column if not exists taxa numeric not null default 0,
  add column if not exists valor_liquido numeric;

-- 4. Forma + conta de destino + taxa nos pagamentos de pacientes
--    (generaliza o que hoje é taxa_infinitepay/valor_recebido).
alter table public.pagamentos
  add column if not exists forma_recebimento_id uuid references public.formas_recebimento(id) on delete set null,
  add column if not exists conta_id uuid references public.contas_financeiras(id) on delete set null,
  add column if not exists taxa numeric not null default 0;
