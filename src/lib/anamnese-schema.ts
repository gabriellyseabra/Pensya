/**
 * Schema declarativo da Anamnese Inteligente.
 * Cada seção define seus campos; o componente <SecaoAccordion /> renderiza
 * dinamicamente a partir desta estrutura. Mantenha campos curtos e estruturados.
 */

export type CampoTipo =
  | "text"
  | "textarea"
  | "select"
  | "multi"
  | "chips"
  | "radio"
  | "scale"
  | "date"
  | "number"
  | "boolean";

export interface CampoDef {
  key: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[];
  placeholder?: string;
  /** Quando true, mostra "observações" opcionais junto */
  obs?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  /** Rótulos das 5 faixas da escala (0 / 1–3 / 4–6 / 7–9 / 10), específicos do que o campo mede. */
  escalaLabels?: [string, string, string, string, string];
  /**
   * Só exibe este campo quando a condição (outro campo da MESMA seção) for satisfeita.
   * - `igualA`: valor exato ou um dos valores. Use `true` para campos do tipo boolean.
   * - `inclui`: o campo dependente (chips/multi, um array) contém este valor.
   */
  condicao?: { campo: string; igualA?: string | boolean | (string | boolean)[]; inclui?: string };
}

export interface SecaoDef {
  key: string;
  titulo: string;
  descricao?: string;
  campos: CampoDef[];
}

const SIM_NAO_PARCIAL = ["Sim", "Não", "Parcialmente", "Não sei"];

/** Conjuntos de rótulos para campos de escala (0 / 1–3 / 4–6 / 7–9 / 10), agrupados por semântica. */
const ESCALA_DESEMPENHO: [string, string, string, string, string] =
  ["Muito abaixo do esperado", "Abaixo do esperado", "Dentro do esperado", "Acima do esperado", "Muito acima do esperado"];
const ESCALA_QUALIDADE: [string, string, string, string, string] =
  ["Muito comprometida", "Comprometida", "Adequada", "Boa", "Muito boa"];
const ESCALA_FORCA: [string, string, string, string, string] =
  ["Inexistente", "Fraca", "Moderada", "Forte", "Muito forte"];
const ESCALA_DIFICULDADE: [string, string, string, string, string] =
  ["Muito difícil", "Difícil", "Regular", "Boa", "Muito boa"];
const ESCALA_INTERESSE: [string, string, string, string, string] =
  ["Nenhum interesse", "Pouco interesse", "Interesse moderado", "Bom interesse", "Muito interessado"];
const ESCALA_ESTRUTURA: [string, string, string, string, string] =
  ["Caótica", "Pouco estruturada", "Moderadamente estruturada", "Estruturada", "Muito estruturada"];
const ESCALA_AUTONOMIA: [string, string, string, string, string] =
  ["Totalmente dependente", "Necessita muita ajuda", "Necessita ajuda parcial", "Quase independente", "Totalmente independente"];
const ESCALA_FREQUENCIA: [string, string, string, string, string] =
  ["Nenhuma", "Rara", "Às vezes", "Frequente", "Sempre"];
const ESCALA_NIVEL: [string, string, string, string, string] =
  ["Muito baixa", "Baixa", "Moderada", "Boa", "Muito boa"];

export const ANAMNESE_SECOES: SecaoDef[] = [
  {
    key: "identificacao",
    titulo: "Identificação",
    descricao: "Dados básicos do paciente.",
    campos: [
      { key: "nome_completo", label: "Nome completo", tipo: "text" },
      { key: "data_nascimento", label: "Data de nascimento", tipo: "date" },
      { key: "genero", label: "Gênero", tipo: "select", opcoes: ["Feminino", "Masculino", "Não-binário", "Prefere não informar"] },
      { key: "lateralidade", label: "Lateralidade", tipo: "radio", opcoes: ["Destro", "Canhoto", "Ambidestro", "Em definição"] },
      { key: "naturalidade", label: "Naturalidade", tipo: "text" },
    ],
  },
  {
    key: "queixa_principal",
    titulo: "Queixa principal",
    descricao: "O que motivou a busca por avaliação.",
    campos: [
      { key: "queixa", label: "Queixa relatada", tipo: "textarea", placeholder: "Descreva com as palavras do responsável." },
      { key: "tempo_evolucao", label: "Há quanto tempo?", tipo: "select", opcoes: ["< 6 meses", "6 a 12 meses", "1 a 2 anos", "> 2 anos", "Desde sempre"] },
      { key: "quem_identificou", label: "Quem percebeu primeiro", tipo: "chips", opcoes: ["Família", "Escola", "Pediatra", "Outro profissional", "O próprio paciente"] },
      { key: "ambientes", label: "Em quais ambientes aparece com mais frequência", tipo: "multi", opcoes: ["Casa", "Escola", "Terapias", "Locais públicos", "Com outras crianças", "Em mudanças de rotina", "Outros"] },
      { key: "frequencia", label: "Acontece todos os dias ou em situações específicas?", tipo: "select", opcoes: ["Todos os dias", "Algumas vezes na semana", "Apenas em situações específicas"] },
      { key: "situacoes_melhora", label: "O que costuma melhorar o comportamento/desempenho", tipo: "multi", opcoes: ["Rotina previsível", "Apoio individual", "Pausas", "Brincadeiras", "Reforço positivo", "Ambiente silencioso", "Presença de adulto de confiança", "Outros"] },
      { key: "situacoes_piora", label: "O que costuma piorar a dificuldade", tipo: "multi", opcoes: ["Cansaço", "Frustração", "Barulho", "Muitas pessoas", "Tarefas escolares", "Mudança de rotina", "Cobrança", "Separação dos pais", "Uso de telas", "Outros"] },
      { key: "regressao", label: "A família percebe regressão ou perda de habilidades já adquiridas?", tipo: "boolean" },
      { key: "expectativas", label: "Expectativas da família", tipo: "textarea", placeholder: "O que a família espera deste processo." },
    ],
  },
  {
    key: "contexto_familiar",
    titulo: "Contexto familiar",
    campos: [
      { key: "configuracao", label: "Configuração familiar", tipo: "select", opcoes: ["Nuclear", "Monoparental", "Família estendida", "Adotiva", "Outra"] },
      { key: "estrutura_familiar", label: "Estrutura familiar (com quem mora)", tipo: "textarea", placeholder: "Quem vive com a criança." },
      { key: "irmaos", label: "Irmãos", tipo: "number" },
      { key: "rede_apoio", label: "Rede de apoio", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_FORCA },
      { key: "rotina_estruturada", label: "Rotina familiar estruturada?", tipo: "radio", opcoes: SIM_NAO_PARCIAL },
      { key: "relacao_responsaveis", label: "Relação da criança com os responsáveis", tipo: "select", opcoes: ["Tranquila", "Dependente", "Conflituosa", "Oscilante", "Outra"] },
      { key: "quem_acompanha_tarefas", label: "Quem acompanha as tarefas escolares em casa", tipo: "multi", opcoes: ["Mãe", "Pai", "Responsável", "Irmãos", "Professor particular", "Ninguém", "Outro"] },
      { key: "lida_com_comportamento", label: "Como a família lida com dificuldades de comportamento", tipo: "multi", opcoes: ["Conversa", "Repreensão", "Castigo", "Retirada de tela", "Reforço positivo", "Ignora", "Busca acolher", "Outro"] },
      { key: "historico_familiar", label: "Histórico familiar relevante", tipo: "chips", opcoes: ["TDAH", "TEA", "Dislexia", "Ansiedade", "Depressão", "Deficiência intelectual", "Epilepsia", "Dificuldade de aprendizagem", "Outro"] },
      { key: "situacao_marcante", label: "Passou por situação emocionalmente marcante?", tipo: "boolean" },
      { key: "situacao_marcante_qual", label: "Qual situação?", tipo: "textarea", condicao: { campo: "situacao_marcante", igualA: true } },
      { key: "mudancas_recentes", label: "Mudanças recentes na vida da criança", tipo: "multi", opcoes: ["Mudança de escola", "Mudança de casa", "Separação dos pais", "Nascimento de irmão", "Luto", "Internação", "Adoecimento familiar", "Outro"] },
      { key: "preocupacoes", label: "Maiores preocupações da família neste momento", tipo: "textarea" },
      { key: "observacoes", label: "Observações", tipo: "textarea", obs: true },
    ],
  },
  {
    key: "gestacao",
    titulo: "História gestacional e perinatal",
    campos: [
      { key: "tipo_gravidez", label: "Tipo de gravidez", tipo: "select", opcoes: ["Planejada", "Não planejada", "Desconhecido"] },
      { key: "gestacao_planejada", label: "Gestação planejada", tipo: "radio", opcoes: ["Sim", "Não"] },
      { key: "pre_natal", label: "Fez pré-natal", tipo: "radio", opcoes: SIM_NAO_PARCIAL },
      { key: "intercorrencias_gestacao", label: "Intercorrências na gestação", tipo: "chips", opcoes: ["Nenhuma", "Hipertensão", "Diabetes gestacional", "Uso de medicação", "Estresse importante", "Sangramento", "Outro"] },
      { key: "tipo_parto", label: "Tipo de parto", tipo: "radio", opcoes: ["Normal", "Cesárea", "Fórceps", "Desconhecido"] },
      { key: "intercorrencias_parto", label: "Intercorrências no parto/pós-parto", tipo: "chips", opcoes: ["Nenhuma", "Sofrimento fetal", "Anóxia", "UTI neonatal", "Icterícia", "Hipoglicemia", "Outro"] },
      { key: "prematuro", label: "Prematuridade", tipo: "select", opcoes: ["Não", "Leve (32–36 semanas)", "Moderado (28–31 semanas)", "Extremo (< 28 semanas)"] },
      { key: "idade_gestacional", label: "Idade gestacional (semanas)", tipo: "number" },
      { key: "peso_nascimento", label: "Peso ao nascer (kg)", tipo: "number" },
      { key: "comprimento_nascimento", label: "Comprimento ao nascer (cm)", tipo: "number" },
      { key: "apgar", label: "APGAR (1º / 5º min)", tipo: "text", placeholder: "Ex: 8/9" },
      { key: "dificuldades_primeiros_meses", label: "Dificuldades importantes nos primeiros meses", tipo: "multi", opcoes: ["Sono", "Alimentação", "Choro excessivo", "Refluxo", "Irritabilidade", "Pouca interação", "Nenhuma", "Outros"] },
      { key: "acompanhamento_especializado", label: "Teve acompanhamento médico especializado nos primeiros anos?", tipo: "boolean" },
    ],
  },
  {
    key: "desenvolvimento",
    titulo: "Desenvolvimento neuropsicomotor",
    campos: [
      { key: "sustentou_cabeca", label: "Sustentou cabeça", tipo: "select", opcoes: ["Antes dos 3m", "3-4m", "5-6m", "> 6m", "Não sei"] },
      { key: "sentou", label: "Sentou", tipo: "select", opcoes: ["Antes dos 6m", "6-8m", "9-12m", "> 12m", "Não sei"] },
      { key: "andou", label: "Andou", tipo: "select", opcoes: ["< 12m", "12-15m", "15-18m", "> 18m", "Não sei"] },
      { key: "marcos_atrasados", label: "Marcos com atraso percebido", tipo: "chips", opcoes: ["Motor grosso", "Motor fino", "Linguagem", "Social", "Cognitivo", "Nenhum"] },
    ],
  },
  {
    key: "linguagem",
    titulo: "Linguagem",
    campos: [
      { key: "primeiras_palavras", label: "Primeiras palavras", tipo: "select", opcoes: ["< 12m", "12-18m", "18-24m", "> 24m", "Ainda não"] },
      { key: "frases", label: "Primeiras frases", tipo: "select", opcoes: ["< 24m", "24-36m", "> 36m", "Ainda não"] },
      { key: "compreensao", label: "Compreensão atual", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DESEMPENHO },
      { key: "expressao", label: "Expressão atual", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DESEMPENHO },
      { key: "compreende_figurado", label: "Compreende piadas, metáforas ou duplo sentido (para a idade)?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não", "Não se aplica"] },
      { key: "mantem_conversa", label: "Mantém conversa com começo, meio e fim?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "instrucoes_simples", label: "Entende instruções simples?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "instrucoes_etapas", label: "Entende instruções com 2+ etapas?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "intencao_comunicativa", label: "Demonstra intenção comunicativa", tipo: "multi", opcoes: ["Procura o adulto", "Pede ajuda", "Mostra objetos", "Compartilha interesses", "Tem pouca iniciativa"] },
      { key: "usa_gestos", label: "Usa gestos, apontar ou expressões para se comunicar?", tipo: "select", opcoes: ["Sim", "Pouco", "Não"] },
      { key: "dificuldade_nomear", label: "Dificuldade para nomear objetos, pessoas ou ações?", tipo: "select", opcoes: ["Não", "Sim", "Às vezes"] },
      { key: "conta_acontecimentos", label: "Consegue contar acontecimentos do dia a dia?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "alteracoes", label: "Alterações observadas", tipo: "chips", opcoes: ["Troca de fonemas", "Gagueira", "Vocabulário pobre", "Dificuldade narrativa", "Ecolalia", "Mutismo seletivo", "Nenhuma"] },
    ],
  },
  {
    key: "motor",
    titulo: "Aspectos motores",
    campos: [
      { key: "coordenacao_global", label: "Coordenação global", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_QUALIDADE },
      { key: "coordenacao_fina", label: "Coordenação fina", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_QUALIDADE },
      { key: "equilibrio", label: "Equilíbrio", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_QUALIDADE },
      { key: "dificuldades", label: "Dificuldades motoras", tipo: "chips", opcoes: ["Amarrar cadarço", "Pular com um pé", "Andar de bicicleta", "Escrita", "Recorte", "Nenhuma"] },
    ],
  },
  {
    key: "sensorial",
    titulo: "Sensorialidade e comportamento adaptativo",
    campos: [
      { key: "auditivo", label: "Sensibilidade auditiva", tipo: "radio", opcoes: ["Hipo", "Típica", "Hiper"] },
      { key: "visual", label: "Sensibilidade visual", tipo: "radio", opcoes: ["Hipo", "Típica", "Hiper"] },
      { key: "tato", label: "Sensibilidade tátil", tipo: "radio", opcoes: ["Hipo", "Típica", "Hiper"] },
      { key: "interesses_restritos", label: "Tem interesses muito intensos ou restritos por algum tema/objeto?", tipo: "boolean" },
      { key: "sensibilidade_luz", label: "Sensibilidade a luzes ou estímulos visuais?", tipo: "boolean" },
      { key: "incomodo_roupas", label: "Incomoda-se com etiquetas, tecidos, roupas, sapatos ou toque físico?", tipo: "boolean" },
      { key: "vestir", label: "Aversão a tecidos/roupas", tipo: "radio", opcoes: SIM_NAO_PARCIAL },
      { key: "evita_texturas", label: "Evita determinadas texturas em brinquedos, materiais ou alimentos?", tipo: "boolean" },
      { key: "busca_sensorial", label: "Busca estímulos sensoriais com frequência", tipo: "multi", opcoes: ["Gira objetos", "Cheira objetos", "Coloca objetos na boca", "Pula muito", "Balança o corpo", "Aperta objetos", "Busca contato físico intenso", "Nenhum"] },
      { key: "dificuldade_mudanca_rotina", label: "Apresenta dificuldade com mudanças de rotina?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "reacao_mudanca", label: "Como reage a mudança inesperada", tipo: "multi", opcoes: ["Aceita bem", "Fica irritado(a)", "Chora", "Faz birra", "Se isola", "Fica ansioso(a)", "Agride", "Outro"] },
      { key: "sensibilidade_sons", label: "Apresenta sensibilidade a sons?", tipo: "boolean" },
      { key: "movimentos_repetitivos", label: "Apresenta movimentos repetitivos?", tipo: "boolean" },
    ],
  },
  {
    key: "alimentacao",
    titulo: "Alimentação e seletividade",
    campos: [
      { key: "perfil", label: "Como é a alimentação", tipo: "select", opcoes: ["Variada", "Restrita", "Seletiva", "Muito seletiva", "Recusa muitos alimentos"] },
      { key: "seletividade", label: "Apresenta seletividade alimentar?", tipo: "boolean" },
      { key: "recusa_alimentos", label: "Quais tipos de alimentos costuma recusar", tipo: "multi", opcoes: ["Frutas", "Verduras", "Legumes", "Carnes", "Alimentos pastosos", "Alimentos crocantes", "Alimentos misturados", "Alimentos com cheiro forte", "Outros"], condicao: { campo: "seletividade", igualA: true } },
      { key: "dificuldade_textura", label: "Tem dificuldade com a textura dos alimentos?", tipo: "boolean", condicao: { campo: "seletividade", igualA: true } },
      { key: "aceita_novos", label: "Aceita experimentar alimentos novos?", tipo: "select", opcoes: ["Sim", "Às vezes", "Não"] },
      { key: "autonomia_alimentar", label: "Tem autonomia para se alimentar?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "engasgos", label: "Apresenta engasgos, náuseas ou vômitos com frequência?", tipo: "boolean" },
    ],
  },
  {
    key: "saude",
    titulo: "Saúde",
    campos: [
      { key: "condicoes", label: "Condições de saúde", tipo: "chips", opcoes: ["Nenhuma", "Asma", "Alergias", "Epilepsia", "Diabetes", "Cardiopatia", "Outra"] },
      { key: "medicacoes", label: "Medicações em uso", tipo: "textarea" },
      { key: "alergias", label: "Alergias", tipo: "text" },
      { key: "visao", label: "Visão", tipo: "select", opcoes: ["Normal", "Usa óculos", "Dificuldade não investigada", "Em investigação"] },
      { key: "audicao", label: "Audição", tipo: "select", opcoes: ["Normal", "Perda auditiva diagnosticada", "Dificuldade não investigada", "Em investigação"] },
      { key: "sono", label: "Sono", tipo: "select", opcoes: ["Adequado", "Demora a pegar no sono", "Desperta à noite", "Parassonias", "Inversão de ciclo"] },
      { key: "rotina_sono", label: "Tem rotina regular de sono?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "acorda_descansada", label: "Acorda descansada?", tipo: "select", opcoes: ["Sim", "Às vezes", "Não"] },
      { key: "sonolencia_diurna", label: "Durante o dia, apresenta sonolência, irritação ou cansaço excessivo?", tipo: "boolean" },
      { key: "convulsoes", label: "Apresenta crises convulsivas, desmaios ou episódios neurológicos?", tipo: "boolean" },
      { key: "dores_frequentes", label: "Queixas frequentes de dor", tipo: "multi", opcoes: ["Cabeça", "Barriga", "Pernas", "Ouvido", "Garganta", "Outra", "Não"] },
      { key: "avaliacoes_realizadas", label: "Já realizou avaliação especializada", tipo: "multi", opcoes: ["Neurológica", "Psiquiátrica", "Fonoaudiológica", "Psicológica", "Psicopedagógica", "Terapia ocupacional", "Nenhuma"] },
      { key: "controle_esfincteres", label: "Controle de esfíncteres", tipo: "select", opcoes: ["Adequado para idade", "Atrasado", "Em treino", "Ainda não"] },
    ],
  },
  {
    key: "historico_clinico",
    titulo: "Histórico clínico",
    campos: [
      { key: "tratamentos_anteriores", label: "Tratamentos anteriores", tipo: "chips", opcoes: ["Fonoaudiologia", "Terapia ocupacional", "Psicologia", "Psicopedagogia", "Neuropediatria", "Psiquiatria", "Fisioterapia"] },
      { key: "diagnosticos_previos", label: "Diagnósticos prévios", tipo: "textarea" },
      { key: "exames", label: "Exames realizados", tipo: "textarea" },
      { key: "medicacao_psiquiatrica", label: "Já usou medicação psiquiátrica?", tipo: "radio", opcoes: ["Sim", "Não"] },
    ],
  },
  {
    key: "escolar",
    titulo: "Antecedentes escolares",
    campos: [
      { key: "escola_atual", label: "Escola atual", tipo: "text" },
      { key: "serie", label: "Série/ano", tipo: "text" },
      { key: "tipo", label: "Tipo", tipo: "radio", opcoes: ["Pública", "Particular", "Homeschooling"] },
      { key: "adaptacao", label: "Adaptação escolar", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DIFICULDADE },
      { key: "trocas_escola", label: "Quantas escolas já frequentou", tipo: "number" },
      { key: "repetiu_ano", label: "Já repetiu de ano?", tipo: "select", opcoes: ["Não", "Sim — 1 vez", "Sim — 2 vezes ou mais"] },
      { key: "recebe_apoio", label: "Recebe apoio na escola?", tipo: "select", opcoes: ["Não", "Sim — reforço", "Sim — sala de recursos", "Sim — acompanhante terapêutico", "Sim — outro"] },
      { key: "frequencia_regular", label: "A frequência escolar é regular?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "participacao", label: "Participação nas atividades escolares", tipo: "select", opcoes: ["Participa bem", "Participa com apoio", "Evita atividades", "Recusa atividades", "Precisa de muita mediação"] },
      { key: "copia_quadro", label: "Consegue copiar do quadro?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não", "Não se aplica"] },
      { key: "acompanha_ritmo", label: "Acompanha o ritmo da turma?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "dificuldades_evidentes", label: "Dificuldades escolares mais evidentes", tipo: "multi", opcoes: ["Leitura", "Escrita", "Interpretação", "Matemática", "Atenção", "Memorização", "Organização", "Coordenação motora", "Comunicação", "Comportamento", "Socialização"] },
      { key: "resistencia_tarefas", label: "Resistência para realizar tarefas escolares?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "reacao_erro", label: "Como reage quando erra ou não consegue", tipo: "multi", opcoes: ["Tenta novamente", "Pede ajuda", "Chora", "Desiste", "Fica irritada", "Evita", "Diz que não sabe", "Outro"] },
      { key: "adaptacoes_escola", label: "A escola já fez adaptações/flexibilizações?", tipo: "boolean" },
      { key: "tem_laudo_pei", label: "Possui laudo, relatório escolar, PEI, PDI ou plano de acompanhamento?", tipo: "boolean" },
      { key: "queixas_escola", label: "Queixas da escola", tipo: "chips", opcoes: ["Atenção", "Comportamento", "Leitura", "Escrita", "Matemática", "Socialização", "Coordenação motora", "Nenhuma"] },
    ],
  },
  {
    key: "aprendizagem",
    titulo: "Aprendizagem",
    campos: [
      { key: "leitura", label: "Leitura", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DESEMPENHO },
      { key: "escrita", label: "Escrita", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DESEMPENHO },
      { key: "matematica", label: "Matemática", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_DESEMPENHO },
      { key: "interesse", label: "Interesse pelos estudos", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_INTERESSE },
      { key: "estrategias_que_funcionam", label: "Estratégias que funcionam", tipo: "chips", opcoes: ["Apoio visual", "Sequência clara", "Pausa frequente", "Repetição", "Mediação verbal", "Material concreto", "Tempo extra"] },
    ],
  },
  {
    key: "comportamento",
    titulo: "Comportamento e regulação emocional",
    campos: [
      { key: "humor", label: "Humor predominante", tipo: "select", opcoes: ["Estável", "Reativo", "Ansioso", "Triste", "Eufórico", "Oscilante"] },
      { key: "frustacao", label: "Tolerância à frustração", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_NIVEL },
      { key: "autorregulacao", label: "Autorregulação", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_QUALIDADE },
      { key: "inicia_tarefa", label: "Consegue iniciar uma tarefa sem muita ajuda?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "termina_tarefa", label: "Consegue terminar o que começa?", tipo: "select", opcoes: ["Sim", "Às vezes", "Não"] },
      { key: "distrai_facil", label: "Distrai-se com facilidade?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "espera_vez", label: "Dificuldade para esperar sua vez?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "explosoes", label: "Explosões emocionais ou baixa tolerância à frustração?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "perde_objetos", label: "Perde objetos ou esquece materiais com frequência?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "impulsividade", label: "Apresenta impulsividade?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "dificuldade_organizacao", label: "Dificuldade para organizar materiais, mochila ou rotina?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "durante_crise", label: "O que costuma acontecer durante uma crise ou birra", tipo: "multi", opcoes: ["Choro", "Gritos", "Agressividade", "Joga objetos", "Se isola", "Se joga no chão", "Fica rígido(a)", "Outro"] },
      { key: "ajuda_acalmar", label: "O que ajuda a criança a se acalmar", tipo: "multi", opcoes: ["Colo", "Conversa", "Silêncio", "Retirar estímulos", "Brinquedo específico", "Tempo sozinho(a)", "Música", "Respiração", "Outro"] },
      { key: "comportamentos", label: "Comportamentos observados", tipo: "chips", opcoes: ["Birra", "Choro fácil", "Agressividade", "Retraimento", "Hiperatividade", "Impulsividade", "Estereotipias", "Rituais", "Nenhum"] },
    ],
  },
  {
    key: "rotina",
    titulo: "Rotina e hábitos",
    campos: [
      { key: "estrutura_diaria", label: "Estrutura da rotina diária", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_ESTRUTURA },
      { key: "tempo_tela", label: "Tempo de tela diário", tipo: "select", opcoes: ["< 1h", "1-2h", "2-4h", "4-6h", "> 6h"] },
      { key: "quais_telas", label: "Quais telas usa com mais frequência", tipo: "multi", opcoes: ["Celular", "Tablet", "TV", "Computador", "Videogame"] },
      { key: "tela_interfere", label: "O uso de tela interfere no sono, alimentação, comportamento ou estudos?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "irritacao_parar_tela", label: "Fica irritada quando precisa parar de usar telas?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
      { key: "atividade_fisica", label: "Atividade física regular?", tipo: "radio", opcoes: SIM_NAO_PARCIAL },
      { key: "atividades_extras", label: "Atividades extracurriculares", tipo: "chips", opcoes: ["Esporte", "Música", "Arte", "Idioma", "Reforço", "Nenhuma"] },
    ],
  },
  {
    key: "autonomia",
    titulo: "Autonomia",
    campos: [
      { key: "higiene", label: "Higiene pessoal", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_AUTONOMIA },
      { key: "vestir_se", label: "Vestir-se", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_AUTONOMIA },
      { key: "alimentar_se", label: "Alimentar-se", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_AUTONOMIA },
      { key: "tarefas_casa", label: "Tarefas de casa", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_AUTONOMIA },
    ],
  },
  {
    key: "social",
    titulo: "Interação social",
    campos: [
      { key: "contato_visual", label: "Contato visual", tipo: "radio", opcoes: ["Adequado", "Inconstante", "Evita"] },
      { key: "amigos", label: "Vínculos de amizade", tipo: "select", opcoes: ["Vários", "Poucos", "Um único", "Nenhum"] },
      { key: "brincadeira", label: "Tipo de brincadeira", tipo: "chips", opcoes: ["Simbólica", "Solitária", "Paralela", "Cooperativa", "Repetitiva"] },
      { key: "iniciativa", label: "Iniciativa social", tipo: "scale", scaleMin: 0, scaleMax: 10, escalaLabels: ESCALA_FREQUENCIA },
      { key: "compartilha_conquistas", label: "Demonstra interesse em compartilhar conquistas, objetos ou descobertas?", tipo: "select", opcoes: ["Sim", "Às vezes", "Não"] },
      { key: "faz_de_conta", label: "Participa de brincadeiras simbólicas ou de faz de conta?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "compartilha_brinquedos", label: "Compartilha brinquedos e materiais?", tipo: "select", opcoes: ["Sim", "Às vezes", "Não"] },
      { key: "entende_regras", label: "Entende regras de brincadeiras e jogos?", tipo: "select", opcoes: ["Sim", "Parcialmente", "Não"] },
      { key: "prefere_brincar", label: "Prefere brincar sozinha ou acompanhada?", tipo: "select", opcoes: ["Sozinha", "Com adultos", "Com crianças", "Varia conforme o contexto"] },
      { key: "repeticao_comandos", label: "Precisa de repetição constante de comandos?", tipo: "select", opcoes: ["Não", "Às vezes", "Sim"] },
    ],
  },
  {
    key: "interesses",
    titulo: "Interesses e reforçadores",
    campos: [
      { key: "interesses", label: "Interesses principais", tipo: "chips", opcoes: ["Esportes", "Música", "Desenho", "Vídeos", "Animais", "Tecnologia", "Leitura", "Construções"] },
      { key: "reforcadores", label: "Reforçadores eficazes", tipo: "chips", opcoes: ["Elogio verbal", "Tempo de tela", "Pequenos prêmios", "Atividade preferida", "Atenção exclusiva"] },
      { key: "aversoes", label: "Aversões fortes", tipo: "textarea" },
    ],
  },
  {
    key: "sintese_responsaveis",
    titulo: "Síntese dos responsáveis",
    descricao: "A visão da família sobre a criança.",
    campos: [
      { key: "potencialidades", label: "Principais potencialidades da criança", tipo: "textarea" },
      { key: "faz_bem", label: "O que a criança faz bem ou gosta muito de fazer", tipo: "textarea" },
      { key: "mais_preocupa", label: "O que mais preocupa atualmente", tipo: "textarea" },
      { key: "nao_perguntado", label: "Algo importante que não foi perguntado", tipo: "textarea" },
    ],
  },
  {
    key: "observacoes_gerais",
    titulo: "Observações gerais",
    campos: [
      { key: "observacoes", label: "Observações livres", tipo: "textarea", placeholder: "Qualquer informação adicional relevante." },
    ],
  },
];

/** Faixas numéricas fixas para escalas 0–10; o rótulo de cada faixa é específico do campo. */
const FAIXAS_NUM = [
  { min: 0, max: 0 },
  { min: 1, max: 3 },
  { min: 4, max: 6 },
  { min: 7, max: 9 },
  { min: 10, max: 10 },
];
const ESCALA_LABELS_PADRAO: [string, string, string, string, string] = ["Nenhum", "Leve", "Moderado", "Intenso", "Extremo"];

export function faixasDoCampo(labels: [string, string, string, string, string] = ESCALA_LABELS_PADRAO) {
  return FAIXAS_NUM.map((f, i) => ({
    ...f,
    mid: f.min === f.max ? f.min : Math.round((f.min + f.max) / 2),
    label: `${labels[i]} (${f.min === f.max ? f.min : `${f.min}–${f.max}`})`,
  }));
}
export function faixaDoValor(v: number | null | undefined, faixas: ReturnType<typeof faixasDoCampo>) {
  if (v == null || isNaN(v as any)) return "";
  return faixas.find((f) => v >= f.min && v <= f.max)?.label ?? "";
}

export const SECOES_RADAR: { key: string; label: string; secoes: string[] }[] = [
  { key: "contexto_familiar", label: "Contexto Familiar", secoes: ["contexto_familiar"] },
  { key: "gestacao", label: "História Gestacional", secoes: ["gestacao"] },
  { key: "desenvolvimento", label: "Desenvolvimento", secoes: ["desenvolvimento", "linguagem", "motor", "sensorial", "alimentacao"] },
  { key: "escolar", label: "Aspectos Escolares", secoes: ["escolar", "aprendizagem"] },
  { key: "comportamento", label: "Comportamento", secoes: ["comportamento", "social"] },
  { key: "rotina", label: "Rotina e Hábitos", secoes: ["rotina", "autonomia"] },
];

/**
 * Avalia se um campo condicional deve ser exibido, dado o estado atual da seção.
 * Campos sem `condicao` são sempre visíveis.
 */
export function campoVisivel(campo: CampoDef, dadosSecao: Record<string, any> = {}): boolean {
  if (!campo.condicao) return true;
  const { campo: dep, igualA, inclui } = campo.condicao;
  const valor = dadosSecao[dep];
  if (inclui != null) {
    return Array.isArray(valor) && valor.includes(inclui);
  }
  if (igualA != null) {
    const alvos = Array.isArray(igualA) ? igualA : [igualA];
    return alvos.includes(valor);
  }
  // condição declarada sem critério: exige apenas que o campo dependente esteja preenchido
  if (valor == null || valor === "") return false;
  if (Array.isArray(valor) && valor.length === 0) return false;
  return true;
}

export function percentualSecao(def: SecaoDef, dados: Record<string, any> = {}): number {
  const visiveis = def.campos.filter((c) => campoVisivel(c, dados));
  if (!visiveis.length) return 0;
  const preenchidos = visiveis.filter((c) => {
    const v = dados[c.key];
    if (v == null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;
  return Math.round((preenchidos / visiveis.length) * 100);
}

export function percentualTotal(dados: Record<string, Record<string, any>> = {}): number {
  const totais = ANAMNESE_SECOES.map((s) => percentualSecao(s, dados[s.key] ?? {}));
  return Math.round(totais.reduce((a, b) => a + b, 0) / Math.max(1, totais.length));
}
