-- Marca por paciente: emite nota fiscal (true) ou recibo (false) na geração automática.
alter table public.pacientes add column if not exists emite_nota boolean not null default false;
