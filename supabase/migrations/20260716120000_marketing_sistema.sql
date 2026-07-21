-- =========================================================
-- Sistema de Marketing para Aquisição de Leads
-- Camada estratégica (editável): objetivos, funis + ações,
-- rotinas recorrentes (com execuções por período), indicadores
-- gerais (auto/manual) e princípios.
-- =========================================================

-- Canal 'Escola' usado pelo indicador de encaminhamentos.
INSERT INTO public.canais_marketing (nome)
VALUES ('Escola')
ON CONFLICT (nome) DO NOTHING;

-- ============ OBJETIVOS ESTRATÉGICOS ============
CREATE TABLE public.marketing_objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'target',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_objetivos TO authenticated;
GRANT ALL ON public.marketing_objetivos TO service_role;
ALTER TABLE public.marketing_objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_objetivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_objetivos_updated BEFORE UPDATE ON public.marketing_objetivos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.marketing_objetivos (nome, icone, ordem) VALUES
  ('Captação de novas famílias', 'user-plus', 1),
  ('Fortalecimento da autoridade', 'award', 2),
  ('Relacionamento contínuo', 'message-circle', 3),
  ('Conversão em pacientes', 'target', 4),
  ('Indicações espontâneas', 'share-2', 5);

-- ============ FUNIS ESTRATÉGICOS ============
CREATE TABLE public.marketing_funis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  nome text NOT NULL,
  descricao text,
  cor text NOT NULL DEFAULT '#064570',
  etapas jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "label": "Instagram", "cor": "#ec4899" }, ...]
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_funis TO authenticated;
GRANT ALL ON public.marketing_funis TO service_role;
ALTER TABLE public.marketing_funis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_funis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_funis_updated BEFORE UPDATE ON public.marketing_funis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.marketing_funis (numero, nome, descricao, cor, etapas, ordem) VALUES
  (1, 'Aquisição pelo Instagram', 'Atrair novas famílias e gerar conversas qualificadas.', '#ec4899',
   '[{"label":"Instagram","cor":"#ec4899"},{"label":"Conteúdo","cor":"#a855f7"},{"label":"Interação","cor":"#5585b1"},{"label":"WhatsApp","cor":"#22c55e"},{"label":"Paciente","cor":"#f9ca0a"}]'::jsonb, 1),
  (2, 'Comunidade Nave', 'Manter relacionamento contínuo com famílias.', '#06b6d4',
   '[{"label":"Instagram/WhatsApp","cor":"#ec4899"},{"label":"Comunidade","cor":"#a855f7"},{"label":"Relacionamento","cor":"#5585b1"},{"label":"Paciente","cor":"#22c55e"}]'::jsonb, 2),
  (3, 'Famílias que Conectam', 'Estimular indicações espontâneas.', '#22c55e',
   '[{"label":"Paciente","cor":"#22c55e"},{"label":"Programa","cor":"#a855f7"},{"label":"Indicação","cor":"#f9ca0a"},{"label":"Novo Paciente","cor":"#5585b1"}]'::jsonb, 3),
  (4, 'Parcerias com Escolas', 'Fortalecer relacionamento com escolas e gerar encaminhamentos.', '#f59e0b',
   '[{"label":"Escola","cor":"#f59e0b"},{"label":"Encaminhamento","cor":"#5585b1"},{"label":"WhatsApp","cor":"#22c55e"},{"label":"Paciente","cor":"#f9ca0a"}]'::jsonb, 4);

-- ============ AÇÕES DE CADA FUNIL ============
CREATE TABLE public.marketing_funil_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id uuid NOT NULL REFERENCES public.marketing_funis(id) ON DELETE CASCADE,
  texto text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_funil_acoes_funil ON public.marketing_funil_acoes (funil_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_funil_acoes TO authenticated;
GRANT ALL ON public.marketing_funil_acoes TO service_role;
ALTER TABLE public.marketing_funil_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_funil_acoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.marketing_funil_acoes (funil_id, texto, ordem)
SELECT f.id, x.texto, x.ordem
FROM public.marketing_funis f
JOIN (VALUES
  (1, 'Publicar Reels educativos 3x/semana com dicas práticas para pais sobre desenvolvimento infantil.', 1),
  (1, 'Usar enquetes e caixas de perguntas nos Stories para identificar dores e gerar interação.', 2),
  (1, 'Incluir CTAs claros direcionando para o WhatsApp (ex: ''Quer saber mais? Me chama no WhatsApp'').', 3),
  (1, 'Responder comentários e DMs em até 24h para manter o engajamento.', 4),
  (1, 'Criar carrosséis com mitos vs verdades sobre psicopedagogia.', 5),
  (2, 'Criar grupo no WhatsApp ou Telegram com conteúdo exclusivo.', 1),
  (2, 'Oferecer 1 aula ao vivo gratuita por mês (30 min) sobre temas relevantes.', 2),
  (2, 'Compartilhar materiais exclusivos (PDFs, checklists) para membros da comunidade.', 3),
  (2, 'Fazer enquetes internas para entender necessidades e criar novos conteúdos.', 4),
  (2, 'Usar depoimentos de famílias satisfeitas para gerar prova social dentro do grupo.', 5),
  (3, 'Criar programa ''Famílias que Conectam'' com benefícios para quem indica (ex: desconto na próxima sessão).', 1),
  (3, 'Enviar lembrete a cada 2 meses sobre o programa via WhatsApp.', 2),
  (3, 'Celebrar publicamente (com autorização) conquistas dos pacientes para gerar orgulho e vontade de compartilhar.', 3),
  (3, 'Oferecer cartão digital de indicação que as famílias possam encaminhar facilmente.', 4),
  (4, 'Manter contato mensal com coordenadores pedagógicos das escolas parceiras.', 1),
  (4, 'Oferecer palestras gratuitas semestrais para professores sobre sinais de dificuldades de aprendizagem.', 2),
  (4, 'Enviar relatórios de evolução (com autorização) para a escola acompanhar o progresso do aluno.', 3),
  (4, 'Criar material informativo para escolas distribuírem aos pais quando identificarem necessidade de apoio.', 4)
) AS x(numero, texto, ordem) ON x.numero = f.numero;

-- ============ ROTINAS RECORRENTES ============
CREATE TABLE public.marketing_rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id uuid REFERENCES public.marketing_funis(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  cadencia text NOT NULL DEFAULT 'semanal' CHECK (cadencia IN ('semanal', 'mensal', 'bimestral')),
  meta_qtd integer NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_rotinas TO authenticated;
GRANT ALL ON public.marketing_rotinas TO service_role;
ALTER TABLE public.marketing_rotinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_rotinas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_rotinas_updated BEFORE UPDATE ON public.marketing_rotinas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.marketing_rotinas (funil_id, titulo, cadencia, meta_qtd, ordem)
SELECT f.id, x.titulo, x.cadencia, x.meta_qtd, x.ordem
FROM public.marketing_funis f
JOIN (VALUES
  (1, 'Publicar conteúdos no Instagram', 'semanal', 3, 1),
  (1, 'Realizar 1 enquete', 'semanal', 1, 2),
  (1, 'Convite para a Comunidade', 'semanal', 1, 3),
  (1, 'Social selling', 'semanal', 2, 4),
  (2, 'Publicar 1 conteúdo na Comunidade', 'semanal', 1, 1),
  (2, 'Planejar conteúdos do mês', 'mensal', 1, 2),
  (2, 'Aula gratuita ao vivo (30 min)', 'mensal', 1, 3),
  (3, 'Enviar lembrete do programa de indicações', 'bimestral', 1, 1),
  (4, 'Contato com cada escola parceira', 'mensal', 1, 1)
) AS x(numero, titulo, cadencia, meta_qtd, ordem) ON x.numero = f.numero;

-- ============ EXECUÇÕES DE ROTINA (por período) ============
-- `periodo` = data de início do período (semana ISO / 1º dia do mês / 1º dia do bimestre).
-- Ausência de linha para o período atual = rotina ainda não cumprida (auto-reset).
CREATE TABLE public.marketing_rotina_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.marketing_rotinas(id) ON DELETE CASCADE,
  periodo date NOT NULL,
  feito boolean NOT NULL DEFAULT false,
  quantidade integer NOT NULL DEFAULT 0,
  feito_em timestamptz,
  feito_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, periodo)
);
CREATE INDEX idx_mkt_rotina_exec_periodo ON public.marketing_rotina_execucoes (periodo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_rotina_execucoes TO authenticated;
GRANT ALL ON public.marketing_rotina_execucoes TO service_role;
ALTER TABLE public.marketing_rotina_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_rotina_execucoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ INDICADORES GERAIS ============
-- tipo 'auto' => calculado no app a partir de `fonte`; 'manual' => valor mensal lançado à mão.
CREATE TABLE public.marketing_indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'activity',
  cor text NOT NULL DEFAULT '#064570',
  tipo text NOT NULL DEFAULT 'manual' CHECK (tipo IN ('auto', 'manual')),
  fonte text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_indicadores TO authenticated;
GRANT ALL ON public.marketing_indicadores TO service_role;
ALTER TABLE public.marketing_indicadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_indicadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_indicadores_updated BEFORE UPDATE ON public.marketing_indicadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.marketing_indicadores (chave, nome, icone, cor, tipo, fonte, ordem) VALUES
  ('novos_pacientes', 'Novos pacientes', 'user-plus', '#5585b1', 'auto', 'pacientes_novos', 1),
  ('avaliacoes_agendadas', 'Avaliações agendadas', 'calendar-check', '#ec4899', 'manual', NULL, 2),
  ('conversas_whatsapp', 'Conversas iniciadas no WhatsApp', 'message-circle', '#22c55e', 'auto', 'interacoes_whatsapp', 3),
  ('crescimento_comunidade', 'Crescimento da Comunidade', 'users', '#a855f7', 'manual', NULL, 4),
  ('indicacoes_recebidas', 'Indicações recebidas', 'share-2', '#f9ca0a', 'auto', 'canal:indicacao', 5),
  ('encaminhamentos_escolas', 'Encaminhamentos das escolas', 'school', '#f59e0b', 'auto', 'canal:escola', 6);

-- ============ VALORES MENSAIS DOS INDICADORES MANUAIS ============
CREATE TABLE public.marketing_indicador_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES public.marketing_indicadores(id) ON DELETE CASCADE,
  competencia date NOT NULL, -- 1º dia do mês
  valor numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicador_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_indicador_valores TO authenticated;
GRANT ALL ON public.marketing_indicador_valores TO service_role;
ALTER TABLE public.marketing_indicador_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_indicador_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_ind_valores_updated BEFORE UPDATE ON public.marketing_indicador_valores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRINCÍPIOS ============
CREATE TABLE public.marketing_principios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_principios TO authenticated;
GRANT ALL ON public.marketing_principios TO service_role;
ALTER TABLE public.marketing_principios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.marketing_principios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mkt_principios_updated BEFORE UPDATE ON public.marketing_principios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
