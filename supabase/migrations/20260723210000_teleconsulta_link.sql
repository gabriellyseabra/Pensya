-- Bloco E — Teleconsulta por link (colável). Sem vídeo embutido.
alter table public.atendimentos add column if not exists link_video text;
alter table public.profissionais_consultorio add column if not exists link_video_padrao text;
