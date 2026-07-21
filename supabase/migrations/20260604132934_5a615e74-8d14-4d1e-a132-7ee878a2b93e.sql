
INSERT INTO public.contract_templates (nome, descricao, conteudo_html, ativo)
VALUES (
'Nave 2026 — Pacientes antigos (Legal Design)',
'Contrato de prestação de serviços psicopedagógicos com identidade visual Nave.',
$HTML$
<style>
  .nave-contrato { font-family: 'Inter', -apple-system, sans-serif; color: #2D3E50; line-height: 1.6; }
  .nave-contrato .faixa { display:flex; height:14px; margin: -16px -16px 28px; }
  .nave-contrato .faixa span { flex:1; }
  .nave-contrato .faixa .b { background:#5780A1; flex:1.5; }
  .nave-contrato .faixa .w1 { background:transparent; flex:0.5; }
  .nave-contrato .faixa .p { background:#D2A8B7; flex:2.5; }
  .nave-contrato .faixa .w2 { background:transparent; flex:0.5; }
  .nave-contrato .faixa .y { background:#E8C04D; flex:1.5; }
  .nave-contrato h1.capa { font-style: italic; color:#2D3E50; font-size: 2rem; text-align:center; margin: 60px 0 8px; font-weight:700; }
  .nave-contrato .capa-sub { text-align:center; color:#5A6B7C; font-size: 1.1rem; margin-bottom: 8px; }
  .nave-contrato .capa-ano { text-align:center; color:#2D3E50; font-size: 1.4rem; margin: 24px 0 60px; font-style:italic; font-weight:600; }
  .nave-contrato h2.secao {
    color: #1E4A6E; font-style: italic; font-weight: 800; text-transform: uppercase;
    font-size: 1.05rem; letter-spacing: 0.02em; padding-bottom: 6px;
    border-bottom: 2px solid #1E4A6E; margin: 32px 0 18px;
  }
  .nave-contrato .clausula { margin-bottom: 14px; }
  .nave-contrato .clausula strong { color: #1E4A6E; }
  .nave-contrato .card { border-radius: 14px; padding: 16px 20px; margin: 14px 0; }
  .nave-contrato .card-azul { background:#DCE7EF; border:1px solid #B7CCDA; color:#1E4A6E; }
  .nave-contrato .card-rosa { background:#F2DFE5; border:1px solid #DFBDC8; color:#7A3F52; }
  .nave-contrato .card-amarelo { background:#FBF1D4; border:1px solid #ECD898; color:#6B5418; }
  .nave-contrato .tag { display:inline-block; padding: 6px 14px; border-radius: 10px 10px 0 0; font-weight: 700; color:#fff; font-size: 0.85rem; }
  .nave-contrato .tag-azul { background:#5780A1; }
  .nave-contrato .tag-rosa { background:#C48BA0; }
  .nave-contrato .tag-amarelo { background:#D4A82C; color:#3a2d05; }
  .nave-contrato .pill-card { margin: 14px 0; }
  .nave-contrato .pill-card .corpo { padding: 14px 18px; border-radius: 0 12px 12px 12px; }
  .nave-contrato .pill-card.azul .corpo { background:#DCE7EF; }
  .nave-contrato .pill-card.rosa .corpo { background:#F2DFE5; }
  .nave-contrato ul.lista-icones { list-style:none; padding:0; margin: 10px 0; }
  .nave-contrato ul.lista-icones li { padding: 6px 0 6px 28px; position:relative; }
  .nave-contrato ul.lista-icones li::before {
    content:""; position:absolute; left:0; top:14px; width:14px; height:14px;
    border-radius:50%; background:#D2A8B7; box-shadow: inset 0 0 0 3px #fff;
    border: 2px solid #C48BA0;
  }
  .nave-contrato blockquote.info {
    border-left: 4px solid #5780A1; background:#F1F6F9; padding: 12px 16px;
    margin: 16px 0; border-radius: 0 10px 10px 0; color:#1E4A6E;
  }
  .nave-contrato blockquote.alerta {
    border-left: 4px solid #E8C04D; background:#FDF7E2; padding: 12px 16px;
    margin: 16px 0; border-radius: 0 10px 10px 0; color:#6B5418;
  }
  .nave-contrato .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .nave-contrato .tabela { width:100%; border-collapse: separate; border-spacing: 0; margin: 12px 0; border-radius: 12px; overflow:hidden; }
  .nave-contrato .tabela td { padding: 10px 14px; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .nave-contrato .tabela tr:last-child td { border-bottom: none; font-weight:700; }
  .nave-contrato .assinaturas { display:grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
  .nave-contrato .linha-assin { border-top: 1px solid #2D3E50; padding-top: 8px; text-align:center; font-size:0.85rem; color:#2D3E50; }
  .nave-contrato .identificacao { background:#F8F4F1; border-radius: 14px; padding: 20px 24px; margin: 16px 0; }
  .nave-contrato .quebra { page-break-after: always; height: 1px; }
  @media print {
    .nave-contrato .faixa { display:flex !important; }
  }
</style>

<div class="nave-contrato">
  <div class="faixa"><span class="b"></span><span class="w1"></span><span class="p"></span><span class="w2"></span><span class="y"></span></div>

  <!-- CAPA -->
  <h1 class="capa">Contrato de Prestação de Serviços</h1>
  <p class="capa-sub">Acompanhamento psicopedagógico</p>
  <p class="capa-ano">{{ano_contrato}}</p>

  <div class="quebra"></div>

  <!-- IDENTIFICAÇÃO -->
  <h2 class="secao">Identificação das partes</h2>

  <div class="identificacao">
    <p><strong style="color:#1E4A6E">CONTRATADA:</strong><br/>
      <strong>NAVE APRENDIZAGEM E DESENVOLVIMENTO</strong><br/>
      CNPJ: 54.339.058/0001-93<br/>
      Endereço: Rua Professor Alfredo Gonçalves Figueira, 18 — sala 402 A, Centro — Nilópolis/RJ — CEP 26525-060<br/>
      Responsável: Gabrielly Seabra
    </p>
  </div>

  <div class="identificacao" style="background:#EFF4F7">
    <p><strong style="color:#1E4A6E">CONTRATANTE:</strong><br/>
      <strong>{{responsavel.nome}}</strong><br/>
      CPF: {{responsavel.cpf}}<br/>
      E-mail: {{responsavel.email}} &nbsp;·&nbsp; Telefone: {{responsavel.telefone}}<br/>
      Responsável legal por <strong>{{paciente.nome}}</strong>
    </p>
  </div>

  <blockquote class="info">
    Este contrato estabelece as condições para o acompanhamento psicopedagógico profissional,
    promovendo um trabalho ético e colaborativo. Leia com atenção. Se tiver dúvidas, converse
    com a profissional antes de assinar.
  </blockquote>

  <!-- OBJETIVO -->
  <h2 class="secao">Qual é o objetivo deste contrato?</h2>
  <p class="clausula"><strong>Cláusula 1ª:</strong> O presente contrato formaliza a prestação de serviços profissionais
  especializados em atendimentos psicopedagógicos pela CONTRATADA, conforme as especificações a seguir:</p>

  <div class="pill-card azul">
    <span class="tag tag-azul">Avaliação — Plano Jornada</span>
    <div class="corpo">
      <ul class="lista-icones">
        <li>Sessões presenciais com o(a) paciente: total de 7 a 8 sessões.</li>
        <li>Anamnese com a família: presencial ou online, para coleta de histórico do desenvolvimento.</li>
        <li>Visita escolar / observação em contexto escolar (quando aplicável).</li>
        <li>Reunião com outros profissionais que acompanham a criança (online).</li>
        <li>Relatório de avaliação: físico e em PDF, entregue ao final da avaliação.</li>
        <li>Sessão de devolutiva com a família para apresentação dos resultados.</li>
      </ul>
      <blockquote class="info" style="margin-top:8px">
        O relatório será entregue em prazo mínimo de 3 semanas e máximo de 4 semanas após o último atendimento da avaliação.
      </blockquote>
    </div>
  </div>

  <div class="pill-card rosa">
    <span class="tag tag-rosa">Acompanhamento interventivo — Plano Jornada</span>
    <div class="corpo">
      <ul class="lista-icones">
        <li><strong>Sessões presenciais</strong> com frequência de 1 encontro semanal de 50 minutos.</li>
        <li><strong>Plano terapêutico individualizado.</strong></li>
        <li><strong>Acompanhamento com escola e outros profissionais:</strong> 2 reuniões presenciais/ano e pelo WhatsApp.</li>
        <li><strong>Reunião de alinhamento familiar:</strong> a cada 6 meses e orientações contínuas.</li>
        <li><strong>Tarefas de fortalecimento para casa:</strong> materiais impressos entregues após as sessões.</li>
        <li><strong>Plataforma de aulas</strong> para aprimoramento da família.</li>
        <li><strong>Ferramentas de agentes de IA</strong> para auxiliar o suporte familiar.</li>
      </ul>
      <blockquote class="alerta">
        Todas as reuniões com escola, outros profissionais e devolutivas com a família já estão incluídas na mensalidade.
        É paga uma única mensalidade fixa com acesso a tudo.
      </blockquote>
    </div>
  </div>

  <div class="quebra"></div>

  <!-- PAGAMENTO -->
  <h2 class="secao">Como será realizado o pagamento?</h2>
  <p class="clausula"><strong>Cláusula 2ª:</strong> O acompanhamento psicopedagógico deverá ser remunerado conforme descrito abaixo:</p>

  <div class="grid-2">
    <div class="pill-card rosa" style="margin:0">
      <span class="tag tag-rosa">Valor mensal</span>
      <div class="corpo">
        <p style="margin:0"><strong>{{numero_parcelas}} parcelas de R$ {{valor_acordado}}</strong></p>
        <p style="margin:4px 0 0; font-size:0.9rem"><strong>Quando:</strong> Em data acordada previamente com a CONTRATANTE.<br/>
        <strong>Formato:</strong> Mensalidade</p>
      </div>
    </div>
    <div class="pill-card azul" style="margin:0">
      <span class="tag tag-azul">Frequência</span>
      <div class="corpo">
        <p style="margin:0"><strong>{{modalidade}}</strong><br/>
        1x semanal (4 a 5 sessões/mês)</p>
      </div>
    </div>
  </div>

  <p class="clausula"><strong>Parágrafo primeiro:</strong> O pagamento deverá ser realizado via plataforma de pagamento InfinitePay.</p>
  <p class="clausula"><strong>Parágrafo segundo:</strong> O pagamento dos meses de Janeiro, Julho e Dezembro deve ser realizado de forma integral. Não serão aplicados descontos ou abatimentos (ver cálculo da mensalidade a seguir).</p>
  <p class="clausula"><strong>Parágrafo terceiro:</strong> O atraso do pagamento do valor mensal na data de vencimento estipulada acarretará juros de 1% ao mês e multa de R$ 30,00. Em caso de inadimplência, os atendimentos serão interrompidos após atraso pelo 2º mês consecutivo.</p>
  <p class="clausula"><strong>Parágrafo quarto:</strong> O valor dos serviços prestados será ajustado anualmente com base na variação de um índice econômico de referência, considerando o período de 12 meses anteriores ao reajuste e incluindo um ajuste complementar. O <strong>reajuste</strong> será realizado em <strong>Fevereiro</strong> (pacientes iniciados no 1º semestre) ou <strong>Agosto</strong> (pacientes que iniciaram no 2º semestre).</p>

  <div class="quebra"></div>

  <!-- CÁLCULO -->
  <h2 class="secao">Como é calculado o valor da mensalidade?</h2>
  <p>A mensalidade é calculada considerando 12 meses de trabalho.</p>

  <div class="pill-card azul">
    <span class="tag tag-azul">Cálculo transparente</span>
    <div class="corpo">
      <table class="tabela">
        <tr><td><strong>1 ano tem</strong></td><td style="text-align:right"><strong>52 semanas</strong></td></tr>
        <tr><td>Menos: férias (janeiro, julho e dezembro)</td><td style="text-align:right">− 6 semanas</td></tr>
        <tr><td>Menos: feriados ao longo do ano</td><td style="text-align:right">− 2 semanas</td></tr>
        <tr><td><strong>Resultado: semanas de atendimento</strong></td><td style="text-align:right"><strong>44 semanas</strong></td></tr>
      </table>
      <blockquote class="alerta" style="margin-top:8px">
        ⚠ Você não paga pelas férias e feriados. Paga apenas pelas semanas em que há atendimento.
      </blockquote>
    </div>
  </div>

  <div class="pill-card rosa">
    <span class="tag tag-rosa">Cálculo final</span>
    <div class="corpo">
      <table class="tabela">
        <tr><td><strong>44 semanas de atendimento</strong></td><td style="text-align:right"><strong>44 horas</strong></td></tr>
        <tr><td>Mais 6 reuniões (média de 1h a 1h30 cada)</td><td style="text-align:right">+ 6 horas</td></tr>
        <tr><td><strong>Total de horas do ano — dividido em 12 meses</strong></td><td style="text-align:right"><strong>= Valor da mensalidade</strong></td></tr>
      </table>
      <blockquote class="info" style="margin-top:8px">
        ✓ Valor fixo mensal. Incluído: atendimentos, reuniões e devolutivas.
      </blockquote>
    </div>
  </div>

  <div class="quebra"></div>

  <!-- ROTINA -->
  <h2 class="secao">Rotina de atividades</h2>
  <p class="clausula"><strong>Cláusula 3ª:</strong> Esta cláusula estabelece as normas referentes à rotina de atividades, incluindo duração das sessões, regras para cancelamento e reposição, períodos de recesso e demais condições específicas relacionadas à organização e execução dos atendimentos contratados.</p>

  <div class="card card-azul">
    <strong>Duração das sessões — 3.1</strong>
    <p style="margin:6px 0 0">As sessões terão duração de <strong>50 minutos</strong>, sendo de responsabilidade do responsável pelo paciente garantir a pontualidade. <strong>O responsável deve chegar 5 minutos antes do término da sessão</strong>, evitando interferências no horário do próximo atendimento.</p>
  </div>

  <div class="card card-rosa">
    <strong>Cancelamentos e reposição — 3.2</strong>
    <p style="margin:6px 0 0">O cancelamento de uma sessão deve ser comunicado com, no mínimo, 5 horas de antecedência para viabilizar a reposição, que poderá ser agendada dentro de um prazo de 30 dias, conforme disponibilidade da profissional.</p>
    <p style="margin:6px 0 0; font-style:italic">Sessões não canceladas dentro do prazo ou com ausência não justificada serão cobradas normalmente, sem direito à reposição, pois o horário foi reservado exclusivamente para o paciente.</p>
  </div>

  <div class="card card-amarelo">
    <strong>Ausências consecutivas — 3.3</strong>
    <p style="margin:6px 0 0">O não comparecimento sem justificativa por 3 sessões consecutivas implicará na liberação do horário reservado.</p>
  </div>

  <div class="card card-azul">
    <strong>Feriados e período de recesso — 3.4 e 3.5</strong>
    <p style="margin:6px 0 0">Sessões coincidentes com <strong>feriados</strong> não serão realizadas nem repostas, pois esses períodos já foram considerados no cálculo da mensalidade.</p>
    <ul style="margin:8px 0 0">
      <li>Janeiro: 2 primeiras semanas (férias)</li>
      <li>Julho: 2 últimas semanas (recesso)</li>
      <li>Dezembro: 2 últimas semanas (férias)</li>
      <li>Feriados: −2 semanas/ano (conforme calendário)</li>
    </ul>
  </div>

  <div class="card card-rosa">
    <strong>Responsabilidades da profissional — 3.6</strong>
    <p style="margin:6px 0 0">Não é de responsabilidade da profissional realizar:</p>
    <ul>
      <li>Tarefas escolares ou preparo para provas</li>
      <li>Diagnóstico médico ou prescrição de medicamentos</li>
      <li>Atendimentos fora do horário contratado</li>
    </ul>
  </div>

  <div class="card card-amarelo">
    <strong>Propriedade dos materiais e conservação — 3.7</strong>
    <p style="margin:6px 0 0">Os materiais utilizados nos atendimentos são de propriedade da profissional. O paciente deverá cuidar e conservar os materiais e o espaço. Caso cause algum dano, o responsável será comunicado para que o valor seja ressarcido.</p>
  </div>

  <div class="quebra"></div>

  <!-- REAVALIAÇÃO + SIGILO -->
  <h2 class="secao">Reavaliação periódica</h2>
  <p class="clausula"><strong>Cláusula 4ª:</strong> A cada 12 meses, reavaliamos o plano terapêutico. A reavaliação periódica está incluída na mensalidade (sem custo extra).</p>
  <div class="card card-azul">
    <strong>Pode resultar em:</strong>
    <ul>
      <li>Continuidade do plano atual</li>
      <li>Alterações na frequência</li>
      <li>Mudanças no escopo do acompanhamento</li>
      <li>Encaminhamento para outros profissionais</li>
    </ul>
  </div>

  <h2 class="secao">Sigilo profissional</h2>
  <p class="clausula"><strong>Cláusula 5ª:</strong> Mantemos o sigilo absoluto sobre todas as informações coletadas durante o atendimento. Salvo exceções em que o sigilo pode ser quebrado:</p>
  <div class="card card-rosa">
    <ul style="margin:0">
      <li>Risco iminente de vida</li>
      <li>Ordem judicial</li>
      <li>Abuso ou negligência infantil</li>
      <li>Situações de segurança pública</li>
    </ul>
  </div>

  <div class="quebra"></div>

  <!-- OBRIGAÇÕES -->
  <h2 class="secao">Obrigação das partes</h2>
  <p class="clausula"><strong>Cláusula 6ª:</strong> A CONTRATADA compromete-se a prestar os serviços descritos neste contrato com dedicação, ética e profissionalismo, utilizando metodologias adequadas para o desenvolvimento do paciente. Contudo, a evolução do paciente está diretamente vinculada à colaboração e comprometimento da família no cumprimento das orientações fornecidas.</p>

  <div class="pill-card rosa">
    <span class="tag tag-rosa">Colaboração e adesão dos responsáveis</span>
    <div class="corpo">
      <ul>
        <li>Seguir as orientações da profissional e assumir comprometimento terapêutico</li>
        <li>Participar das reuniões de devolutiva</li>
        <li>Realizar atividades complementares quando solicitadas</li>
        <li>Buscar os profissionais de apoio complementar quando encaminhados</li>
        <li>Comunicar mudanças relevantes (escola, diagnósticos, medicações)</li>
        <li>Manter a frequência acordada</li>
        <li>Avisar com antecedência sobre cancelamentos</li>
      </ul>
    </div>
  </div>

  <div class="pill-card azul">
    <span class="tag tag-azul">Da profissional</span>
    <div class="corpo">
      <ul>
        <li>Prestar os serviços contratados com ética, qualidade e sigilo</li>
        <li>Manter a confidencialidade das informações pessoais e dos atendimentos, conforme a LGPD</li>
        <li>Oferecer relatórios e orientações quando necessário, conforme estipulado no contrato</li>
        <li>Repor sessões canceladas pela profissional em caso de impossibilidade de atendimento</li>
      </ul>
    </div>
  </div>

  <blockquote class="alerta">
    Não garantimos sucesso ou melhora do paciente, resultados específicos em prazos determinados,
    diagnóstico ou cura de qualquer condição, pois o resultado depende de múltiplos fatores.
  </blockquote>

  <div class="quebra"></div>

  <!-- RESCISÃO -->
  <h2 class="secao">Rescisão e encerramento</h2>
  <p class="clausula"><strong>Cláusula 7ª:</strong> Ficam estabelecidas as condições gerais que preveem rescisão, interrupção dos atendimentos e demais situações que possam impactar a execução dos serviços contratados.</p>

  <div class="card card-azul">
    <strong>Rescisão pelo CONTRATANTE</strong>
    <p><strong>Parágrafo primeiro:</strong> O CONTRATANTE poderá encerrar o contrato mediante aviso prévio de 30 dias.</p>
    <p><strong>Parágrafo segundo:</strong> O mês em curso será pago integralmente, com garantia das sessões até o fim do período.</p>
    <p style="margin-bottom:0"><strong>Parágrafo terceiro:</strong> Não haverá devolução de valores referentes a sessões já realizadas.</p>
  </div>

  <div class="card card-rosa">
    <strong>Rescisão pela CONTRATADA</strong>
    <p style="margin-bottom:0"><strong>Parágrafo quarto:</strong> A CONTRATADA poderá rescindir o contrato em casos de inadimplência, falta de adesão ao plano terapêutico ou condutas que inviabilizem o atendimento, mediante aviso prévio de 15 dias e devolutiva à família.</p>
  </div>

  <div class="card card-amarelo">
    <strong>Interrupção em Dezembro / Janeiro</strong>
    <p><strong>Parágrafo quinto:</strong> Se a família optar por interromper o acompanhamento em Dezembro e Janeiro, o contrato será encerrado e o horário deixará de ser reservado.</p>
    <p style="margin-bottom:0"><strong>Parágrafo sexto:</strong> O retorno dependerá de nova contratação e assinatura de contrato com valores vigentes para novos pacientes (sem valor promocional de pacientes antigos).</p>
  </div>

  <div class="quebra"></div>

  <!-- ASSINATURA -->
  <h2 class="secao">Assinatura eletrônica</h2>
  <p class="clausula"><strong>Cláusula 8ª:</strong> As partes concordam e reconhecem como válidas as manifestações de vontade emitidas neste contrato em formato eletrônico. Nos moldes do §2º do art. 10 da Medida Provisória nº 2.200-2/2001, serão admitidos todos os meios legais de comprovação de autoria e integridade dos documentos em formato eletrônico.</p>
  <p>Contrato válido para o ano de <strong>{{ano_contrato}}</strong>.</p>
  <p style="margin-top:16px">{{cidade}}, {{data_hoje}}.</p>

  <div class="assinaturas">
    <div class="linha-assin">CONTRATADA<br/><span style="color:#5A6B7C">Nave Aprendizagem e Desenvolvimento</span></div>
    <div class="linha-assin">CONTRATANTE<br/><span style="color:#5A6B7C">{{responsavel.nome}}</span></div>
  </div>
</div>
$HTML$,
true);
