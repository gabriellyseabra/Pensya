-- =========================================================
-- Paciente modelo por clínica (tutorial vivo)
--
-- Toda clínica — nova ou já cadastrada — ganha uma paciente fictícia com a
-- ficha completa: responsáveis, anamnese, diagnóstico, plano terapêutico com
-- metas/GAS/estratégias, sessões de prontuário e atendimentos passados. Serve
-- de tutorial prático: a equipe explora todas as funcionalidades vendo dados
-- preenchidos, sem medo de mexer em paciente real. A clínica pode ocultar o
-- modelo da lista de pacientes quando não quiser mais vê-lo (preferência
-- reversível, por organização).
-- =========================================================

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS is_modelo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_pacientes_modelo ON public.pacientes (org_id) WHERE is_modelo;

ALTER TABLE public.organizacoes ADD COLUMN IF NOT EXISTS mostrar_paciente_modelo boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.seed_paciente_modelo(_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pac_id uuid;
  escola_id uuid;
  diag_id uuid;
  plano_id uuid;
  meta1_id uuid;
  meta2_id uuid;
  modalidade_id uuid;
  local_id uuid;
  status_presente_id uuid;
  atend_id uuid;
  i integer;
BEGIN
  IF _org_id IS NULL THEN RETURN; END IF;
  -- Idempotente: cada clínica tem no máximo um paciente modelo.
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE org_id = _org_id AND is_modelo) THEN
    RETURN;
  END IF;

  -- Referências de catálogo (padrões globais têm org_id NULL)
  SELECT id INTO modalidade_id FROM public.modalidades
    WHERE (org_id IS NULL OR org_id = _org_id) AND ativo
    ORDER BY (nome = 'Presencial') DESC, org_id NULLS LAST LIMIT 1;
  SELECT id INTO status_presente_id FROM public.status_frequencia
    WHERE (org_id IS NULL OR org_id = _org_id)
    ORDER BY (nome = 'Presente') DESC, org_id NULLS LAST LIMIT 1;
  SELECT id INTO local_id FROM public.locais
    WHERE org_id = _org_id AND ativo ORDER BY nome LIMIT 1;

  -- Escola de exemplo
  SELECT id INTO escola_id FROM public.escolas
    WHERE org_id = _org_id AND nome = 'Colégio Aurora (exemplo)' LIMIT 1;
  IF escola_id IS NULL THEN
    INSERT INTO public.escolas (org_id, nome, contato, telefone, email, endereco, observacoes, parceira)
    VALUES (_org_id, 'Colégio Aurora (exemplo)', 'Coord. Ana Paula', '(11) 97777-0001',
            'coordenacao@colegioaurora.exemplo', 'Rua dos Ipês, 450 — São Paulo/SP',
            'Escola fictícia criada junto com o paciente modelo.', true)
    RETURNING id INTO escola_id;
  END IF;

  -- Diagnóstico de exemplo (reaproveita se a clínica já tem TDAH no catálogo)
  SELECT id INTO diag_id FROM public.diagnosticos
    WHERE (org_id IS NULL OR org_id = _org_id) AND nome ILIKE '%TDAH%' LIMIT 1;
  IF diag_id IS NULL THEN
    INSERT INTO public.diagnosticos (org_id, codigo, nome, descricao, ativo)
    VALUES (_org_id, 'F90.0', 'TDAH — Transtorno de Déficit de Atenção/Hiperatividade',
            'Padrão persistente de desatenção e/ou hiperatividade-impulsividade que interfere no funcionamento e desenvolvimento.', true)
    RETURNING id INTO diag_id;
  END IF;

  -- ================= Paciente =================
  INSERT INTO public.pacientes (
    org_id, is_modelo, nome, data_nascimento, genero, telefone, email, endereco,
    escola_id, modalidade_id, status, escolaridade, serie_curso, contato_escola,
    autoriza_imagem, hipotese_diagnostica, queixa_principal, expectativas,
    modelo_pagamento, valor_acordado, dia_vencimento, origem_criacao, observacoes
  ) VALUES (
    _org_id, true, 'Sofia (Paciente Modelo)', DATE '2017-03-10', 'Feminino',
    '(11) 98888-0001', 'familia.sofia@exemplo.com', 'Rua das Flores, 123 — São Paulo/SP',
    escola_id, modalidade_id, 'ativo', 'Ensino Fundamental I', '2º ano',
    'Coord. Ana Paula — (11) 97777-0001', true, true,
    'Dificuldade de leitura e escrita para a idade, desatenção em sala de aula e resistência às lições de casa.',
    'Família espera que Sofia acompanhe a turma na leitura e ganhe autonomia nas tarefas escolares.',
    'mensalidade', 850.00, 10, 'manual',
    'PACIENTE FICTÍCIA — criada automaticamente pelo Pensya como modelo de tutorial. Explore a ficha, o prontuário e o plano à vontade: nada aqui é dado real.'
  ) RETURNING id INTO pac_id;

  -- ================= Responsáveis =================
  INSERT INTO public.responsaveis (org_id, paciente_id, nome, parentesco, telefone, email, principal) VALUES
    (_org_id, pac_id, 'Mariana Silva (exemplo)', 'Mãe', '(11) 98888-0001', 'mariana.silva@exemplo.com', true),
    (_org_id, pac_id, 'Carlos Silva (exemplo)', 'Pai', '(11) 98888-0002', 'carlos.silva@exemplo.com', false);

  -- ================= Diagnóstico do paciente =================
  INSERT INTO public.paciente_diagnosticos (org_id, paciente_id, diagnostico_id, data_diagnostico, observacoes)
  VALUES (_org_id, pac_id, diag_id, CURRENT_DATE - 120,
          'Hipótese diagnóstica levantada pela neuropediatra; acompanhamento em curso.')
  ON CONFLICT DO NOTHING;

  -- ================= Pré-anamnese =================
  INSERT INTO public.paciente_pre_anamnese (
    org_id, paciente_id, contexto_familiar, gestacao, parto, saude,
    tratamentos_anteriores, outros_especialistas, exames_clinicos
  ) VALUES (
    _org_id, pac_id,
    jsonb_build_object(
      'mora_com', 'Mãe, pai e irmão mais novo (3 anos)',
      'rotina', 'Escola pela manhã; à tarde fica com a avó materna',
      'relacionamento_familiar', 'Bom vínculo com os pais; ciúmes do irmão em momentos de tarefa',
      'tela_por_dia', '1 a 2 horas'
    ),
    jsonb_build_object(
      'gestacao_planejada', 'Sim',
      'pre_natal', 'Completo',
      'intercorrencias_gestacao', jsonb_build_array('Nenhuma')
    ),
    jsonb_build_object(
      'tipo_parto', 'Cesárea',
      'idade_gestacional', '39 semanas',
      'intercorrencias_parto', jsonb_build_array('Nenhuma')
    ),
    jsonb_build_object(
      'sono', 'Dorme bem, cerca de 9h por noite',
      'alimentacao', 'Seletividade leve (evita verduras)',
      'medicacao_atual', 'Nenhuma',
      'alergias', 'Nenhuma conhecida',
      'audicao', 'Sem queixas',
      'visao', 'Usa óculos para leitura desde 2025'
    ),
    jsonb_build_object(
      'tratamentos_anteriores', jsonb_build_array('Fonoaudiologia'),
      'detalhes', 'Fonoaudiologia por 6 meses em 2025, com alta'
    ),
    jsonb_build_object(
      'neuropediatra', 'Dra. Beatriz Rocha (exemplo) — consulta semestral',
      'oftalmologista', 'Dr. Renato Lima (exemplo)'
    ),
    jsonb_build_object(
      'exames', 'Audiometria (2025): normal. Processamento auditivo central: dentro do esperado.'
    )
  );

  -- ================= Plano terapêutico =================
  INSERT INTO public.planos_terapeuticos (
    org_id, paciente_id, titulo, ciclo_semanas, data_inicio, data_revisao_prevista, status,
    queixa_principal, diagnostico_resumo, medicacao, frequencia_sessoes,
    cif_funcoes, cif_funcoes_impacto, cif_atividades, cif_atividades_impacto,
    cif_participacao, cif_participacao_impacto, cif_ambientais, cif_pessoais,
    objetivo_participacao, orientacoes_familia, orientacoes_escola, aprovado_em
  ) VALUES (
    _org_id, pac_id, 'Plano Terapêutico — Ciclo 1', 12, CURRENT_DATE - 45, CURRENT_DATE + 39, 'ativo',
    'Dificuldade de leitura e escrita para a idade e desatenção em sala.',
    'Hipótese de TDAH (apresentação desatenta) com defasagem em consciência fonológica.',
    'Sem medicação no momento.',
    '2 sessões semanais de 50 minutos',
    'Atenção sustentada, memória de trabalho, consciência fonológica',
    'Perde instruções longas; troca letras com sons próximos (p/b, t/d)',
    'Leitura de palavras e pseudopalavras, escrita espontânea, cópia',
    'Lê com apoio silabado; escrita com trocas fonológicas frequentes',
    'Participação nas atividades coletivas de sala e lições de casa',
    'Evita ler em voz alta; depende de adulto para iniciar e concluir tarefas',
    'Família engajada; escola parceira aberta a adaptações; avó apoia no contraturno',
    'Boa vinculação afetiva, gosta de jogos e desenhos, sensível a frustração',
    'Ler textos curtos com autonomia e participar das atividades de leitura da turma até o fim do ciclo.',
    'Ler junto 10 minutos por dia em material do interesse dela; validar o esforço antes de corrigir; manter rotina visual das tarefas.',
    'Sentar próxima à professora; instruções curtas e segmentadas; tempo estendido em atividades de escrita; avisar a família sobre lições com antecedência.',
    now()
  ) RETURNING id INTO plano_id;

  INSERT INTO public.plano_metas (org_id, plano_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa)
  VALUES (
    _org_id, plano_id, 1, 'Leitura e escrita',
    'Ler textos de 4 a 6 linhas com no máximo 3 apoios do adulto, em 8 de 10 tentativas, até o fim do ciclo de 12 semanas.',
    'Hoje lê palavras isoladas de forma silabada e pede apoio a cada frase.',
    12,
    'A consciência fonológica é a base da defasagem observada; leitura autônoma é a maior demanda da família e da escola.'
  ) RETURNING id INTO meta1_id;

  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, meta1_id, -2, 'Lê apenas palavras isoladas, com apoio constante'),
    (_org_id, meta1_id, -1, 'Lê frases curtas com apoio em mais da metade das palavras'),
    (_org_id, meta1_id,  0, 'Lê textos de 4 a 6 linhas com até 3 apoios (meta)'),
    (_org_id, meta1_id,  1, 'Lê textos de 4 a 6 linhas sem apoio'),
    (_org_id, meta1_id,  2, 'Lê textos de mais de 6 linhas sem apoio e com boa compreensão');

  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, meta1_id, 1, 'Instrução fônica sistemática',
     'Evidência forte para dificuldades de decodificação.',
     'Sequência estruturada de correspondências grafema-fonema, 15 min por sessão, com jogos de síntese e segmentação.'),
    (_org_id, meta1_id, 2, 'Leitura repetida com modelagem',
     'Melhora fluência e autoconfiança do leitor iniciante.',
     'Terapeuta lê o trecho, leem juntas, depois Sofia lê sozinha o mesmo trecho; registrar tempo e apoios.');

  INSERT INTO public.plano_metas (org_id, plano_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa)
  VALUES (
    _org_id, plano_id, 2, 'Atenção e funções executivas',
    'Iniciar e concluir uma atividade de 15 minutos com no máximo 1 lembrete do adulto, em 4 de 5 sessões, até o fim do ciclo.',
    'Hoje precisa de 3 a 4 lembretes para permanecer na tarefa.',
    12,
    'A autonomia na tarefa sustenta o ganho acadêmico e reduz o desgaste nas lições de casa.'
  ) RETURNING id INTO meta2_id;

  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, meta2_id, -2, 'Precisa de mais de 4 lembretes; abandona a atividade'),
    (_org_id, meta2_id, -1, 'Conclui com 2 a 3 lembretes'),
    (_org_id, meta2_id,  0, 'Conclui com no máximo 1 lembrete (meta)'),
    (_org_id, meta2_id,  1, 'Conclui sem lembretes com autoinstrução verbal'),
    (_org_id, meta2_id,  2, 'Conclui sem lembretes e planeja sozinha os passos da atividade');

  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, meta2_id, 1, 'Rotina visual com autoinstrução',
     'Apoio externo de planejamento reduz a carga executiva.',
     'Quadro com 3 passos ilustrados da atividade; Sofia verbaliza cada passo antes de executar e marca ao concluir.');

  -- ============ Atendimentos passados + sessões de prontuário ============
  -- Três semanas de histórico: agenda com presença registrada e a evolução
  -- correspondente no prontuário (tudo no passado, para não poluir a agenda).
  FOR i IN 1..3 LOOP
    INSERT INTO public.atendimentos (
      org_id, paciente_id, local_id, modalidade_id, status_frequencia_id,
      inicio, fim, observacoes
    ) VALUES (
      _org_id, pac_id, local_id, modalidade_id, status_presente_id,
      date_trunc('day', now()) - make_interval(days => 7 * (4 - i)) + interval '14 hours',
      date_trunc('day', now()) - make_interval(days => 7 * (4 - i)) + interval '14 hours 50 minutes',
      'Atendimento de exemplo (paciente modelo).'
    ) RETURNING id INTO atend_id;

    INSERT INTO public.prontuario_sessoes (
      org_id, paciente_id, atendimento_id, data_sessao, hora_inicio, duracao_min,
      engajamento, nivel_suporte, recursos_utilizados, evolucao, observacoes,
      orientacao_casa, orientacao_texto
    ) VALUES (
      _org_id, pac_id, atend_id,
      (date_trunc('day', now()) - make_interval(days => 7 * (4 - i)))::date,
      time '14:00', 50,
      CASE i WHEN 1 THEN 3 WHEN 2 THEN 4 ELSE 4 END,
      CASE i WHEN 1 THEN 'Moderado' WHEN 2 THEN 'Moderado' ELSE 'Leve' END,
      CASE i
        WHEN 1 THEN ARRAY['Jogo de rimas', 'Alfabeto móvel']
        WHEN 2 THEN ARRAY['Alfabeto móvel', 'Texto adaptado curto']
        ELSE ARRAY['Texto adaptado curto', 'Quadro de rotina visual']
      END,
      CASE i
        WHEN 1 THEN 'Sessão de vínculo e sondagem: Sofia identificou rimas com apoio e segmentou palavras dissílabas. Trocas p/b presentes na escrita espontânea. Aceitou bem a rotina da sessão.'
        WHEN 2 THEN 'Trabalho de correspondência grafema-fonema (p, b, t, d) com alfabeto móvel: acertou 7 de 10 sínteses. Leu 2 frases curtas com apoio em metade das palavras. Pediu para levar o jogo para casa.'
        ELSE 'Leitura repetida de texto de 4 linhas: no terceiro ciclo, leu com apenas 2 apoios. Usou o quadro de rotina e concluiu a atividade com 1 lembrete. Comemorou o próprio progresso.'
      END,
      CASE i WHEN 3 THEN 'Próxima sessão: introduzir escrita de frases com as correspondências trabalhadas.' ELSE NULL END,
      i = 3,
      CASE i WHEN 3 THEN 'Ler junto o mini-livro enviado (10 min por dia) e marcar no quadro cada leitura concluída.' ELSE NULL END
    );
  END LOOP;
END $$;

-- Nova clínica já nasce com catálogos e com o paciente modelo.
CREATE OR REPLACE FUNCTION public.criar_organizacao(_nome text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  novo_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado';
  END IF;
  IF public.my_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Você já pertence a uma organização';
  END IF;
  IF _nome IS NULL OR length(trim(_nome)) = 0 THEN
    RAISE EXCEPTION 'Informe o nome da clínica';
  END IF;

  INSERT INTO public.organizacoes (nome) VALUES (trim(_nome)) RETURNING id INTO novo_org_id;
  INSERT INTO public.organizacao_membros (org_id, user_id, papel) VALUES (novo_org_id, auth.uid(), 'admin');
  PERFORM public.seed_catalogos_padrao(novo_org_id);
  PERFORM public.seed_paciente_modelo(novo_org_id);
  RETURN novo_org_id;
END;
$$;

-- Mostrar/ocultar o paciente modelo na lista (preferência da clínica,
-- reversível — qualquer membro ativo pode alternar).
CREATE OR REPLACE FUNCTION public.definir_paciente_modelo_visivel(_visivel boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.my_org_id() IS NULL THEN
    RAISE EXCEPTION 'Você não pertence a uma organização';
  END IF;
  UPDATE public.organizacoes
    SET mostrar_paciente_modelo = COALESCE(_visivel, true)
  WHERE id = public.my_org_id();
END;
$$;
GRANT EXECUTE ON FUNCTION public.definir_paciente_modelo_visivel(boolean) TO authenticated;

-- Backfill: clínicas já cadastradas também ganham o paciente modelo.
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM public.organizacoes LOOP
    PERFORM public.seed_paciente_modelo(o.id);
  END LOOP;
END $$;
