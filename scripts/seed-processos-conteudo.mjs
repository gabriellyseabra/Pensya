// Gera a migration de conteúdo dos POPs a partir de objetos JS (JSON válido/escapado).
// Uso: node scripts/seed-processos-conteudo.mjs
import { writeFileSync } from "node:fs";

let _n = 0;
const id = () => "s" + (_n++).toString(36);
const item = (t, o = {}) => ({ id: id(), texto: t, feito: false, ...(o.g ? { gargalo: true } : {}), ...(o.obs ? { obs: o.obs } : {}), ...(o.r ? { resp: o.r } : {}) });
const ativ = (titulo, itens = [], o = {}) => ({
  id: id(), titulo,
  itens: itens.map((x) => (typeof x === "string" ? item(x) : item(x.t, x))),
  ...(o.g ? { gargalo: true } : {}), ...(o.obs ? { obs: o.obs } : {}), ...(o.r ? { resp: o.r } : {}),
});
const lista = (arr) => arr.map((t) => ({ id: id(), texto: t }));
const met = (indicador, objetivo, ferramenta) => ({ id: id(), indicador, objetivo: ferramenta ? `${objetivo} · ${ferramenta}` : objetivo, valor_atual: "", unidade: "" });

const processos = [
  // ============ COMERCIAL ============
  {
    titulo: "Acolhimento Inicial de Pacientes",
    objetivo: "Acolher a família, entender a demanda, gerar clareza sobre as dificuldades da criança, identificar necessidade clínica, apresentar o funcionamento do processo terapêutico, converter famílias alinhadas e encaminhar corretamente quando necessário.",
    atividades: [
      ativ("Receber lead via WhatsApp", [{ t: "Identificar origem do lead" }, "Indicação", "Google/tráfego pago", "Outros canais"]),
      ativ("Realizar acolhimento inicial", ["Ouvir o paciente/família", "Solicitar pequeno relato do caso", "Demonstrar acolhimento e escuta ativa", "Investigar brevemente a dificuldade apresentada"]),
      ativ("Identificar melhor formato de continuidade da conversa", ["Perguntar se prefere continuar via WhatsApp", "Perguntar se prefere chamada de vídeo/áudio", "Caso opte por chamada:", "Sugerir participação de outro responsável envolvido na decisão quando necessário", "Agendar chamada"]),
      ativ("Realizar qualificação inicial da demanda", ["Perguntar quem indicou o atendimento", "Perguntar desde quando percebe a dificuldade", "Perguntar se já buscou atendimento anteriormente", "Identificar histórico de acompanhamento", "Identificar urgência da demanda", "Identificar alinhamento financeiro inicial"]),
      ativ("Solicitar documentos complementares quando necessário", ["Solicitar avaliação neuropsicológica prévia", "Solicitar relatórios anteriores", "Analisar materiais enviados", "Identificar necessidade de avaliação complementar"]),
      ativ("Avaliar se existe demanda psicopedagógica", ["Identificar se o caso é compatível com atuação da clínica", "Quando não houver demanda de aprendizagem:", "Explicar à família que outro profissional é mais indicado", "Realizar encaminhamento quando necessário", "Permanecer à disposição para suporte futuro"]),
      ativ("Apresentar proposta de atendimento", ["Explicar funcionamento do trabalho", "Explicar etapas do processo clínico", "Explicar frequência dos atendimentos", "Explicar formato de avaliação e acompanhamento", "Explicar suporte oferecido", "Apresentar proposta via áudio no WhatsApp ou chamada"]),
      ativ("Realizar follow-up comercial", ["Caso não responda após envio da proposta:", "Realizar primeiro follow-up no mesmo dia", "Realizar segundo follow-up após 2 dias", "Registrar retorno ou ausência de resposta"]),
      ativ("Encerrar ou converter lead", ["Caso aceite: direcionar para onboarding", "Caso não responda após 2 follow-ups: encerrar lead temporariamente", "Manter lead registrado no CRM", "Caso não haja alinhamento: encerrar atendimento de forma acolhedora"]),
      ativ("Registrar lead no CRM", ["Registrar informações importantes da conversa", "Registrar status do lead", "Registrar origem", "Registrar interesse e objeções", "Atualizar CRM ao final da conversa"]),
    ],
    rotinas: lista(["Responder leads no mesmo dia ou em até 12 horas", "Oferecer chamada logo no início da conversa", "Enviar proposta ainda na conversa", "Realizar primeiro follow-up no mesmo dia em resposta", "Realizar segundo follow-up após 2 dias", "Encerrar lead após 2 tentativas sem retorno", "Registrar lead no CRM ao final da conversa", "Encaminhar para outro profissional quando não houver demanda de aprendizagem", "Atualizar status do lead sempre após nova interação"]),
    riscos: lista(["Demora para responder leads", "Esquecimento de follow-up", "Excesso de dependência da direção clínica", "Falta de alimentação consistente do CRM", "Famílias que somem após receber proposta", "Dificuldade de conciliar agenda para chamadas", "Famílias desalinhadas financeiramente", "Leads sem urgência real", "Excesso de conversas simultâneas no WhatsApp", "Falta de padronização da apresentação da proposta", "Perda de informações importantes da conversa", "Dificuldade de acompanhar leads antigos", "Dificuldade em qualificar previamente leads sem viabilidade financeira", "Sobrecarga operacional por centralização do processo comercial"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Responder leads em até 12 horas no horário comercial", "Realizar follow-up no mesmo dia sem resposta e novo follow-up após 2 dias", "Encerrar lead após 2 tentativas sem retorno", "Registrar leads no CRM ao final da conversa", "Utilizar roteiro padrão de acolhimento e qualificação", "Identificar viabilidade financeira antes de agendar chamada", "Priorizar chamadas apenas para leads alinhados ao perfil da clínica", "Registrar informações importantes imediatamente no CRM", "Encaminhar para outro profissional quando não houver demanda psicopedagógica", "Reforçar diferenciais do acompanhamento durante apresentação da proposta", "Revisar periodicamente mensagens e áudios de apresentação", "Criar rotina semanal de revisão de leads antigos", "Organizar agenda específica para chamadas comerciais", "Padronizar critérios mínimos de qualificação do lead"]),
    metricas: [met("Tempo de resposta ao lead", "Garantir agilidade no acolhimento inicial", "WhatsApp + CRM Sisclin"), met("Taxa de conversão de leads", "Avaliar efetividade do acolhimento inicial", "CRM Sisclin"), met("Continuidade do acompanhamento comercial", "Garantir continuidade do acompanhamento comercial", "CRM Sisclin"), met("Leads cadastrados no CRM", "Evitar perda de oportunidades", "CRM Sisclin"), met("Taxa de comparecimento nas chamadas", "Avaliar qualidade da qualificação inicial", "Google Agenda + CRM Sisclin")],
    tarefas: ["Estruturar roteiro padrão de acolhimento inicial", "Criar perguntas de qualificação financeira", "Padronizar apresentação da proposta comercial", "Criar modelo de follow-up", "Estruturar rotina semanal de acompanhamento de leads", "Criar fluxo de encaminhamento para outros profissionais", "Estruturar materiais gratuitos para leads que não fecharem", "Criar mini trilha de nutrição via WhatsApp", "Organizar agenda específica para chamadas comerciais", "Criar checklist de qualificação antes da chamada", "Criar modelo de áudio de apresentação", "Estruturar automação futura para leads não convertidos"],
  },

  // ============ AVALIAÇÃO - GABRIELLY ============
  {
    titulo: "Avaliação Psicopedagógica - Gabrielly",
    objetivo: "Avaliação psicopedagógica para identificar dificuldades e causas das dificuldades apresentadas na queixa inicial.",
    atividades: [
      ativ("Criar cópia do Prontuário do Paciente com nome padrão [Prontuário NOME]", ["Inserir os dados cadastrais"]),
      ativ("Realizar processo de avaliação", [
        { t: "Realizar anamnese com responsáveis (online ou presencial)" },
        "Se for online, enviar link do Zoom",
        "Definir protocolos e instrumentos clínicos conforme demanda (no prontuário do Sisclin - aba de Plano de Avaliação)",
        "Fazer a compra das licenças de aplicação online",
        "Aplicar testes e instrumentos padronizados durante as sessões",
        "Registrar sessões de avaliação na aba Registros da avaliação no prontuário do paciente",
        { t: "Corrigir testes e protocolos", g: true, obs: "Alguns testes são muito trabalhosos para corrigir → já estou em processo de automação de algumas ferramentas de correção" },
        "Inserir os resultados na aba de Resultados dos testes no prontuário",
        "Registrar observações clínicas qualitativas na folha de teste",
      ]),
      ativ("Escrever relatório clínico", ["Criar uma cópia do modelo de relatório adequado para a demanda (pasta no drive com todos os modelos)", "Registrar informações do paciente", "Inserir os dados nas tabelas", "Validar e direcionar a escrita", "Imprimir o relatório e colocar na pasta personalizada", "Assinar no GOV o relatório em PDF e inserir na pasta do paciente no drive"]),
      ativ("Realizar contato com a escola", ["Entrar em contato com a escola via whatsapp/telefone para agendar uma reunião", "Agendar a data no Google Agenda", "Preparar roteiro da reunião", "Se a reunião for online, enviar o link do Zoom e fazer o registro", "Inserir as informações da reunião com a escola no prontuário"]),
      ativ("Realizar devolutiva de avaliação", [
        "Se for online, enviar link do Zoom para o cliente",
        "Enviar o relatório em PDF na skill de Devolutiva do Claude (automatizada)",
        "Apresentar na TV do consultório",
        "Entregar o relatório final na pasta",
        { t: "Criar um material de orientações práticas para a família", g: true, obs: "Detalhe importante, mas muito operacional e que demora muito" },
        "Elaborar documento de orientação e adaptações pedagógicas para a escola (usar o agente Mente Criar+ - Maria Orientadora → inserir no relatório de avaliação)",
        "Enviar o documento da escola por email ou whatsapp (da instituição)",
        { t: "Entregar um mimo para a família na devolutiva", g: true, obs: "Quero fazer, mas ainda não está estruturado" },
      ]),
    ],
    rotinas: lista(["Entrar em contato com a escola do paciente até o final do 1º mês", "Agendar a reunião com a escola até a 8ª sessão", "Sessões realizadas semanalmente com duração de 50 minutos", "Registros clínicos realizados após a sessão ou até o final da semana", "Instrumentos de avaliação corrigidos semanalmente", "Relatório clínico entregue em até 21 dias úteis após encerramento da avaliação"]),
    riscos: lista(["Demora na escrita e finalização dos relatórios", "Excesso de dependência da Gabrielly para tomada de decisão", "Falta de rotina fixa de supervisão clínica", "Registros clínicos atrasados ou incompletos no Sisclin", "Necessidade constante de revisão técnica dos relatórios produzidos pela equipe"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Comunicar imediatamente famílias sobre atrasos de devolutiva ou relatório", "Reagendar devolutiva antes do vencimento do prazo", "Reservar blocos fixos para escrita clínica"]),
    metricas: [],
    tarefas: [],
  },

  // ============ AVALIAÇÃO - EQUIPE ============
  {
    titulo: "Avaliação Psicopedagógica - Equipe",
    objetivo: "Avaliação psicopedagógica realizada pela equipe (Gabrielly e Luciana) para identificar dificuldades e causas das dificuldades apresentadas na queixa inicial.",
    atividades: [
      ativ("Criar cópia do Prontuário do Paciente com nome padrão [Prontuário NOME]", ["Compartilhar com a Luciana como editora", "Inserir os dados cadastrais"]),
      ativ("Realizar processo de avaliação", [
        "Realizar anamnese com responsáveis (online ou presencial)",
        "Se for online, enviar link do Zoom",
        "Definir protocolos e instrumentos clínicos conforme demanda (no prontuário do Sisclin - aba de Plano de Avaliação)",
        "Fazer a compra das licenças de aplicação online",
        { t: "Aplicar testes e instrumentos padronizados durante as sessões", g: true, obs: "Luciana depende de que eu diga quais testes serão aplicados sessão após sessão (começar a usar o planejamento de avaliação separado por demandas)" },
        "Registrar sessões de avaliação na aba Registros da avaliação no prontuário do paciente",
        "Corrigir testes e protocolos - gravação das aulas dos testes na Plataforma de Treinamento + ferramentas de correção automatizadas",
        "Inserir os resultados na aba de Resultados dos testes no prontuário",
        "Registrar observações clínicas qualitativas na folha de teste",
      ]),
      ativ("Escrever relatório clínico (utilizar o agente Nave Avalia no ChatGPT)", ["Criar uma cópia do modelo de relatório adequado para a demanda (criar pasta no drive com todos os modelos)", "Compartilhar a cópia com a Gabrielly", "Registrar informações do paciente", "Inserir os dados nas tabelas", "Utilizar a opção de comentários para validações pendentes", "Validar e direcionar a escrita", "Marcar em laranja tudo o que tiver dúvida se mantém ou retira", "Marcar em verde todas as alterações realizadas após a validação da Gabi", "Imprimir o relatório e colocar na pasta personalizada", "Assinar no GOV o relatório em PDF"]),
      ativ("Realizar contato com a escola", ["Entrar em contato com a escola via whatsapp/telefone para agendar uma reunião", "Agendar a data no Google Agenda", "Preparar roteiro da reunião", "Se a reunião for online, enviar o link do Zoom e fazer o registro → enviar o registro para a Luciana inserir no prontuário", "Inserir as informações da reunião com a escola no prontuário"]),
      ativ("Realizar supervisão clínica da equipe", ["Presencial ou online (Zoom)", "Validar/elaborar raciocínio clínico", "Se for online, fazer o registro da reunião e enviar posteriormente para a Luciana"]),
      ativ("Realizar devolutiva de avaliação", [
        "Se for online, enviar link do Zoom para o cliente e para a Luciana",
        "Enviar o relatório em PDF na skill de Devolutiva do Claude (automatizada)",
        "Apresentar na TV do consultório",
        "Entregar o relatório final na pasta",
        { t: "Criar um material de orientações práticas para a família → Gabi valida → criar skill para automatizar" },
        "Elaborar documento de orientação e adaptações pedagógicas para a escola (usar o agente Mente Criar+ - Maria Orientadora → inserir no relatório de avaliação)",
        "Enviar o documento da escola por email ou whatsapp (da instituição)",
        { t: "Entregar um mimo para a família na devolutiva", g: true, obs: "Quero fazer, mas ainda não está estruturado" },
      ]),
    ],
    rotinas: lista(["Entrar em contato com a escola do paciente até o final do 1º mês", "Agendar a reunião com a escola até a 8ª sessão", "Sessões realizadas semanalmente com duração de 50 minutos", "Registros clínicos realizados após a sessão ou até o final da semana", "Instrumentos de avaliação corrigidos semanalmente", "Relatório clínico entregue em até 21 dias úteis após encerramento da avaliação", "Supervisão clínica realizada"]),
    riscos: lista(["Demora na escrita e finalização dos relatórios", "Excesso de dependência da Gabrielly para tomada de decisão", "Falta de rotina fixa de supervisão clínica", "Registros clínicos atrasados ou incompletos no Sisclin", "Necessidade constante de revisão técnica dos relatórios produzidos pela equipe"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Comunicar imediatamente famílias sobre atrasos de devolutiva ou relatório", "Reagendar devolutiva antes do vencimento do prazo", "Reservar blocos fixos para escrita clínica"]),
    metricas: [],
    tarefas: [],
  },

  // ============ INTERVENÇÃO - EQUIPE (novo) ============
  {
    titulo: "Intervenção - Acompanhamento Clínico (Equipe)",
    novo: true, emoji: "🧩", categoria: "Operacional", frequencia: "Recorrente semanal com ações complementares sob demanda",
    objetivo: "Garantir um acompanhamento clínico estruturado, individualizado e contínuo, promovendo o desenvolvimento funcional da criança por meio de intervenções terapêuticas alinhadas ao plano terapêutico, com integração entre equipe, família e escola, monitoramento da evolução clínica, registros adequados em prontuário e supervisão terapêutica contínua.",
    atividades: [
      ativ("Elaborar o plano terapêutico", ["Acessar relatório de avaliação do paciente após finalização da devolutiva com a família", "Utilizar a skill no Claude para gerar o plano terapêutico", "Inserir o plano terapêutico no prontuário do paciente no Sisclin"]),
      ativ("Preencher o perfil clínico completo do paciente no Sisclin", ["Inserir informações gerais", "Inserir contexto familiar", "Inserir contexto escolar", "Inserir histórico clínico relevante", "Inserir reforçadores identificados", "Inserir barreiras potencializadoras da aprendizagem"]),
      ativ("Validar e planejar", ["Encaminhar plano terapêutico para validação da direção clínica - Gabrielly", "Realizar alinhamento clínico inicial sobre prioridades terapêuticas", "Planejar sessões terapêuticas com base nas habilidades previstas no plano terapêutico", "Utilizar ferramentas de IA autorizadas pela clínica para personalização das atividades terapêuticas quando necessário", "Consultar banco de jogos clínicos para seleção de recursos terapêuticos", "Consultar Drive de recursos da Nave para utilização de materiais complementares", "Utilizar materiais físicos disponíveis no consultório conforme necessidade clínica"]),
      ativ("Realizar primeira sessão de psicoeducação com a criança", ["Explicar como funciona o acompanhamento", "Explicar o objetivo das sessões", "Explicar o que a criança pode esperar do processo terapêutico"]),
      ativ("Conduzir o acompanhamento clínico", ["Iniciar acompanhamento clínico semanal (sessões de 50 minutos)", "Aplicar protocolos de intervenção conforme objetivos terapêuticos definidos", "Registrar sessão clínica no Sisclin após cada atendimento", "Registrar presença ou falta do paciente na aba de frequência do Sisclin"]),
      ativ("Realizar feedback para a família ao final das sessões quando necessário", ["Informar habilidades trabalhadas", "Informar dificuldades observadas", "Informar evoluções percebidas", "Encaminhar orientações e atividades para continuidade em casa quando necessário", "Reforçar importância da continuidade terapêutica no ambiente familiar"]),
      ativ("Realizar acompanhamento escolar", ["Realizar acompanhamento escolar contínuo conforme necessidade do paciente", "Realizar contato escolar minimamente no início, meio e final do ano"]),
      ativ("Organizar devolutiva parcial semestral com famílias em julho", ["Elaborar apresentação da evolução clínica", "Apresentar devolutiva na TV do consultório", "Alinhar próximos objetivos terapêuticos"]),
      ativ("Organizar devolutiva anual em dezembro", ["Elaborar apresentação anual da evolução clínica", "Apresentar devolutiva na TV do consultório", "Discutir necessidade de continuidade terapêutica para o ano seguinte", "Realizar agendamento das devolutivas familiares"]),
    ],
    rotinas: lista(["O plano terapêutico deve ser criado em até 7 dias após finalização da avaliação/devolutiva familiar", "O plano terapêutico obrigatoriamente deve ser validado antes do início da intervenção", "As sessões terapêuticas acontecem semanalmente com duração média de 50 minutos", "O registro clínico deve ser realizado preferencialmente no mesmo dia do atendimento (prazo máximo até o final da semana vigente)", "O registro de presença ou falta deve ser realizado ao final de cada sessão", "Feedbacks familiares devem acontecer de forma contínua e breve ao final dos atendimentos quando necessário", "O acompanhamento escolar deve ocorrer minimamente no início, meio e final do ano", "A devolutiva parcial com famílias deve ocorrer em julho", "A devolutiva anual deve ocorrer em dezembro"]),
    riscos: lista(["Falta de rotina fixa de supervisão clínica", "Falta de padronização do registro terapêutico periódico", "Registros clínicos atrasados ou incompletos no Sisclin", "Não realização do registro de frequência do paciente", "Sobrecarga operacional da direção clínica", "Atraso na criação dos planos terapêuticos", "Baixa adesão familiar às orientações e atividades de casa", "Faltas frequentes dos pacientes", "Dificuldade da família em perceber evolução no curto prazo", "Ausência de fluxo padronizado para acompanhamento escolar", "Dependência excessiva da direção clínica para tomada de decisão terapêutica"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Acionar direção clínica em casos de atraso na criação do plano terapêutico", "Realizar revisão semanal dos prontuários para identificação de registros pendentes", "Solicitar atualização imediata do Sisclin em casos de prontuários incompletos", "Reforçar alinhamentos terapêuticos com equipe em casos de inconsistência clínica", "Agendar reunião clínica extraordinária quando houver dificuldade significativa na evolução terapêutica", "Reforçar orientações familiares em casos de baixa adesão às atividades propostas", "Realizar contato ativo com responsáveis em casos de faltas frequentes", "Reavaliar estratégias terapêuticas quando não houver evolução observável", "Registrar todas as intercorrências relevantes no prontuário clínico"]),
    metricas: [met("Frequência/adesão dos pacientes ao acompanhamento", "Monitorar continuidade terapêutica", "Sisclin"), met("Percentual de devolutivas semestrais realizadas", "Garantir alinhamento contínuo com famílias", "Agenda + registros internos"), met("Percentual de planos terapêuticos criados no prazo", "Reduzir início da intervenção sem direcionamento", "Sisclin + controle interno"), met("Percentual de registros clínicos realizados no prazo", "Garantir prontuários atualizados e segurança documental", "Sisclin")],
    tarefas: ["Estruturar rotina fixa de supervisão clínica", "Padronizar revisão terapêutica periódica", "Estruturar rotina fixa de devolutivas parciais", "Criar mecanismo de controle dos registros clínicos no Sisclin", "Criar mecanismo de acompanhamento dos planos terapêuticos pendentes", "Inserir links oficiais dos templates/modelos utilizados", "Estruturar fluxo oficial de acompanhamento escolar"],
  },

  // ============ OFFBOARDING - ALTA (novo) ============
  {
    titulo: "Offboarding - Alta do acompanhamento",
    novo: true, emoji: "🎓", categoria: "Operacional", frequencia: "Sob demanda",
    objetivo: "Formalizar o encerramento do ciclo terapêutico, validar as conquistas do paciente ao longo do acompanhamento e entregar orientações finais para continuidade do desenvolvimento fora da clínica.",
    atividades: [
      ativ("Monitorar evolução clínica do paciente", ["Avaliar registros no prontuário do paciente", "Observar manutenção da evolução ao longo dos meses", "Identificar autonomia crescente do paciente", "Avaliar se o desempenho está próximo ao esperado na idade/turma"]),
      ativ("Identificar possibilidade de alta clínica", ["Reunião com a Luciana (se for paciente dela)", "Avaliar resposta às intervenções", "Avaliar estabilidade das habilidades trabalhadas", "Avaliar necessidade de continuidade terapêutica"]),
      ativ("Iniciar preparação gradual da família", ["Conversar previamente sobre possibilidade de alta", "Preparar emocionalmente família e paciente", "Explicar critérios clínicos considerados", "Reforçar evolução alcançada"]),
      ativ("Realizar alinhamento com escola", ["Entrar em contato com a escola e agendar a reunião", "Solicitar percepção da escola", "Investigar possíveis objeções", "Reavaliar decisão quando necessário"], { g: true, obs: "Dificuldade em conciliar reunião na agenda da Gabrielly" }),
      ativ("Realizar reavaliação clínica", [
        { t: "Selecionar instrumentos específicos (criar lista de critério de escolha de instrumentos de avaliação)", g: true, obs: "Gargalo" },
        "Aplicar reavaliação parcial",
        "Corrigir os testes usando as tabelas normativas",
        "Validar alcance dos objetivos iniciais",
      ]),
      ativ("Escrever relatório final de evolução (usar o agente de escrita de relatório)", ["Criar uma cópia do modelo de relatório de evolução e de alta (criar modelo para cópia)", "Organizar habilidades desenvolvidas", "Registrar habilidades desenvolvidas", "Formalizar encerramento terapêutico", "Inserir orientações finais para família e escola", "Registrar possibilidade de retorno quando necessário", "Comunicar a Gabrielly para validar versão final", "Validar a versão final e fazer a assinatura digital no GOV"]),
      ativ("Realizar devolutiva final", ["Apresentar evolução alcançada pelo modelo de devolutiva - Skill do Claude", "Explicar critérios da alta", "Entregar monitoramento pós-alta", "Reforçar sinais de atenção para possível retorno"]),
      ativ("Realizar encerramento emocional do processo", ["Preparar sessão especial de encerramento", "Entregar certificado de conclusão", "Entregar mimo/presente personalizado", "Validar conquistas do paciente", "Celebrar evolução terapêutica"]),
      ativ("Formalizar encerramento operacional", ["Registrar alta no prontuário", "Alterar status do paciente para inativo no Sisclin no encerramento"]),
      ativ("Comunicar escola sobre encerramento (WhatsApp/telefone/email)", ["Informar oficialmente alta terapêutica", "Registrar comunicação no prontuário do paciente"]),
      ativ("Realizar acompanhamento pós-alta", ["Entrar em contato aproximadamente 1 mês após alta", "Manter vínculo aberto para retorno futuro"]),
    ],
    rotinas: lista(["Iniciar preparação emocional para alta quando o paciente mantém evolução consistente há alguns meses", "Considerar alta quando o desempenho estiver próximo ao esperado para idade e turma escolar", "Realizar reavaliação antes da alta", "Selecionar instrumentos específicos para reavaliação conforme objetivos terapêuticos", "Conversar previamente com a família sobre possibilidade de alta cerca de 3 meses antes", "Comunicar previamente a escola e solicitar parecer", "Realizar devolutiva final após análise da reavaliação", "Entregar relatório final no dia da alta", "Comunicar escola oficialmente após encerramento", "Alterar status do paciente para inativo no Sisclin após encerramento", "Realizar contato pós-alta aproximadamente 1 mês após encerramento", "Manter acompanhamento especial sem periodicidade fixa", "Reabrir acompanhamento quando necessário mediante nova avaliação clínica"]),
    riscos: lista(["Dificuldade da família em aceitar alta", "Insegurança da escola em relação ao encerramento", "Medo da família de regressão após alta", "Alta precoce antes da consolidação das habilidades", "Falta de alinhamento entre clínica, família e escola", "Não atualização do status do paciente no Sisclin", "Falta de acompanhamento pós-alta", "Dependência emocional da família em relação ao acompanhamento", "Dificuldade em perceber o momento ideal da alta", "Ausência de critérios totalmente padronizados para a clínica", "Possível retorno de dificuldades após encerramento", "Sobrecarga operacional para elaboração do relatório final"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Preparar emocionalmente a família de forma gradual antes da alta", "Validar decisão da alta junto à escola e família", "Reavaliar paciente em casos de insegurança clínica", "Reforçar orientações de monitoramento pós-alta", "Manter possibilidade de retorno aberta", "Registrar claramente critérios clínicos que justificaram a alta", "Atualizar status do paciente no Sisclin imediatamente após encerramento", "Agendar contato pós-alta", "Reavaliar necessidade de retorno em casos de regressão", "Formalizar orientações finais por escrito", "Reforçar autonomia do paciente e da família", "Registrar devolutiva final no prontuário"]),
    metricas: [met("Número de altas clínicas realizadas", "Monitorar encerramentos terapêuticos concluídos", "Sistema de Gestão"), met("Retorno pós-alta", "Avaliar estabilidade dos resultados após encerramento", "WhatsApp"), met("Tempo médio de acompanhamento até alta", "Avaliar duração média dos processos terapêuticos", "Sisclin"), met("Atualização correta do status do paciente", "Garantir organização clínica e administrativa", "Sisclin"), met("Satisfação da família no encerramento", "Avaliar experiência final do paciente/família", "Formulário no Google")],
    tarefas: ["Criar checklist oficial de alta clínica", "Padronizar critérios clínicos de alta", "Criar modelo padrão de relatório de evolução final", "Criar modelo de certificado de conclusão", "Estruturar processo de reavaliação", "Criar rotina obrigatória de alteração de status no Sisclin", "Criar pesquisa de satisfação pós-alta", "Padronizar comunicação de alta para escola", "Estruturar ritual de encerramento terapêutico", "Definir fluxo de acompanhamento pós-alta", "Criar indicadores visuais de evolução para apresentar na alta"],
  },

  // ============ OFFBOARDING - INTERRUPÇÃO (novo) ============
  {
    titulo: "Offboarding - Interrupção do acompanhamento",
    novo: true, emoji: "✋", categoria: "Operacional", frequencia: "Sob demanda",
    objetivo: "Formalizar o encerramento do acompanhamento quando ocorre interrupção antes da alta, orientar os riscos da interrupção precoce, registrar a ciência da família sobre habilidades ainda em desenvolvimento e manter possibilidade de retorno futuro.",
    atividades: [
      ativ("Receber comunicação da família sobre interrupção do acompanhamento", ["Identificar motivo do encerramento", "Registrar justificativa inicial", "Verificar se existe possibilidade de continuidade"]),
      ativ("Investigar situação clínica atual do paciente", ["Revisar evolução registrada no Sisclin", "Conversa com a Luciana, caso seja paciente dela", "Verificar habilidades ainda em desenvolvimento", "Avaliar riscos da interrupção precoce", "Avaliar impacto acadêmico e funcional esperado"]),
      ativ("Conversar com a família sobre interrupção", ["Explicar situação clínica atual", "Orientar riscos da interrupção precoce", "Explicar habilidades ainda não consolidadas", "Reforçar importância da continuidade terapêutica quando necessário", "Validar decisão final da família"]),
      ativ("Elaborar documento de interrupção do acompanhamento", ["Registrar que o paciente não recebeu alta clínica", "Registrar que a interrupção ocorreu por escolha da família", "Registrar ciência da família sobre habilidades ainda em desenvolvimento", "Inserir orientações clínicas finais", "Solicitar assinatura da família (física ou pelo Autentique)"], { g: true, obs: "Criar modelo de documento" }),
      ativ("Formalizar encerramento administrativo", ["Registrar interrupção no prontuário", "Alterar status do paciente para inativo no Sisclin", "Salvar documento assinado no drive do paciente"]),
      ativ("Comunicar escola sobre encerramento (WhatsApp/telefone/email)", ["Informar oficialmente encerramento terapêutico", "Registrar comunicação no prontuário do paciente"]),
      ativ("Realizar encerramento acolhedor", ["Manter vínculo respeitoso com a família", "Deixar possibilidade de retorno aberta", "Orientar sinais de alerta para retorno futuro"]),
      ativ("Realizar acompanhamento posterior quando necessário", ["Registrar possibilidade de retorno futuro", "Reabrir acompanhamento mediante nova avaliação clínica (após 6 meses de pausa)"]),
    ],
    rotinas: lista(["Formalizar encerramento assim que a família confirmar interrupção", "Realizar orientação clínica antes do encerramento definitivo", "Emitir documento de interrupção antes do encerramento administrativo", "Solicitar assinatura da família no documento", "Comunicar e alinhar com escola durante o encerramento", "Atualizar status do paciente para inativo após assinatura do documento", "Registrar encerramento no prontuário imediatamente após finalização", "Manter possibilidade de retorno aberta sem prazo definido", "Reabrir acompanhamento mediante nova avaliação clínica quando necessário"]),
    riscos: lista(["Família interromper acompanhamento precocemente", "Família não compreender riscos da interrupção", "Não comunicação da interrupção para escola", "Interrupção por baixa adesão familiar", "Interrupção por questões financeiras", "Interrupção sem alinhamento clínico", "Falta de formalização documental", "Não assinatura do documento pela família", "Não atualização do status do paciente no Sisclin", "Possível piora clínica após interrupção", "Retorno tardio após regressão importante", "Sobrecarga emocional da equipe diante de interrupções precoces"]).map((r) => ({ id: r.id, ponto_critico: r.texto, acao: "" })),
    acoes: lista(["Explicar claramente riscos da interrupção precoce", "Formalizar orientações clínicas por escrito", "Solicitar assinatura da família no documento de ciência", "Reforçar necessidade de comunicação com escola", "Registrar detalhadamente situação clínica no prontuário", "Atualizar status do paciente no Sisclin imediatamente após encerramento", "Manter vínculo acolhedor mesmo sem continuidade", "Orientar sinais de alerta para retorno futuro", "Registrar recusa de assinatura quando necessário", "Reavaliar possibilidade de continuidade quando interrupção ocorrer por fatores pontuais", "Formalizar que o paciente não recebeu alta clínica", "Manter documentação organizada para possível retorno futuro"]),
    metricas: [met("Número de interrupções de acompanhamento", "Monitorar taxa de evasão", ""), met("Motivos de interrupção", "Identificar padrões de evasão", ""), met("Assinaturas do termo de interrupção", "Garantir formalização clínica", "Drive do paciente"), met("Retorno após interrupção", "Avaliar retomada de pacientes", ""), met("Tempo médio até interrupção", "Identificar períodos críticos de abandono", "")],
    tarefas: ["Criar modelo oficial de documento de interrupção do acompanhamento", "Padronizar orientações clínicas finais", "Criar checklist operacional de encerramento sem alta", "Padronizar registro de motivo da interrupção", "Criar fluxo de atualização obrigatória no Sisclin", "Estruturar rotina de acompanhamento pós-interrupção", "Criar indicadores de interrupção precoce", "Criar protocolo de tentativa de retenção clínica", "Estruturar comunicação padrão para escola", "Criar fluxo de retorno ao acompanhamento", "Padronizar armazenamento dos documentos assinados", "Criar relatório interno de evasão clínica"],
  },
];

// Responsável por etapa nos POPs de equipe (legenda de cores do Notion).
// Só marca as exceções/blocos claros; o restante (dono padrão do processo) fica sem cor.
const RESP_MAP = {
  "Avaliação Psicopedagógica - Equipe": {
    "Criar cópia do Prontuário do Paciente com nome padrão [Prontuário NOME]": "gabi",
    "Escrever relatório clínico (utilizar o agente Nave Avalia no ChatGPT)": "ambas",
    "Realizar contato com a escola": "gabi",
    "Realizar supervisão clínica da equipe": "gabi",
    "Realizar devolutiva de avaliação": "ambas",
  },
  "Offboarding - Alta do acompanhamento": {
    "Escrever relatório final de evolução (usar o agente de escrita de relatório)": "luciana",
    "Realizar devolutiva final": "ambas",
    "Realizar encerramento emocional do processo": "luciana",
  },
};
for (const p of processos) {
  const map = RESP_MAP[p.titulo];
  if (!map) continue;
  for (const a of p.atividades ?? []) if (map[a.titulo]) a.resp = map[a.titulo];
}

function conteudoDe(p) {
  return {
    atividades: p.atividades ?? [],
    recursos: p.recursos ?? [],
    rotinas: p.rotinas ?? [],
    riscos: p.riscos ?? [],
    acoes: p.acoes ?? [],
    metricas: p.metricas ?? [],
    tarefas_pendentes: (p.tarefas ?? []).map((t) => ({ id: id(), texto: t, feito: false })),
  };
}

// Metadados (departamento/emoji/categoria/frequência) para tornar o seed autossuficiente:
// cria o processo se não existir e depois preenche o conteúdo. Não depende de outro seed.
const META = {
  "Acolhimento Inicial de Pacientes": { dep: "Comercial", emoji: "🤝", cat: "Tático" },
  "Avaliação Psicopedagógica - Gabrielly": { dep: "Operações", emoji: "🧠", cat: "Tático" },
  "Avaliação Psicopedagógica - Equipe": { dep: "Operações", emoji: "👥", cat: "Tático" },
  "Intervenção - Acompanhamento Clínico (Equipe)": { dep: "Operações", emoji: "🧩", cat: "Operacional", freq: "Recorrente semanal com ações complementares sob demanda" },
  "Offboarding - Alta do acompanhamento": { dep: "Operações", emoji: "🎓", cat: "Operacional", freq: "Sob demanda" },
  "Offboarding - Interrupção do acompanhamento": { dep: "Operações", emoji: "✋", cat: "Operacional", freq: "Sob demanda" },
};

const linhas = [
  "-- =========================================================",
  "-- Conteúdo dos POPs (gerado por scripts/seed-processos-conteudo.mjs)",
  "-- Autossuficiente e idempotente: cria o processo se não existir e preenche o conteúdo.",
  "-- =========================================================",
  "",
];

for (const p of processos) {
  const j = JSON.stringify(conteudoDe(p));
  const m = META[p.titulo] ?? { dep: "Operações", emoji: "⚙️", cat: null };
  const cat = m.cat ? `$c$${m.cat}$c$` : "NULL";
  const freq = m.freq ? `$f$${m.freq}$f$` : "NULL";
  linhas.push(
    `INSERT INTO public.processos (titulo, emoji, departamento_id, categoria, frequencia, objetivo, conteudo)`,
    `SELECT $t$${p.titulo}$t$, $e$${m.emoji}$e$, d.id, ${cat}, ${freq}, $o$${p.objetivo}$o$, $j$${j}$j$::jsonb`,
    `FROM public.departamentos d WHERE d.nome = $dp$${m.dep}$dp$`,
    `AND NOT EXISTS (SELECT 1 FROM public.processos p WHERE p.titulo = $t$${p.titulo}$t$);`,
    `UPDATE public.processos SET conteudo = $j$${j}$j$::jsonb, objetivo = $o$${p.objetivo}$o$, categoria = COALESCE(categoria, ${cat}), frequencia = COALESCE(frequencia, ${freq}) WHERE titulo = $t$${p.titulo}$t$;`,
    "",
  );
}

writeFileSync(new URL("../supabase/migrations/20260714140000_processos_conteudo_seed.sql", import.meta.url), linhas.join("\n"));
console.log("Migration gerada: supabase/migrations/20260714140000_processos_conteudo_seed.sql");
