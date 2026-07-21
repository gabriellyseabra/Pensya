
-- ============== DOMÍNIOS COGNITIVOS ==============
CREATE TABLE public.dominios_cognitivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dominios_cognitivos TO authenticated;
GRANT ALL ON public.dominios_cognitivos TO service_role;
ALTER TABLE public.dominios_cognitivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage dominios" ON public.dominios_cognitivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER dominios_cognitivos_updated_at BEFORE UPDATE ON public.dominios_cognitivos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.dominios_cognitivos (nome) VALUES
  ('Atenção'),('Funções Executivas'),('Memória'),('Linguagem'),('Linguagem escrita'),
  ('Alfabetização'),('Leitura'),('Matemática'),('Motricidade'),('Desenvolvimento Global'),
  ('Socioemocional'),('Metacognição e Aprendizagem'),('Cognição social'),
  ('Comportamento Adaptativo'),('Comportamental'),('Desempenho escolar'),
  ('Processamento fonológico'),('Rastreio de Sintomas TDAH'),
  ('Rastreio de Sintomas TEA'),('Rastreio de Sintomas AH/SD');

-- ============== CLASSIFICAÇÃO NORMATIVA ==============
CREATE TABLE public.classificacao_normativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classificacao TEXT NOT NULL,
  escore_min INT,
  escore_max INT,
  percentil_min NUMERIC,
  percentil_max NUMERIC,
  ordem INT NOT NULL,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classificacao_normativa TO authenticated;
GRANT ALL ON public.classificacao_normativa TO service_role;
ALTER TABLE public.classificacao_normativa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage classificacao" ON public.classificacao_normativa FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER classificacao_normativa_updated_at BEFORE UPDATE ON public.classificacao_normativa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.classificacao_normativa (classificacao, escore_min, escore_max, percentil_min, percentil_max, ordem, cor) VALUES
  ('Extremamente superior', 130, NULL, 98, 100, 1, '#15803d'),
  ('Superior à média',      120, 129, 91, 97,  2, '#22c55e'),
  ('Média Superior',        110, 119, 75, 90,  3, '#84cc16'),
  ('Média',                 90,  109, 25, 74,  4, '#3b82f6'),
  ('Média Inferior',        80,  89,  9,  24,  5, '#f59e0b'),
  ('Inferior à média',      70,  79,  2,  8,   6, '#f97316'),
  ('Extremamente inferior', NULL,69,  0,  1,   7, '#dc2626');

-- ============== FUNÇÃO DE CLASSIFICAÇÃO ==============
CREATE OR REPLACE FUNCTION public.classificar_resultado(_percentil NUMERIC, _escore INT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT classificacao FROM public.classificacao_normativa
  WHERE (
    (_percentil IS NOT NULL AND _percentil >= COALESCE(percentil_min, -1) AND _percentil <= COALESCE(percentil_max, 100))
    OR
    (_percentil IS NULL AND _escore IS NOT NULL
      AND _escore >= COALESCE(escore_min, -999999)
      AND _escore <= COALESCE(escore_max, 999999))
  )
  ORDER BY ordem ASC
  LIMIT 1;
$$;

-- ============== CATÁLOGO DE TESTES ==============
CREATE TABLE public.testes_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  dominio_id UUID REFERENCES public.dominios_cognitivos(id) ON DELETE SET NULL,
  objetivo TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testes_catalogo TO authenticated;
GRANT ALL ON public.testes_catalogo TO service_role;
ALTER TABLE public.testes_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage testes_catalogo" ON public.testes_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER testes_catalogo_updated_at BEFORE UPDATE ON public.testes_catalogo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_testes_catalogo_dominio ON public.testes_catalogo(dominio_id);

-- Seed do catálogo
INSERT INTO public.testes_catalogo (nome, dominio_id, objetivo)
SELECT t.nome, d.id, t.objetivo
FROM (VALUES
  ('Tarefas de Fluência Verbal','Linguagem','Acesso lexical, velocidade de recuperação, organização semântica/fonológica, monitoramento e controle inibitório sob demanda de tempo'),
  ('Hayling','Funções Executivas','Controle inibitório verbal, velocidade de processamento e flexibilidade cognitiva.'),
  ('GAN','Linguagem','Controle executivo, inibição de padrões automáticos, monitoramento sob demanda contínua.'),
  ('DNOI','Linguagem','Organização discursiva oral, coerência, coesão, planejamento linguístico, vocabulário e pragmática narrativa.'),
  ('DNEI','Linguagem','Organização discursiva oral por meio da leitura.'),
  ('Trilhas','Funções Executivas','Atenção sustentada/alternada, velocidade de processamento e flexibilidade cognitiva visuomotora.'),
  ('Teste de Atenção por Cancelamento','Atenção','Atenção seletiva e sustentada, eficiência de busca visual, velocidade e precisão.'),
  ('Torre de Londres','Funções Executivas','Planejamento, antecipação de consequências, solução de problemas e monitoramento executivo.'),
  ('Torre de Hanoi','Funções Executivas','Planejamento sequencial, flexibilidade cognitiva, memória de trabalho e aprendizagem por tentativa e erro.'),
  ('Cubos de Corsi','Memória','Memória visuoespacial de curto prazo e memória de trabalho visuoespacial.'),
  ('Span de Dígitos','Memória','Memória auditiva de curto prazo e memória de trabalho verbal.'),
  ('Teste dos Cinco Pontos','Funções Executivas','Fluência não verbal, flexibilidade cognitiva, planejamento e monitoramento.'),
  ('Stroop (Victoria)','Funções Executivas','Controle inibitório, resistência à interferência e velocidade de processamento.'),
  ('MFFT-BR','Funções Executivas','Impulsividade cognitiva versus estilo reflexivo, precisão, latência e controle inibitório.'),
  ('Token Test','Linguagem','Compreensão auditiva verbal, processamento sintático e memória verbal de curto prazo.'),
  ('Nine Hole','Motricidade','Destreza manual fina e velocidade motora.'),
  ('NESPLORA Aula','Atenção','Atenção sustentada, seletiva, vigilância e controle inibitório em ambiente escolar simulado.'),
  ('NESPLORA Ice Cream','Funções Executivas','Planejamento, flexibilidade, memória de trabalho em ambiente ecológico de RV.'),
  ('NESPLORA Suit','Memória','Memória episódica verbal e visual, estratégias mnésicas em contexto ecológico.'),
  ('NESPLORA Aquarium','Atenção','Atenção sustentada, seletiva e dividida em ambiente virtual ecológico.'),
  ('Wisconsin (Nelson)','Funções Executivas','Formação de conceitos, flexibilidade cognitiva e sensibilidade ao feedback.'),
  ('IAR','Alfabetização','Aquisição de repertórios básicos importantes para aprendizagem.'),
  ('TIN','Linguagem','Acesso lexical expressivo, vocabulário e precisão de nomeação.'),
  ('Teste de Discriminação Fonológica','Linguagem','Percepção e diferenciação de contrastes fonêmicos.'),
  ('Teste de Repetição de Palavras e Pseudopalavras','Processamento fonológico','Processamento fonológico, memória fonológica e precisão articulatória.'),
  ('Prova de Consciência Fonológica por Produção Oral','Linguagem','Manipulação consciente dos sons da fala.'),
  ('Prova de Consciência Fonológica por Escolha de Figuras','Linguagem','Consciência fonológica com menor demanda expressiva.'),
  ('Prova de Consciência Sintática','Linguagem','Compreensão e manipulação de estruturas gramaticais.'),
  ('IPPL','Alfabetização','Precursores cognitivo-linguísticos do risco para dificuldades de leitura.'),
  ('PHCL','Alfabetização','Habilidades linguísticas e cognitivas relacionadas à alfabetização.'),
  ('PCL-R','Alfabetização','Linguagem oral, escrita, leitura e processos cognitivos associados.'),
  ('NOMEA','Linguagem','Acesso lexical rápido, flexibilidade cognitiva e alternância entre categorias.'),
  ('TENA','Linguagem','Velocidade de acesso lexical automático associada à fluência de leitura.'),
  ('PROADE','Desempenho escolar','Defasagens de aprendizagem em leitura, escrita, aritmética e linguagem oral.'),
  ('Anele 1 (LPI)','Leitura','Leitura de palavras isoladas e precisão lexical.'),
  ('Anele 2 (COMTEXT)','Leitura','Compreensão leitora de textos.'),
  ('Anele 4 (TLPP)','Leitura','Leitura de palavras e pseudopalavras (rotas lexical/fonológica).'),
  ('Anele 5 (AFLeT)','Leitura','Fluência e automatização da leitura de textos.'),
  ('TDE II - Leitura','Leitura','Precisão e compreensão de leitura escolar.'),
  ('Prolec','Leitura','Processos de leitura e rotas.'),
  ('Prolec-SE-R','Leitura','Processos lexical, sintático e semântico da leitura.'),
  ('Protocolo de Compreensão Leitora de Textos Expositivos','Leitura','Compreensão inferencial, literal e integrativa.'),
  ('BACOLE 2 (TCCL)','Leitura','Compreensão leitora por integração semântica e sintática.'),
  ('BACOLE 3 (TRP)','Leitura','Reconhecimento visual de palavras.'),
  ('TCLPP','Leitura','Competência de leitura silenciosa de palavras e pseudopalavras.'),
  ('TCCAL','Leitura','Compreensão auditiva e leitura de forma contrastiva.'),
  ('Prova de Escrita sob Ditado','Linguagem escrita','Ortografia, correspondência fonema-grafema e regras ortográficas.'),
  ('APET','Linguagem escrita','Produção escrita e aspectos ortográficos e linguísticos.'),
  ('Ditado Balanceado','Linguagem escrita','Padrões ortográficos regulares e irregulares.'),
  ('TDE II - Escrita','Linguagem escrita','Escrita de palavras e desempenho ortográfico escolar.'),
  ('TPAN - ProNumero','Matemática','Processamento numérico e compreensão de quantidades.'),
  ('TCAP - ProNumero','Matemática','Cálculo aritmético e estratégias operatórias.'),
  ('TTN - ProNumero','Matemática','Transcodificação numérica.'),
  ('Promat','Matemática','Habilidades matemáticas básicas e raciocínio aritmético.'),
  ('TDE II - Aritmética','Matemática','Cálculo e resolução de problemas matemáticos escolares.'),
  ('Prova de Aritmética','Matemática','Cálculo, raciocínio matemático e automatização.'),
  ('POP-TT','Motricidade','Coordenação, esquema corporal, lateralidade e integração motora.'),
  ('Avaliação Psicomotora','Motricidade','Coordenação, esquema corporal, lateralidade e integração motora.'),
  ('EDM','Motricidade','Desenvolvimento motor global e fino em crianças.'),
  ('SNAP-IV','Rastreio de Sintomas TDAH','Sintomas de desatenção, hiperatividade/impulsividade e oposição.'),
  ('ETDAH-CRIAD','Rastreio de Sintomas TDAH','Sintomas de TDAH e impacto funcional.'),
  ('ETDAH-Pais','Rastreio de Sintomas TDAH','Sintomas de TDAH e impacto funcional.'),
  ('ETDAH-II','Rastreio de Sintomas TDAH','Sintomas de TDAH no contexto escolar.'),
  ('SRS-2','Rastreio de Sintomas TEA','Traços associados ao espectro do autismo (cognição social).'),
  ('Coleção Binaut','Rastreio de Sintomas TEA','Aspectos cognitivos, emocionais e comportamentais em formato lúdico.'),
  ('TriC','Socioemocional','Indicadores de risco emocional e comportamental em crianças.'),
  ('EAG','Socioemocional','Frequência e intensidade de sintomas ansiosos persistentes.'),
  ('Escala EFA','Comportamento Adaptativo','Autonomia funcional na vida diária.'),
  ('TIAH/S','Rastreio de Sintomas AH/SD','Indicadores atencionais no contexto escolar.'),
  ('EAVAP','Metacognição e Aprendizagem','Estratégias cognitivas e metacognitivas de aprendizagem.'),
  ('EAME-IJ','Metacognição e Aprendizagem','Motivação intrínseca e extrínseca, interesse pelas atividades escolares.'),
  ('TMEC','Cognição social','Habilidades de mentalização (Teoria da Mente).')
) AS t(nome, dominio_nome, objetivo)
LEFT JOIN public.dominios_cognitivos d ON d.nome = t.dominio_nome;

-- ============== AVALIAÇÕES ==============
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES auth.users(id),
  titulo TEXT NOT NULL,
  queixa TEXT,
  hipoteses TEXT,
  status TEXT NOT NULL DEFAULT 'planejamento',
  data_inicio DATE,
  data_fim DATE,
  conclusao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage avaliacoes" ON public.avaliacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER avaliacoes_updated_at BEFORE UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_avaliacoes_paciente ON public.avaliacoes(paciente_id);

-- ============== BATERIA ITENS ==============
CREATE TABLE public.bateria_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  teste_id UUID NOT NULL REFERENCES public.testes_catalogo(id),
  status TEXT NOT NULL DEFAULT 'planejado',
  ordem INT NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bateria_itens TO authenticated;
GRANT ALL ON public.bateria_itens TO service_role;
ALTER TABLE public.bateria_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage bateria" ON public.bateria_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bateria_itens_updated_at BEFORE UPDATE ON public.bateria_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bateria_avaliacao ON public.bateria_itens(avaliacao_id);

-- ============== TESTES APLICADOS ==============
CREATE TABLE public.testes_aplicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  teste_id UUID NOT NULL REFERENCES public.testes_catalogo(id),
  data_aplicacao DATE,
  idade_aplicacao TEXT,
  escore_bruto NUMERIC,
  escore_padrao INT,
  percentil NUMERIC,
  classificacao TEXT,
  observacoes_qualitativas TEXT,
  aplicado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testes_aplicados TO authenticated;
GRANT ALL ON public.testes_aplicados TO service_role;
ALTER TABLE public.testes_aplicados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage testes_aplicados" ON public.testes_aplicados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER testes_aplicados_updated_at BEFORE UPDATE ON public.testes_aplicados FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_testes_aplicados_avaliacao ON public.testes_aplicados(avaliacao_id);

-- Trigger para classificar automaticamente
CREATE OR REPLACE FUNCTION public.set_classificacao_teste()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.percentil IS NOT NULL OR NEW.escore_padrao IS NOT NULL THEN
    NEW.classificacao := public.classificar_resultado(NEW.percentil, NEW.escore_padrao);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_classificar_teste BEFORE INSERT OR UPDATE ON public.testes_aplicados
  FOR EACH ROW EXECUTE FUNCTION public.set_classificacao_teste();

-- ============== DOCUMENTOS DE AVALIAÇÃO ==============
CREATE TABLE public.avaliacao_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho INT,
  tipo TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacao_documentos TO authenticated;
GRANT ALL ON public.avaliacao_documentos TO service_role;
ALTER TABLE public.avaliacao_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage avaliacao_docs" ON public.avaliacao_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER avaliacao_documentos_updated_at BEFORE UPDATE ON public.avaliacao_documentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== STORAGE POLICIES (prontuario-docs) ==============
CREATE POLICY "auth read prontuario-docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prontuario-docs');
CREATE POLICY "auth insert prontuario-docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prontuario-docs');
CREATE POLICY "auth update prontuario-docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prontuario-docs');
CREATE POLICY "auth delete prontuario-docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prontuario-docs');
