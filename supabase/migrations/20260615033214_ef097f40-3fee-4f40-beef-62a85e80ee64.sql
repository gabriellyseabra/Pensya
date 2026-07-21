
CREATE TABLE public.reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'pais',
  data_reuniao timestamptz NOT NULL DEFAULT now(),
  duracao_minutos int,
  participantes text,
  pauta text,
  notas text,
  ata text,
  decisoes text,
  encaminhamentos jsonb,
  proxima_data date,
  audio_path text,
  transcricao text,
  status text NOT NULL DEFAULT 'agendada',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes TO authenticated;
GRANT ALL ON public.reunioes TO service_role;

ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode tudo em reunioes" ON public.reunioes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_reunioes_updated_at
  BEFORE UPDATE ON public.reunioes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reunioes_paciente_data ON public.reunioes(paciente_id, data_reuniao DESC);
