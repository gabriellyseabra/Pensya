-- Galeria do paciente + anexos de mídia vindos do registro de sessão.
--
-- A tabela paciente_documentos passa a servir dois destinos:
--   • Documentos (galeria = false): laudos, relatórios, receituários, exames…
--   • Galeria    (galeria = true) : fotos e vídeos do paciente, inclusive os
--                                   anexados diretamente no registro de sessão.
--
-- `sessao_id` liga a mídia à sessão de origem (quando enviada pela sessão).
-- `origem` documenta de onde o arquivo veio (upload manual, sessão, família).

alter table public.paciente_documentos
  add column if not exists sessao_id uuid references public.prontuario_sessoes(id) on delete set null,
  add column if not exists galeria boolean not null default false,
  add column if not exists origem text;

create index if not exists idx_documentos_sessao on public.paciente_documentos(sessao_id);
create index if not exists idx_documentos_galeria on public.paciente_documentos(paciente_id, galeria);

-- A antiga "Galeria da família" (categoria = 'foto_familia') passa a fazer
-- parte da galeria unificada do paciente.
update public.paciente_documentos
   set galeria = true,
       origem = coalesce(origem, 'familia')
 where categoria = 'foto_familia';

-- Garante que o bucket aceite arquivos de até 25 MB (fotos, vídeos e documentos)
-- sem restrição de mime-type. O bucket já existe; apenas ajustamos o limite.
update storage.buckets
   set file_size_limit = 26214400,        -- 25 MB
       allowed_mime_types = null           -- aceita imagem, vídeo e documentos
 where id = 'pacientes-docs';
