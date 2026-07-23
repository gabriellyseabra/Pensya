-- Bloco D — modelo editável da declaração de comparecimento por clínica.
alter table public.organizacoes add column if not exists declaracao_modelo text;
