-- =========================================================
-- Paciente modelo v2 — Sofia completa de ponta a ponta
--
-- Feedback do uso real: a Sofia precisa demonstrar TODAS as áreas
-- preenchidas. Esta versão adiciona: anamnese estruturada completa
-- (formulário inteligente + radar), avaliação concluída com resultados
-- de testes do catálogo, 4 metas terapêuticas FUNCIONAIS (sem estrutura
-- SMART no título — métrica e prazo ficam nos campos próprios), sessões
-- vinculadas às metas (sessao_metas com GAS observado), perfil clínico
-- vivo e CIF preenchidos.
--
-- As Sofias já criadas são recriadas com o conteúdo novo (dados fictícios,
-- sem valor clínico — a recriação é segura).
-- =========================================================

CREATE OR REPLACE FUNCTION public.seed_paciente_modelo(_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pac_id uuid;
  escola_id uuid;
  diag_id uuid;
  plano_id uuid;
  aval_id uuid;
  mt1 uuid; mt2 uuid; mt3 uuid; mt4 uuid;
  pm1 uuid; pm2 uuid; pm3 uuid; pm4 uuid;
  modalidade_id uuid;
  local_id uuid;
  status_presente_id uuid;
  atend_id uuid;
  sessao_id uuid;
  tid uuid;
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

  -- ================= Paciente (com perfil clínico vivo) =================
  INSERT INTO public.pacientes (
    org_id, is_modelo, nome, data_nascimento, genero, telefone, email, endereco,
    escola_id, modalidade_id, status, escolaridade, serie_curso, contato_escola,
    autoriza_imagem, hipotese_diagnostica, queixa_principal, expectativas,
    modelo_pagamento, valor_acordado, dia_vencimento, origem_criacao, data_inicio,
    observacoes, perfil_vivo
  ) VALUES (
    _org_id, true, 'Sofia (Paciente Modelo)', DATE '2017-03-10', 'Feminino',
    '(11) 98888-0001', 'familia.sofia@exemplo.com', 'Rua das Flores, 123 — São Paulo/SP',
    escola_id, modalidade_id, 'ativo', 'Ensino Fundamental I', '2º ano',
    'Coord. Ana Paula — (11) 97777-0001', true, true,
    'Dificuldade de leitura e escrita para a idade, desatenção em sala de aula e resistência às lições de casa.',
    'Família espera que Sofia acompanhe a turma na leitura e ganhe autonomia nas tarefas escolares.',
    'mensalidade', 850.00, 10, 'manual', CURRENT_DATE - 90,
    'PACIENTE FICTÍCIA — criada automaticamente pelo Pensya como modelo de tutorial. Explore a ficha, o prontuário e o plano à vontade: nada aqui é dado real.',
    jsonb_build_object(
      'reforcadores', jsonb_build_array(
        jsonb_build_object('descricao', 'Elogio específico ao esforço', 'intensidade', 'alta'),
        jsonb_build_object('descricao', 'Adesivos no quadro de conquistas', 'intensidade', 'media'),
        jsonb_build_object('descricao', 'Jogos de tabuleiro', 'intensidade', 'alta')
      ),
      'barreiras', jsonb_build_array(
        jsonb_build_object('descricao', 'Tarefas longas sem pausas'),
        jsonb_build_object('descricao', 'Exposição diante da turma (ler em voz alta)')
      ),
      'interesses', jsonb_build_array('Animais', 'Desenho', 'Histórias de aventura'),
      'preferencias', jsonb_build_array('Instruções curtas', 'Ambiente silencioso', 'Saber o que vem a seguir'),
      'potencializadores', jsonb_build_array('Rotina visual', 'Modelagem antes da tarefa', 'Pausas programadas'),
      'estrategias_funcionam', jsonb_build_array(
        'Leitura compartilhada antes da leitura independente',
        'Autoinstrução verbal ("primeiro eu…, depois eu…")',
        'Reforço imediato ao comportamento-alvo'
      ),
      'estrategias_nao_funcionam', jsonb_build_array(
        'Correção pública do erro',
        'Tarefas com tempo cronometrado'
      ),
      'objetivos_generalizacao', jsonb_build_array(
        'Ler enunciados de prova sem mediação',
        'Fazer a lição de casa com no máximo um lembrete'
      ),
      'hipoteses_ativas', jsonb_build_array(
        'Trocas p/b e t/d diminuem com pistas articulatórias',
        'Autonomia melhora quando ela mesma marca o quadro de rotina'
      ),
      'contexto_social', jsonb_build_object(
        'rotina', 'Escola pela manhã; avó materna à tarde; tarefas após o lanche',
        'suporte_familiar', 'Família engajada; mãe acompanha as tarefas diariamente',
        'ambiente_social', 'Boa interação com pares; convida amigas para casa',
        'observacoes', 'Irmão de 3 anos; ciúmes pontual nos momentos de tarefa'
      ),
      'contexto_escolar_detalhes', jsonb_build_object(
        'ambiente', 'Turma de 24 alunos; senta na primeira fileira',
        'suporte_pedagogico', 'Professora parceira; tempo estendido em avaliações',
        'dificuldades', 'Cópia lenta do quadro; evita leitura em voz alta',
        'observacoes', 'Escola aberta a adaptações; reunião trimestral combinada'
      ),
      'contexto_clinico', jsonb_build_object(
        'medicacoes', 'Nenhuma',
        'comorbidades', 'Hipótese de TDAH (apresentação desatenta) em investigação',
        'profissionais', 'Neuropediatra Dra. Beatriz Rocha (exemplo) — consulta semestral',
        'observacoes', 'Alta da fonoaudiologia em 2025'
      ),
      'observacoes_gerais', 'Perfil fictício do paciente modelo — use como referência de preenchimento.',
      'perfil_cif', jsonb_build_object(
        'funcoes_corporais', 'b140 Atenção (dificuldade moderada em atenção sustentada); b144 Memória (memória de trabalho no limite inferior); b167 Funções da linguagem (consciência fonológica em defasagem)',
        'estruturas_corporais', 'Sem alterações identificadas',
        'atividade_participacao', 'd140 Aprender a ler e d145 Aprender a escrever — limitação moderada; d166 Ler — precisa de apoio; participação reduzida nas atividades coletivas de leitura',
        'fatores_ambientais', 'e310 Família imediata (facilitador +3); e355 Profissionais de saúde (facilitador); escola parceira com adaptações (facilitador)',
        'fatores_pessoais', 'Criativa, afetuosa, sensível ao erro; responde muito bem a reforço positivo e rotina previsível'
      ),
      'atualizado_em', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  ) RETURNING id INTO pac_id;

  -- ================= Responsáveis =================
  INSERT INTO public.responsaveis (org_id, paciente_id, nome, parentesco, telefone, email, principal, profissao) VALUES
    (_org_id, pac_id, 'Mariana Silva (exemplo)', 'Mãe', '(11) 98888-0001', 'mariana.silva@exemplo.com', true, 'Professora'),
    (_org_id, pac_id, 'Carlos Silva (exemplo)', 'Pai', '(11) 98888-0002', 'carlos.silva@exemplo.com', false, 'Analista de sistemas');

  -- ================= Diagnóstico do paciente =================
  INSERT INTO public.paciente_diagnosticos (org_id, paciente_id, diagnostico_id, data_diagnostico, observacoes)
  VALUES (_org_id, pac_id, diag_id, CURRENT_DATE - 120,
          'Hipótese diagnóstica levantada pela neuropediatra; acompanhamento em curso.')
  ON CONFLICT DO NOTHING;

  -- ================= Anamnese completa (formulário inteligente) =================
  INSERT INTO public.paciente_pre_anamnese (
    org_id, paciente_id, contexto_familiar, gestacao, parto, saude,
    tratamentos_anteriores, outros_especialistas, exames_clinicos,
    secoes_estruturadas, resumos_secao, radar_scores, insights_validados,
    campos_importados, modo_entrada, concluida_em
  ) VALUES (
    _org_id, pac_id,
    -- Blocos legados (aba Cadastro)
    jsonb_build_object(
      'mora_com', 'Mãe, pai e irmão mais novo (3 anos)',
      'rotina', 'Escola pela manhã; à tarde fica com a avó materna',
      'relacionamento_familiar', 'Bom vínculo com os pais; ciúmes do irmão em momentos de tarefa',
      'tela_por_dia', '1 a 2 horas'
    ),
    jsonb_build_object('gestacao_planejada', 'Sim', 'pre_natal', 'Completo', 'intercorrencias_gestacao', jsonb_build_array('Nenhuma')),
    jsonb_build_object('tipo_parto', 'Cesárea', 'idade_gestacional', '39 semanas', 'intercorrencias_parto', jsonb_build_array('Nenhuma')),
    jsonb_build_object(
      'sono', 'Dorme bem, cerca de 9h por noite',
      'alimentacao', 'Seletividade leve (evita verduras)',
      'medicacao_atual', 'Nenhuma', 'alergias', 'Nenhuma conhecida',
      'audicao', 'Sem queixas', 'visao', 'Usa óculos para leitura desde 2025'
    ),
    jsonb_build_object('tratamentos_anteriores', jsonb_build_array('Fonoaudiologia'), 'detalhes', 'Fonoaudiologia por 6 meses em 2025, com alta'),
    jsonb_build_object('neuropediatra', 'Dra. Beatriz Rocha (exemplo) — consulta semestral', 'oftalmologista', 'Dr. Renato Lima (exemplo)'),
    jsonb_build_object('exames', 'Audiometria (2025): normal. Processamento auditivo central: dentro do esperado.'),
    -- Anamnese estruturada (todas as seções do formulário inteligente)
    jsonb_build_object(
      'identificacao', jsonb_build_object(
        'nome_completo', 'Sofia Silva (exemplo)', 'lateralidade', 'Destra', 'naturalidade', 'São Paulo/SP'
      ),
      'queixa_principal', jsonb_build_object(
        'queixa', 'Dificuldade de leitura e escrita para a idade, desatenção em sala e resistência às lições de casa.',
        'tempo_evolucao', 'Desde o 1º ano do Ensino Fundamental',
        'quem_identificou', jsonb_build_array('Escola', 'Família'),
        'ambientes', jsonb_build_array('Escola', 'Casa'),
        'frequencia', 'Todos os dias',
        'situacoes_melhora', jsonb_build_array('Apoio individual', 'Rotina previsível', 'Reforço positivo'),
        'situacoes_piora', jsonb_build_array('Cansaço', 'Tarefas escolares', 'Barulho'),
        'regressao', false,
        'expectativas', 'Que Sofia acompanhe a turma na leitura e ganhe autonomia nas tarefas.'
      ),
      'contexto_familiar', jsonb_build_object(
        'configuracao', 'Nuclear',
        'estrutura_familiar', 'Mora com mãe, pai e irmão de 3 anos; avó materna apoia no contraturno.',
        'irmaos', 1, 'rede_apoio', 8, 'rotina_estruturada', 'Sim',
        'relacao_responsaveis', 'Tranquila',
        'quem_acompanha_tarefas', jsonb_build_array('Mãe'),
        'lida_com_comportamento', jsonb_build_array('Conversa', 'Busca acolher'),
        'historico_familiar', jsonb_build_array('TDAH', 'Dificuldade de aprendizagem'),
        'situacao_marcante', false,
        'mudancas_recentes', jsonb_build_array('Nascimento de irmão'),
        'preocupacoes', 'Leitura abaixo do esperado e sofrimento diante do erro.'
      ),
      'gestacao', jsonb_build_object(
        'tipo_gravidez', 'Planejada', 'gestacao_planejada', 'Sim', 'pre_natal', 'Sim',
        'intercorrencias_gestacao', jsonb_build_array('Nenhuma'),
        'tipo_parto', 'Cesárea', 'intercorrencias_parto', jsonb_build_array('Nenhuma'),
        'prematuro', 'Não', 'idade_gestacional', 39, 'peso_nascimento', 3.2,
        'comprimento_nascimento', 49, 'apgar', '9/10'
      ),
      'desenvolvimento', jsonb_build_object(
        'sustentou_cabeca', '3 meses', 'sentou', '6 meses', 'andou', '13 meses', 'marcos_atrasados', false
      ),
      'linguagem', jsonb_build_object(
        'primeiras_palavras', '12 meses', 'frases', '24 meses',
        'compreensao', 'Adequada', 'expressao', 'Adequada',
        'compreende_figurado', true, 'mantem_conversa', true,
        'instrucoes_simples', true, 'instrucoes_etapas', false,
        'intencao_comunicativa', true, 'dificuldade_nomear', false,
        'conta_acontecimentos', true, 'alteracoes', 'Nenhuma'
      ),
      'motor', jsonb_build_object(
        'coordenacao_global', 'Adequada', 'coordenacao_fina', 'Leve imaturidade no traçado',
        'equilibrio', 'Adequado', 'dificuldades', 'Preensão do lápis em ajuste'
      ),
      'sensorial', jsonb_build_object(
        'auditivo', 'Sem alterações relevantes', 'visual', 'Usa óculos para leitura', 'tato', 'Sem alterações',
        'interesses_restritos', false, 'sensibilidade_luz', false, 'incomodo_roupas', false,
        'evita_texturas', false, 'busca_sensorial', false, 'dificuldade_mudanca_rotina', false,
        'reacao_mudanca', 'Adapta-se com aviso prévio', 'sensibilidade_sons', false, 'movimentos_repetitivos', false
      ),
      'alimentacao', jsonb_build_object(
        'perfil', 'Boa aceitação geral', 'seletividade', 'Leve (evita verduras)',
        'recusa_alimentos', false, 'dificuldade_textura', false, 'aceita_novos', true,
        'autonomia_alimentar', 'Independente', 'engasgos', false
      ),
      'saude', jsonb_build_object(
        'condicoes', jsonb_build_array('Nenhuma'), 'medicacoes', 'Nenhuma', 'alergias', 'Nenhuma',
        'visao', 'Usa óculos para leitura desde 2025', 'audicao', 'Normal',
        'sono', 'Dorme bem, cerca de 9h por noite', 'rotina_sono', 'Regular',
        'acorda_descansada', true, 'sonolencia_diurna', false, 'convulsoes', false,
        'dores_frequentes', false, 'avaliacoes_realizadas', jsonb_build_array('Audiometria'),
        'controle_esfincteres', 'Adequado'
      ),
      'historico_clinico', jsonb_build_object(
        'tratamentos_anteriores', jsonb_build_array('Fonoaudiologia'),
        'diagnosticos_previos', 'Hipótese de TDAH (apresentação desatenta) em investigação',
        'exames', 'Audiometria (2025): normal. Processamento auditivo central: dentro do esperado.',
        'medicacao_psiquiatrica', 'Não'
      ),
      'escolar', jsonb_build_object(
        'escola_atual', 'Colégio Aurora (exemplo)', 'serie', '2º ano', 'tipo', 'Particular',
        'adaptacao', 'Boa', 'repetiu_ano', false, 'recebe_apoio', true, 'frequencia_regular', true,
        'participacao', 'Participa com incentivo', 'copia_quadro', 'Com lentidão',
        'acompanha_ritmo', false,
        'dificuldades_evidentes', jsonb_build_array('Leitura', 'Escrita', 'Atenção'),
        'resistencia_tarefas', true, 'reacao_erro', 'Frustra-se e tende a desistir',
        'adaptacoes_escola', 'Senta na primeira fileira; tempo estendido em avaliações',
        'tem_laudo_pei', false, 'queixas_escola', 'Desatenção e lentidão na cópia do quadro'
      ),
      'aprendizagem', jsonb_build_object(
        'leitura', 'Silabada, com apoio do adulto',
        'escrita', 'Trocas fonológicas frequentes (p/b, t/d, f/v)',
        'matematica', 'Adequada para a idade',
        'interesse', 'Gosta de ouvir histórias e de desenhar',
        'estrategias_que_funcionam', 'Apoio visual, instruções curtas, reforço positivo'
      ),
      'comportamento', jsonb_build_object(
        'humor', 'Estável', 'frustacao', 'Baixa tolerância diante do erro',
        'autorregulacao', 'Precisa de apoio do adulto', 'inicia_tarefa', false,
        'termina_tarefa', false, 'distrai_facil', true, 'espera_vez', true,
        'explosoes', false, 'perde_objetos', true, 'impulsividade', false,
        'dificuldade_organizacao', true,
        'durante_crise', 'Chora e se recusa a continuar a atividade',
        'ajuda_acalmar', 'Pausa breve, acolhimento e retomada com apoio'
      ),
      'rotina', jsonb_build_object(
        'estrutura_diaria', 'Escola pela manhã; avó à tarde; tarefas após o lanche',
        'tempo_tela', '1 a 2 horas', 'quais_telas', jsonb_build_array('TV', 'Tablet'),
        'tela_interfere', false, 'irritacao_parar_tela', false,
        'atividade_fisica', 'Natação 1x por semana', 'atividades_extras', 'Natação'
      ),
      'autonomia', jsonb_build_object(
        'higiene', 'Independente', 'vestir_se', 'Independente',
        'alimentar_se', 'Independente', 'tarefas_casa', 'Ajuda com lembretes'
      ),
      'social', jsonb_build_object(
        'contato_visual', true, 'amigos', true, 'brincadeira', 'Compartilhada',
        'iniciativa', true, 'compartilha_conquistas', true, 'faz_de_conta', true,
        'compartilha_brinquedos', true, 'entende_regras', true,
        'prefere_brincar', 'Com outras crianças', 'repeticao_comandos', false
      ),
      'interesses', jsonb_build_object(
        'interesses', jsonb_build_array('Desenho', 'Histórias', 'Animais'),
        'reforcadores', jsonb_build_array('Elogio', 'Adesivos', 'Jogos'),
        'aversoes', jsonb_build_array('Ler em voz alta para a turma')
      ),
      'sintese_responsaveis', jsonb_build_object(
        'potencialidades', 'Criativa, afetuosa e esforçada quando se sente segura',
        'faz_bem', 'Desenho, natação e brincadeiras simbólicas',
        'mais_preocupa', 'A leitura e a autoestima diante do erro',
        'nao_perguntado', 'Nada a acrescentar'
      ),
      'observacoes_gerais', jsonb_build_object(
        'observacoes', 'Anamnese fictícia do paciente modelo do Pensya, preenchida para demonstrar o formulário completo.'
      )
    ),
    -- Resumos por seção
    jsonb_build_object(
      'queixa_principal', 'Queixa central de leitura e escrita abaixo do esperado para o 2º ano, com desatenção em sala e resistência às tarefas. Dificuldades diárias, mais evidentes em contexto escolar, atenuadas por apoio individual e rotina previsível.',
      'contexto_familiar', 'Família nuclear engajada, rotina estruturada e rede de apoio forte (avó no contraturno). Histórico familiar de TDAH e dificuldade de aprendizagem. Nascimento recente de irmão, sem repercussão importante.',
      'gestacao', 'Gestação planejada com pré-natal completo, parto cesáreo a termo (39 semanas), sem intercorrências. Apgar 9/10.',
      'desenvolvimento', 'Marcos motores e de linguagem dentro do esperado. Compreensão e expressão adequadas; dificuldade apenas em instruções longas de múltiplas etapas.',
      'escolar', 'Cursa o 2º ano com boa adaptação social, mas não acompanha o ritmo da turma em leitura e escrita. Escola parceira, com adaptações combinadas (assento à frente, tempo estendido). Cópia do quadro lenta.',
      'aprendizagem', 'Leitura silabada dependente de apoio; escrita com trocas fonológicas frequentes (p/b, t/d, f/v). Matemática preservada. Responde bem a apoio visual e instruções curtas.',
      'comportamento', 'Humor estável e boa socialização. Baixa tolerância à frustração diante do erro, dificuldade para iniciar e concluir tarefas e distração fácil — perfil compatível com a hipótese de TDAH desatento.',
      'saude', 'Saudável, sem medicação. Sono e alimentação adequados. Usa óculos para leitura. Audiometria normal.'
    ),
    -- Radar (0-10; menor = mais atenção)
    jsonb_build_object(
      'contexto_familiar', 8, 'gestacao', 9, 'desenvolvimento', 7,
      'escolar', 4, 'comportamento', 6, 'rotina', 8
    ),
    '{}'::jsonb, '{}'::jsonb, 'formulario', now() - interval '60 days'
  );

  -- ================= Avaliação concluída com resultados de testes =================
  INSERT INTO public.avaliacoes (org_id, paciente_id, titulo, queixa, hipoteses, status, data_inicio, data_fim, conclusao)
  VALUES (
    _org_id, pac_id, 'Avaliação psicopedagógica inicial',
    'Dificuldade de leitura e escrita para a idade e desatenção em sala.',
    'Hipótese de TDAH (apresentação desatenta) com defasagem em consciência fonológica.',
    'concluida', CURRENT_DATE - 100, CURRENT_DATE - 60,
    'O perfil indica defasagem significativa em leitura e escrita (TDE II e Ditado Balanceado abaixo do esperado), com atenção seletiva no limite inferior e memória de trabalho visuoespacial preservada (Cubos de Corsi na média). O padrão de erros na escrita é predominantemente fonológico (trocas de surdas/sonoras). Recomenda-se intervenção psicopedagógica 2x/semana com ênfase em consciência fonológica e instrução fônica sistemática, apoio de rotina visual para funções executivas e acompanhamento da hipótese de TDAH com a neuropediatra.'
  ) RETURNING id INTO aval_id;

  -- Resultados (testes do catálogo global; classificação preenchida por trigger)
  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'TDE II - Leitura' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 1);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 80, '9 anos e 1 mês', 14, 10,
      'Leitura silabada, com autocorreções frequentes. Melhor desempenho em palavras regulares curtas; pseudopalavras com muitos erros.',
      'Desempenho inferior ao esperado para a escolaridade, compatível com defasagem no reconhecimento de palavras por rota fonológica.');
  END IF;

  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'TDE II - Escrita' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 2);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 80, '9 anos e 1 mês', 9, 8,
      'Trocas de surdas/sonoras (p/b, t/d, f/v) na maioria das palavras com esses fonemas. Traçado legível, preensão em ajuste.',
      'Padrão de erros predominantemente fonológico, coerente com a defasagem em consciência fonológica observada na leitura.');
  END IF;

  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'Ditado Balanceado' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 3);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 73, '9 anos e 1 mês', 21, 12,
      'Erros concentrados em correspondências irregulares e dígrafos; desempenho melhor em palavras de alta frequência.',
      'Confirma o padrão fonológico dos erros de escrita; ortografia natural em construção.');
  END IF;

  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'Cubos de Corsi' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 4);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 73, '9 anos e 1 mês', 5, 50,
      'Span direto de 5; manteve estratégia visual consistente, boa persistência na tarefa.',
      'Memória de trabalho visuoespacial preservada — ponto forte a ser usado como apoio (mapas visuais, rotina ilustrada).');
  END IF;

  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'Teste de Atenção por Cancelamento' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 5);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 66, '9 anos e 2 meses', 38, 22,
      'Queda de rendimento na segunda metade da prova; erros por omissão predominam sobre os de ação.',
      'Atenção seletiva e sustentada no limite inferior, coerente com a queixa escolar e com a hipótese de TDAH desatento.');
  END IF;

  SELECT id INTO tid FROM public.testes_catalogo WHERE org_id IS NULL AND nome = 'Anele 1 (LPI)' LIMIT 1;
  IF tid IS NOT NULL THEN
    INSERT INTO public.bateria_itens (org_id, avaliacao_id, teste_id, status, ordem) VALUES (_org_id, aval_id, tid, 'aplicado', 6);
    INSERT INTO public.testes_aplicados (org_id, avaliacao_id, teste_id, data_aplicacao, idade_aplicacao, escore_bruto, percentil, observacoes_qualitativas, interpretacao_clinica)
    VALUES (_org_id, aval_id, tid, CURRENT_DATE - 66, '9 anos e 2 meses', 16, 30,
      'Compreensão de histórias ouvidas adequada; responde bem a perguntas literais e inferenciais simples.',
      'Compreensão oral preservada — a dificuldade concentra-se na decodificação, não na linguagem receptiva.');
  END IF;

  -- ================= Plano terapêutico (CIF + metas funcionais + GAS) =================
  INSERT INTO public.planos_terapeuticos (
    org_id, paciente_id, titulo, ciclo_semanas, data_inicio, data_revisao_prevista, status,
    queixa_principal, diagnostico_resumo, medicacao, frequencia_sessoes,
    cif_funcoes, cif_funcoes_impacto, cif_atividades, cif_atividades_impacto,
    cif_participacao, cif_participacao_impacto, cif_ambientais, cif_pessoais,
    objetivo_participacao, orientacoes_familia, orientacoes_escola, parceiros_clinicos, aprovado_em
  ) VALUES (
    _org_id, pac_id, 'Plano Terapêutico — Ciclo 1', 12, CURRENT_DATE - 45, CURRENT_DATE + 39, 'ativo',
    'Dificuldade de leitura e escrita para a idade e desatenção em sala.',
    'Hipótese de TDAH (apresentação desatenta) com defasagem em consciência fonológica. Avaliação inicial concluída: TDE II Leitura p10, Escrita p8, Ditado Balanceado p12, atenção por cancelamento p22; Corsi na média (p50) e compreensão oral preservada (Anele 1 p30).',
    'Sem medicação no momento.',
    '2 sessões semanais de 50 minutos',
    'b140 Atenção; b144 Memória de trabalho; b167 Linguagem (consciência fonológica)',
    'Perde instruções longas; troca letras com sons próximos (p/b, t/d, f/v); rendimento cai ao longo da tarefa',
    'd140 Aprender a ler; d145 Aprender a escrever; d166 Ler; escrita espontânea e cópia',
    'Lê com apoio silabado; escrita com trocas fonológicas frequentes; cópia do quadro lenta',
    'd820 Educação escolar — atividades coletivas de leitura e lições de casa',
    'Evita ler em voz alta; depende de adulto para iniciar e concluir tarefas; sofrimento diante do erro',
    'e310 Família engajada (facilitador); e355 escola parceira aberta a adaptações; avó apoia no contraturno',
    'Criativa, gosta de jogos e desenhos, sensível a frustração; responde bem a reforço positivo',
    'Participar das atividades de leitura da turma e fazer as lições com autonomia crescente até o fim do ciclo.',
    'Ler junto 10 minutos por dia em material do interesse dela; validar o esforço antes de corrigir; manter o quadro visual de rotina; comemorar tentativas, não só acertos.',
    'Manter assento à frente; instruções curtas e segmentadas; tempo estendido em atividades de escrita; combinar leitura em voz alta apenas em pequenos grupos, com aviso prévio.',
    'Neuropediatra Dra. Beatriz Rocha (exemplo) — acompanhamento da hipótese de TDAH.',
    now()
  ) RETURNING id INTO plano_id;

  -- ---- Meta 1 · Leitura ----
  INSERT INTO public.metas_terapeuticas (org_id, paciente_id, plano_id, titulo, descricao, dominio_cognitivo, prioridade, status, ordem, iniciada_em)
  VALUES (_org_id, pac_id, plano_id, 'Ler textos curtos com autonomia e compreensão',
    'Avançar da leitura silabada de palavras isoladas para a leitura de textos curtos com apoio cada vez menor, sustentando a compreensão do que leu.',
    'Leitura', 1, 'ativa', 1, CURRENT_DATE - 45)
  RETURNING id INTO mt1;
  INSERT INTO public.plano_metas (org_id, plano_id, meta_terapeutica_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa, restricao_funcional, criterios_progressao, criterios_alta, recursos)
  VALUES (_org_id, plano_id, mt1, 1, 'Leitura', 'Ler textos curtos com autonomia e compreensão',
    'Lê palavras isoladas de forma silabada, com apoio constante do adulto.', 12,
    'A decodificação é a base da defasagem observada na avaliação (TDE II p10) e a maior demanda da família e da escola.',
    'Evita atividades coletivas de leitura; depende de mediação para enunciados.',
    'Dois registros seguidos de sessão com leitura de texto curto no nível GAS 0 ou acima.',
    'Leitura de textos do ano escolar com compreensão, sem apoio, mantida por um ciclo.',
    'Textos adaptados curtos, alfabeto móvel, jogos fônicos, mini-livros de interesse (animais).')
  RETURNING id INTO pm1;
  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, pm1, -2, 'Lê apenas palavras isoladas, com apoio constante'),
    (_org_id, pm1, -1, 'Lê frases curtas com apoio frequente'),
    (_org_id, pm1,  0, 'Lê textos curtos com apoio pontual (nível esperado)'),
    (_org_id, pm1,  1, 'Lê textos curtos sozinha'),
    (_org_id, pm1,  2, 'Lê textos maiores sozinha e reconta o que leu');
  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, pm1, 1, 'Instrução fônica sistemática', 'Evidência forte para dificuldades de decodificação.',
     'Sequência estruturada de correspondências grafema-fonema, 15 min por sessão, com jogos de síntese e segmentação.'),
    (_org_id, pm1, 2, 'Leitura repetida com modelagem', 'Melhora fluência e autoconfiança do leitor iniciante.',
     'Terapeuta lê o trecho, leem juntas, depois Sofia lê sozinha o mesmo trecho; registrar apoios necessários.');

  -- ---- Meta 2 · Escrita ----
  INSERT INTO public.metas_terapeuticas (org_id, paciente_id, plano_id, titulo, descricao, dominio_cognitivo, prioridade, status, ordem, iniciada_em)
  VALUES (_org_id, pac_id, plano_id, 'Escrever sem trocar letras de sons parecidos',
    'Reduzir as trocas de surdas/sonoras (p/b, t/d, f/v) na escrita espontânea, com a própria Sofia percebendo e revisando suas produções.',
    'Linguagem escrita', 1, 'ativa', 2, CURRENT_DATE - 45)
  RETURNING id INTO mt2;
  INSERT INTO public.plano_metas (org_id, plano_id, meta_terapeutica_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa, restricao_funcional, criterios_progressao, criterios_alta, recursos)
  VALUES (_org_id, plano_id, mt2, 2, 'Linguagem escrita', 'Escrever sem trocar letras de sons parecidos',
    'Escrita espontânea com trocas frequentes de p/b, t/d e f/v (TDE II Escrita p8).', 12,
    'O padrão de erros é consistentemente fonológico; trabalhar a discriminação de surdas/sonoras tem efeito direto na escrita e na leitura.',
    'Produções escritas pouco legíveis para terceiros; vergonha de mostrar cadernos.',
    'Escrita de frases com trocas apenas ocasionais e autocorreção espontânea.',
    'Escrita espontânea sem trocas fonológicas, mantida por um ciclo.',
    'Alfabeto móvel, pistas articulatórias (espelho), pares mínimos, ditados curtos com apoio visual.')
  RETURNING id INTO pm2;
  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, pm2, -2, 'Troca letras na maioria das palavras que escreve'),
    (_org_id, pm2, -1, 'Troca letras em palavras novas ou longas'),
    (_org_id, pm2,  0, 'Escreve frases com trocas ocasionais, que ela mesma percebe (nível esperado)'),
    (_org_id, pm2,  1, 'Escreve frases sem trocas, revisando sozinha'),
    (_org_id, pm2,  2, 'Escreve pequenos textos sem trocas');
  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, pm2, 1, 'Pares mínimos com pistas articulatórias', 'A discriminação surda/sonora melhora com feedback articulatório explícito.',
     'Contrastar pares (pato/bato, faca/vaca) sentindo a vibração na garganta; registrar no caderno de descobertas.'),
    (_org_id, pm2, 2, 'Ditado com apoio visual decrescente', 'Transferência gradual do apoio para a escrita autônoma.',
     'Ditados curtos começando com banco de letras visível; retirar o apoio conforme os acertos se estabilizam.');

  -- ---- Meta 3 · Funções executivas ----
  INSERT INTO public.metas_terapeuticas (org_id, paciente_id, plano_id, titulo, descricao, dominio_cognitivo, prioridade, status, ordem, iniciada_em)
  VALUES (_org_id, pac_id, plano_id, 'Iniciar e concluir tarefas com autonomia',
    'Diminuir a dependência de lembretes do adulto para começar e terminar atividades, usando rotina visual e autoinstrução.',
    'Funções Executivas', 2, 'ativa', 3, CURRENT_DATE - 45)
  RETURNING id INTO mt3;
  INSERT INTO public.plano_metas (org_id, plano_id, meta_terapeutica_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa, restricao_funcional, criterios_progressao, criterios_alta, recursos)
  VALUES (_org_id, plano_id, mt3, 3, 'Funções executivas', 'Iniciar e concluir tarefas com autonomia',
    'Precisa de 3 a 4 lembretes do adulto para permanecer em uma atividade de 15 minutos.', 12,
    'A autonomia na tarefa sustenta o ganho acadêmico, reduz o desgaste nas lições de casa e generaliza para a sala de aula.',
    'Lições de casa viram fonte de conflito; rendimento cai sem supervisão direta.',
    'Duas semanas seguidas concluindo atividades com no máximo um lembrete.',
    'Inicia e conclui tarefas escolares sozinha, em casa e na clínica.',
    'Quadro de rotina visual com 3 passos, timer visual, cartões de autoinstrução.')
  RETURNING id INTO pm3;
  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, pm3, -2, 'Só permanece na tarefa com o adulto ao lado'),
    (_org_id, pm3, -1, 'Inicia com ajuda e precisa de vários lembretes'),
    (_org_id, pm3,  0, 'Inicia e conclui com um lembrete (nível esperado)'),
    (_org_id, pm3,  1, 'Inicia e conclui sozinha usando o quadro de rotina'),
    (_org_id, pm3,  2, 'Planeja sozinha os passos antes de começar');
  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, pm3, 1, 'Rotina visual com autoinstrução', 'Apoio externo de planejamento reduz a carga executiva.',
     'Quadro com 3 passos ilustrados; Sofia verbaliza cada passo ("primeiro eu…") e marca ao concluir.');

  -- ---- Meta 4 · Autorregulação ----
  INSERT INTO public.metas_terapeuticas (org_id, paciente_id, plano_id, titulo, descricao, dominio_cognitivo, prioridade, status, ordem, iniciada_em)
  VALUES (_org_id, pac_id, plano_id, 'Lidar com o erro usando estratégias de calma',
    'Substituir a desistência e o choro diante do erro por estratégias de regulação (pausa, respiração, pedir ajuda) e nova tentativa.',
    'Autorregulação', 2, 'ativa', 4, CURRENT_DATE - 45)
  RETURNING id INTO mt4;
  INSERT INTO public.plano_metas (org_id, plano_id, meta_terapeutica_id, ordem, dominio, titulo_smart, baseline, prazo_semanas, justificativa, restricao_funcional, criterios_progressao, criterios_alta, recursos)
  VALUES (_org_id, plano_id, mt4, 4, 'Autorregulação', 'Lidar com o erro usando estratégias de calma',
    'Diante do erro, desiste ou chora; raramente pede ajuda espontaneamente.', 12,
    'O sofrimento diante do erro bloqueia a exposição à leitura e à escrita — regular a frustração destrava as demais metas.',
    'Evita atividades com risco de errar; autoestima acadêmica fragilizada.',
    'Usa uma estratégia de calma com apoio pontual na maioria das situações de erro.',
    'Encara o erro como parte do aprender, tentando de novo sem mediação.',
    'Termômetro das emoções, cartões de estratégias de calma, histórias sociais sobre errar.')
  RETURNING id INTO pm4;
  INSERT INTO public.plano_gas (org_id, meta_id, nivel, descricao) VALUES
    (_org_id, pm4, -2, 'Desiste ou chora diante de qualquer erro'),
    (_org_id, pm4, -1, 'Aceita o erro com mediação do adulto'),
    (_org_id, pm4,  0, 'Usa uma estratégia de calma com apoio pontual (nível esperado)'),
    (_org_id, pm4,  1, 'Usa estratégias sozinha e tenta de novo'),
    (_org_id, pm4,  2, 'Encara o erro com naturalidade e ajuda colegas a fazerem o mesmo');
  INSERT INTO public.plano_estrategias (org_id, meta_id, ordem, nome, justificativa, como_aplicar) VALUES
    (_org_id, pm4, 1, 'Psicoeducação do erro + reforço da tentativa', 'Mudar a relação com o erro reduz a esquiva e amplia a exposição à tarefa.',
     'Nomear o erro como pista de aprendizagem ("o erro mostra o que falta treinar"); reforçar a tentativa antes do acerto; registrar conquistas no caderno.');

  -- ============ 4 semanas de atendimentos + sessões vinculadas às metas ============
  FOR i IN 1..4 LOOP
    INSERT INTO public.atendimentos (
      org_id, paciente_id, local_id, modalidade_id, status_frequencia_id, inicio, fim, observacoes
    ) VALUES (
      _org_id, pac_id, local_id, modalidade_id, status_presente_id,
      date_trunc('day', now()) - make_interval(days => 7 * (5 - i)) + interval '14 hours',
      date_trunc('day', now()) - make_interval(days => 7 * (5 - i)) + interval '14 hours 50 minutes',
      'Atendimento de exemplo (paciente modelo).'
    ) RETURNING id INTO atend_id;

    INSERT INTO public.prontuario_sessoes (
      org_id, paciente_id, atendimento_id, data_sessao, hora_inicio, duracao_min,
      engajamento, motivacao, persistencia, autorregulacao, participacao,
      nivel_suporte, recursos_utilizados, evolucao, observacoes,
      orientacao_casa, orientacao_texto, nota_proxima_sessao
    ) VALUES (
      _org_id, pac_id, atend_id,
      (date_trunc('day', now()) - make_interval(days => 7 * (5 - i)))::date,
      time '14:00', 50,
      CASE i WHEN 1 THEN 3 WHEN 2 THEN 4 WHEN 3 THEN 4 ELSE 5 END,
      CASE i WHEN 1 THEN 3 WHEN 2 THEN 4 WHEN 3 THEN 4 ELSE 5 END,
      CASE i WHEN 1 THEN 3 WHEN 2 THEN 3 WHEN 3 THEN 4 ELSE 4 END,
      CASE i WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 3 ELSE 4 END,
      CASE i WHEN 1 THEN 4 WHEN 2 THEN 4 WHEN 3 THEN 5 ELSE 5 END,
      CASE i WHEN 1 THEN 'Moderado' WHEN 2 THEN 'Moderado' WHEN 3 THEN 'Leve' ELSE 'Leve' END,
      CASE i
        WHEN 1 THEN ARRAY['Jogo de rimas', 'Alfabeto móvel', 'Termômetro das emoções']
        WHEN 2 THEN ARRAY['Alfabeto móvel', 'Pares mínimos com espelho', 'Quadro de rotina visual']
        WHEN 3 THEN ARRAY['Texto adaptado curto', 'Ditado com banco de letras', 'Quadro de rotina visual']
        ELSE ARRAY['Mini-livro de animais', 'Caderno de descobertas', 'Cartões de autoinstrução']
      END,
      CASE i
        WHEN 1 THEN 'Sessão de vínculo e linha de base: Sofia identificou rimas com apoio e segmentou palavras dissílabas. Nas tentativas de escrita espontânea, trocas p/b e t/d confirmando o perfil da avaliação. Diante do primeiro erro no jogo, quis parar — retomou após pausa breve e acolhimento. Apresentado o termômetro das emoções.'
        WHEN 2 THEN 'Pares mínimos com pistas articulatórias (pato/bato, faca/vaca): percebeu a vibração das sonoras com o espelho e acertou a maioria das discriminações. Montou o quadro de rotina da sessão e o seguiu com dois lembretes. Diante do erro, usou a pausa combinada uma vez, com mediação.'
        WHEN 3 THEN 'Leitura repetida de texto de 4 linhas: no terceiro ciclo, leu com poucos apoios e respondeu às perguntas de compreensão. Ditado com banco de letras: trocas apenas em palavras longas, e ela mesma percebeu duas delas. Seguiu o quadro de rotina com um único lembrete.'
        ELSE 'Leu sozinha duas páginas do mini-livro de animais escolhido por ela e recontou a história com detalhes. Escrita de frases sobre o livro com uma única troca, autocorrigida. Diante de um erro na escrita, respirou fundo ("como a gente treinou") e tentou de novo sem mediação. Melhor sessão do ciclo.'
      END,
      CASE i
        WHEN 1 THEN 'Combinar com a família o quadro de rotina para as lições de casa.'
        WHEN 4 THEN 'Ciclo evoluindo bem — considerar aumentar a complexidade dos textos.'
        ELSE NULL
      END,
      i IN (2, 4),
      CASE i
        WHEN 2 THEN 'Usar o quadro de rotina nas lições de casa; ler junto 10 minutos por dia no material que ela escolher.'
        WHEN 4 THEN 'Seguir com a leitura diária de 10 minutos do mini-livro; comemorar cada autocorreção na escrita.'
        ELSE NULL
      END,
      CASE i
        WHEN 1 THEN 'Iniciar pares mínimos p/b com espelho; retomar o termômetro das emoções.'
        WHEN 2 THEN 'Levar texto adaptado curto para leitura repetida; ditado com banco de letras.'
        WHEN 3 THEN 'Deixar Sofia escolher o mini-livro; escrita de frases sobre a leitura.'
        ELSE 'Introduzir escrita de pequeno texto (3 frases) com revisão própria.'
      END
    ) RETURNING id INTO sessao_id;

    -- Vínculo sessão ↔ metas com GAS observado (mostra a progressão do ciclo)
    IF i = 1 THEN
      INSERT INTO public.sessao_metas (org_id, sessao_id, meta_id, plano_meta_id, engajamento, nivel_suporte, nivel_gas_observado, houve_progresso, evidencias_clinicas) VALUES
        (_org_id, sessao_id, mt1, pm1, 3, 'Moderado', -2, 'sem_mudanca', 'Leitura silabada de palavras isoladas; apoio constante (linha de base).'),
        (_org_id, sessao_id, mt4, pm4, 3, 'Moderado', -2, 'sem_mudanca', 'Quis desistir no primeiro erro; retomou apenas com acolhimento do adulto.');
    ELSIF i = 2 THEN
      INSERT INTO public.sessao_metas (org_id, sessao_id, meta_id, plano_meta_id, engajamento, nivel_suporte, nivel_gas_observado, houve_progresso, evidencias_clinicas) VALUES
        (_org_id, sessao_id, mt2, pm2, 4, 'Moderado', -1, 'parcial', 'Discriminou surdas/sonoras nos pares mínimos com pista articulatória; trocas persistem na escrita espontânea.'),
        (_org_id, sessao_id, mt3, pm3, 3, 'Moderado', -1, 'parcial', 'Seguiu o quadro de rotina da sessão com dois lembretes.'),
        (_org_id, sessao_id, mt4, pm4, 3, 'Moderado', -1, 'parcial', 'Usou a pausa combinada diante do erro, ainda com mediação.');
    ELSIF i = 3 THEN
      INSERT INTO public.sessao_metas (org_id, sessao_id, meta_id, plano_meta_id, engajamento, nivel_suporte, nivel_gas_observado, houve_progresso, evidencias_clinicas) VALUES
        (_org_id, sessao_id, mt1, pm1, 4, 'Leve', -1, 'sim', 'Leu texto de 4 linhas na leitura repetida com poucos apoios e boa compreensão.'),
        (_org_id, sessao_id, mt2, pm2, 4, 'Leve', 0, 'sim', 'Trocas apenas em palavras longas no ditado; percebeu e corrigiu duas sozinha.'),
        (_org_id, sessao_id, mt3, pm3, 4, 'Leve', 0, 'sim', 'Concluiu as atividades com um único lembrete, usando o quadro.');
    ELSE
      INSERT INTO public.sessao_metas (org_id, sessao_id, meta_id, plano_meta_id, engajamento, nivel_suporte, nivel_gas_observado, houve_progresso, evidencias_clinicas) VALUES
        (_org_id, sessao_id, mt1, pm1, 5, 'Leve', 0, 'sim', 'Leu duas páginas do mini-livro sozinha e recontou a história com detalhes.'),
        (_org_id, sessao_id, mt2, pm2, 4, 'Leve', 0, 'sim', 'Frases com uma única troca, autocorrigida sem mediação.'),
        (_org_id, sessao_id, mt4, pm4, 5, 'Leve', 0, 'sim', 'Respirou fundo diante do erro e tentou de novo espontaneamente.');
    END IF;
  END LOOP;
END $$;

-- Recria as Sofias existentes com o conteúdo completo (dados fictícios).
-- prontuario_sessoes e metas_terapeuticas não têm FK com cascade para
-- pacientes — limpeza explícita antes de remover o paciente.
DO $$
DECLARE p record; o record;
BEGIN
  FOR p IN SELECT id FROM public.pacientes WHERE is_modelo LOOP
    DELETE FROM public.prontuario_sessoes WHERE paciente_id = p.id;
    DELETE FROM public.metas_terapeuticas WHERE paciente_id = p.id;
    DELETE FROM public.pacientes WHERE id = p.id;
  END LOOP;
  FOR o IN SELECT id FROM public.organizacoes LOOP
    PERFORM public.seed_paciente_modelo(o.id);
  END LOOP;
END $$;
