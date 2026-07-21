-- Habilidades/sub-habilidades trabalhadas na sessão (gerado pela IA a partir da transcrição, editável)
ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS habilidades_trabalhadas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Acompanhamento da orientação para casa: se foi feita ou não pelo paciente/família
ALTER TABLE public.prontuario_sessoes
  ADD COLUMN IF NOT EXISTS orientacao_status text NOT NULL DEFAULT 'pendente'
    CHECK (orientacao_status IN ('pendente', 'feita', 'nao_feita')),
  ADD COLUMN IF NOT EXISTS orientacao_atualizado_em timestamptz;
