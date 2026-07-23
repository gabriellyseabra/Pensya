import {
  Rocket,
  Calendar,
  Users,
  CheckSquare,
  Wallet,
  Heart,
  Link2,
  DollarSign,
  FileText,
  UserCog,
  DoorOpen,
  BarChart3,
  Settings,
} from "lucide-react";

/**
 * Conteúdo da Central de Ajuda.
 *
 * Cada categoria (e cada artigo) pode ser marcada com `gestao: true` —
 * conteúdo que só faz sentido para quem administra a clínica (admin/secretária).
 * Terapeutas com acesso restrito não veem esse conteúdo, espelhando as mesmas
 * regras de acesso das telas do sistema.
 */

export type BlocoAjuda =
  | { t: "p"; texto: string }
  | { t: "passos"; itens: string[] }
  | { t: "dica"; texto: string };

/** Campo de uma seção do sistema, para as tabelas "campos desta seção". */
export interface TutorialCampo {
  campo: string;
  descricao: string;
}

/** Um passo numerado de um tutorial detalhado. */
export interface TutorialPasso {
  titulo: string;
  descricao?: string;
  /** Tabela "campos desta seção". */
  campos?: TutorialCampo[];
  /** Caixa de dica (amarela). */
  dica?: string;
  /** Id de uma ilustração/mockup renderizada na página. */
  mockup?: string;
}

export interface TutorialProximo {
  titulo: string;
  descricao: string;
}

/**
 * Tutorial detalhado (formato "página inteira"): introdução, passos numerados
 * com tabelas de campos, dicas e ilustrações, e "o que fazer depois".
 */
export interface TutorialAjuda {
  antesDeComecar?: string[];
  passos: TutorialPasso[];
  oQueFazerDepois?: TutorialProximo[];
}

export interface ArtigoAjuda {
  id: string;
  titulo: string;
  corpo: BlocoAjuda[];
  /** Visível apenas para admin/secretária. */
  gestao?: boolean;
  /** Quando presente, o artigo abre como um tutorial detalhado de página inteira. */
  tutorial?: TutorialAjuda;
}

export interface CategoriaAjuda {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Categoria inteira visível apenas para admin/secretária. */
  gestao?: boolean;
  artigos: ArtigoAjuda[];
}

/**
 * Tutorial detalhado de importação de pacientes. Definido uma vez e
 * referenciado em duas categorias (Primeiros passos e Pacientes e prontuário).
 * Marcado como gestão: aparece só para admin/secretária, mesmo nessas
 * categorias abertas, porque importar a base é uma ação administrativa.
 */
const TUTORIAL_IMPORTAR_PACIENTES: ArtigoAjuda = {
  id: "importar-pacientes",
  titulo: "Como importar seus pacientes (Excel, CSV, SisClin ou colar)",
  gestao: true,
  corpo: [
    {
      t: "p",
      texto:
        "Traga sua base de pacientes de uma planilha Excel/CSV, da exportação direta do SisClin ou colando as células copiadas da sua planilha. O sistema reconhece as colunas automaticamente pelos nomes dos cabeçalhos e mostra um preview editável antes de criar.",
    },
  ],
  tutorial: {
    antesDeComecar: [
      "Cadastre a equipe e as modalidades antes de importar: assim o profissional responsável e a modalidade de cada paciente são reconhecidos, e o vínculo do paciente com a terapeuta já vem pronto.",
      "Você pode trazer os dados de três formas: uma planilha (.xlsx, .xls ou .csv), a exportação direta do SisClin (sem editar nada) ou colando as células copiadas do Excel/Google Sheets.",
    ],
    passos: [
      {
        titulo: "Abra Pacientes e clique em “Importar arquivo”",
        descricao:
          "No menu lateral, abra Pacientes. No topo da tela, ao lado de “Novo paciente”, clique em “Importar arquivo”. Abre uma janela com duas abas: enviar um arquivo ou colar da planilha.",
        mockup: "lista-pacientes",
      },
      {
        titulo: "Escolha como trazer os dados",
        descricao:
          "Na aba “Enviar arquivo”, selecione o .xlsx, .xls ou .csv — inclusive o export do SisClin, sem precisar arrumar nada: as linhas de título do topo são ignoradas sozinhas. Na aba “Colar da planilha”, copie as células no Excel/Google Sheets e cole no campo.",
        dica: "Ao colar, selecione também a linha de títulos das colunas (Nome, Nascimento, Responsável…). É por esses nomes que o sistema reconhece cada coluna — sem eles, ele não sabe o que é cada dado.",
        mockup: "dialog-abas",
      },
      {
        titulo: "Não tem uma planilha pronta? Baixe o modelo",
        descricao:
          "Clique em “Baixar modelo de planilha” para começar de um arquivo .xlsx com todas as colunas certas e dois exemplos preenchidos. Substitua os exemplos pelos seus pacientes e importe.",
        mockup: "modelo",
      },
      {
        titulo: "Confira o preview e ajuste o que precisar",
        descricao:
          "Cada linha vira um paciente, com os campos já preenchidos e editáveis. Abra “Mais dados” em qualquer linha para ver e ajustar os campos extras. Desmarque quem você não quer importar agora.",
        campos: [
          { campo: "Nome", descricao: "Nome do paciente — é o único campo obrigatório." },
          { campo: "Nascimento", descricao: "Aceita datas em dd/mm/aaaa ou aaaa-mm-dd." },
          {
            campo: "Responsável",
            descricao: "Vira o responsável principal; um segundo responsável também é importado.",
          },
          {
            campo: "Diagnóstico",
            descricao: "Separado por vírgula; “em investigação” vira hipótese diagnóstica.",
          },
          {
            campo: "Modalidade",
            descricao: "Casada com as modalidades da clínica (Presencial, Online, Domiciliar).",
          },
          {
            campo: "Profissional responsável",
            descricao: "Casado por nome com a equipe — cria o vínculo do paciente com a terapeuta.",
          },
          {
            campo: "Status",
            descricao: "Ativo, Inativo, Pausado ou Alta — normalizado automaticamente.",
          },
        ],
        dica: "Se uma modalidade ou profissional não for reconhecido, um aviso aparece ao final da importação — você corrige depois na ficha do paciente.",
        mockup: "preview-tabela",
      },
      {
        titulo: "Confirme e crie os pacientes",
        descricao:
          "Clique em “Confirmar e criar”. Os pacientes entram na lista na hora, e escolas e diagnósticos que ainda não existiam são criados automaticamente.",
        mockup: "confirmar",
      },
    ],
    oQueFazerDepois: [
      {
        titulo: "Preencher a anamnese",
        descricao: "Complete a ficha clínica de cada paciente importado.",
      },
      {
        titulo: "Confirmar o vínculo com a profissional",
        descricao: "Garanta o profissional responsável para liberar a agenda e o prontuário dela.",
      },
      {
        titulo: "Agendar os atendimentos",
        descricao: "Monte a agenda dos pacientes recém-importados.",
      },
    ],
  },
};

export const CATEGORIAS_AJUDA: CategoriaAjuda[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    descricao: "Conheça o Pensya, a navegação e como cada papel funciona.",
    icon: Rocket,
    artigos: [
      TUTORIAL_IMPORTAR_PACIENTES,
      {
        id: "o-que-e-pensya",
        titulo: "O que é o Pensya e como ele organiza a clínica",
        corpo: [
          {
            t: "p",
            texto:
              "O Pensya reúne em um só lugar tudo o que a clínica usa no dia a dia: agenda, pacientes e prontuário, tarefas, financeiro, contratos, equipe e portal da família. Cada clínica tem seu próprio espaço isolado — os dados dos seus pacientes são visíveis apenas para a sua equipe.",
          },
          {
            t: "p",
            texto:
              "O menu lateral esquerdo é o ponto de partida para todas as áreas. Ele fica recolhido mostrando só os ícones; passe o mouse sobre ele para expandir e ver os nomes das páginas. No celular, toque no ícone de menu no topo da tela.",
          },
          {
            t: "dica",
            texto:
              "As páginas que aparecem no seu menu dependem do seu papel na clínica — por isso o seu menu pode ser diferente do de uma colega.",
          },
        ],
      },
      {
        id: "papeis-e-permissoes",
        titulo: "Papéis e permissões: o que cada pessoa vê",
        corpo: [
          {
            t: "p",
            texto:
              "Cada membro da equipe tem um papel, definido pela administradora da clínica na página Equipe. O papel determina quais páginas e dados a pessoa acessa:",
          },
          {
            t: "passos",
            itens: [
              "Admin — vê e gerencia tudo: financeiro da clínica, contratos, equipe, indicadores e configurações.",
              "Profissional (terapeuta) — acessa Dashboard, Agenda, Pacientes, Tarefas e o próprio financeiro (repasses). Não acessa o financeiro da clínica nem a gestão.",
              "Secretária — apoia a recepção e a organização: agenda, cadastros e rotinas administrativas.",
            ],
          },
          {
            t: "p",
            texto:
              "Se você precisa acessar uma área que não aparece no seu menu, fale com a administradora da sua clínica — é ela quem ajusta o papel de cada pessoa.",
          },
        ],
      },
      {
        id: "paciente-modelo",
        titulo: "Paciente modelo: um tutorial vivo dentro do sistema",
        corpo: [
          {
            t: "p",
            texto:
              "Toda clínica no Pensya começa com a Sofia, uma paciente fictícia com a ficha completa de ponta a ponta: cadastro, responsáveis, anamnese estruturada, avaliação concluída com resultados de testes (percentis e interpretação), plano terapêutico com CIF, metas funcionais e escala GAS, sessões registradas e vinculadas às metas, perfil clínico vivo e frequência na agenda. Ela existe para você explorar cada funcionalidade vendo dados de verdade — sem medo de mexer em paciente real.",
          },
          {
            t: "passos",
            itens: [
              "Abra Pacientes e clique em “Sofia (Paciente Modelo)” — ela tem o selo “modelo”.",
              "Percorra as abas da ficha: cadastro, anamnese, prontuário com as evoluções, plano terapêutico com as metas e GAS.",
              "Edite, registre uma sessão de teste, gere um documento — tudo é fictício e pode ser alterado à vontade.",
              "Quando não precisar mais, clique em “Ocultar paciente modelo” na lista de pacientes. Para trazê-la de volta, use “Mostrar paciente modelo” no mesmo lugar.",
            ],
          },
          {
            t: "p",
            texto:
              "No Dashboard você encontra o tutorial guiado “Conheça o Pensya”: um passo a passo que usa a Sofia para apresentar cada área do sistema, marcando seu progresso conforme você avança. Se você dispensou o tutorial, é possível retomá-lo pelo botão “Retomar tutorial” aqui na Central de Ajuda.",
          },
          {
            t: "dica",
            texto:
              "Ocultar o modelo vale para toda a clínica e é reversível a qualquer momento — nada é apagado. O progresso do tutorial é individual: cada pessoa da equipe faz o próprio tour.",
          },
        ],
      },
      {
        id: "acessar-conta",
        titulo: "Acesso à conta e redefinição de senha",
        corpo: [
          {
            t: "p",
            texto:
              "Você entra no Pensya com e-mail e senha na tela de login. Se você foi convidada para a equipe de uma clínica, use o link do convite recebido por e-mail — ele já vincula sua conta à clínica com o papel correto.",
          },
          {
            t: "passos",
            itens: [
              "Esqueceu a senha? Na tela de login, clique em “Esqueci minha senha”.",
              "Informe o e-mail cadastrado e confira sua caixa de entrada (e o spam).",
              "Abra o link recebido e defina a nova senha.",
            ],
          },
        ],
      },
      {
        id: "ver-como",
        titulo: "Pré-visualizar o sistema como outro papel (“Ver como”)",
        gestao: true,
        corpo: [
          {
            t: "p",
            texto:
              "Administradoras podem visualizar o sistema como se fossem uma profissional ou secretária, para conferir exatamente o que cada papel enxerga — útil antes de orientar a equipe.",
          },
          {
            t: "p",
            texto:
              "A pré-visualização muda apenas a sua tela: menus e páginas passam a refletir o papel escolhido, mas suas permissões reais continuam as mesmas. Para voltar, basta desativar a pré-visualização no mesmo lugar.",
          },
        ],
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda e sessões",
    descricao: "Marcação de atendimentos, frequência, modalidades e locais.",
    icon: Calendar,
    artigos: [
      {
        id: "marcar-atendimento",
        titulo: "Como marcar um atendimento",
        corpo: [
          {
            t: "passos",
            itens: [
              "Abra a Agenda pelo menu lateral.",
              "Clique no horário desejado (ou no botão de novo atendimento).",
              "Escolha o paciente, a profissional, a modalidade e o local.",
              "Salve — o atendimento aparece imediatamente na agenda de todas as envolvidas.",
            ],
          },
          {
            t: "dica",
            texto:
              "Profissionais veem na agenda os atendimentos dos pacientes vinculados a elas. O vínculo paciente ↔ profissional é feito pela administradora.",
          },
        ],
      },
      {
        id: "status-frequencia",
        titulo: "Registrar presença, falta e status de frequência",
        corpo: [
          {
            t: "p",
            texto:
              "Cada atendimento tem um status de frequência (compareceu, faltou, remarcado etc.). Manter esses status em dia alimenta os indicadores da clínica e o histórico do paciente.",
          },
          {
            t: "p",
            texto:
              "Para alterar, abra o atendimento na agenda e escolha o status. A lista de status disponíveis é personalizável pela administradora em Configurações → Clínica → Status de frequência.",
          },
        ],
      },
      {
        id: "modalidades-locais",
        titulo: "Modalidades de atendimento e locais",
        gestao: true,
        corpo: [
          {
            t: "p",
            texto:
              "Modalidades (ex.: psicopedagogia, fonoaudiologia, avaliação) e locais (salas, unidades, on-line) organizam a agenda e os relatórios. Cada modalidade pode ter uma cor própria, o que facilita a leitura visual da agenda.",
          },
          {
            t: "passos",
            itens: [
              "Acesse Configurações → Clínica.",
              "Em Modalidades, cadastre o nome e escolha a cor.",
              "Em Locais, cadastre o nome e o endereço, se houver.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "pacientes",
    titulo: "Pacientes e prontuário",
    descricao: "Cadastro, ficha completa, evolução clínica e plano terapêutico.",
    icon: Users,
    artigos: [
      {
        id: "ficha-paciente",
        titulo: "A ficha do paciente: o que tem em cada área",
        corpo: [
          {
            t: "p",
            texto:
              "Na página Pacientes, clique em um nome para abrir a ficha completa. Ela concentra dados pessoais, escola, contexto familiar, saúde, histórico de gestação e parto, tratamentos anteriores, outros especialistas, exames e anexos — além do prontuário clínico com as sessões e o plano terapêutico.",
          },
          {
            t: "p",
            texto:
              "Você pode buscar um paciente a qualquer momento pela busca rápida no topo da tela, sem precisar voltar à lista.",
          },
        ],
      },
      {
        id: "quem-ve-paciente",
        titulo: "Quem enxerga cada paciente",
        corpo: [
          {
            t: "p",
            texto:
              "Profissionais veem somente os pacientes vinculados a elas — agenda, prontuário e plano terapêutico desses pacientes. A administradora vê todos os pacientes da clínica e faz os vínculos na gestão da equipe.",
          },
          {
            t: "dica",
            texto:
              "Se um paciente que deveria aparecer para você não aparece, provavelmente falta o vínculo — peça à administradora para conferir.",
          },
        ],
      },
      {
        id: "evolucao-sessoes",
        titulo: "Registrar a evolução das sessões",
        corpo: [
          {
            t: "p",
            texto:
              "O registro de sessão fica dentro da ficha do paciente. Após cada atendimento, registre a evolução — o que foi trabalhado, respostas do paciente e observações. O histórico completo fica organizado em ordem cronológica no prontuário.",
          },
          {
            t: "p",
            texto:
              "Esses registros alimentam os relatórios de evolução e dão base para revisar o plano terapêutico com segurança.",
          },
        ],
      },
      {
        id: "plano-terapeutico",
        titulo: "Plano terapêutico e avaliações",
        corpo: [
          {
            t: "p",
            texto:
              "Na ficha do paciente você monta o plano terapêutico com objetivos e habilidades trabalhadas, e conduz processos de avaliação/testagem quando o caso pede. O catálogo de habilidades, diagnósticos e instrumentos é mantido pela administradora em Configurações, garantindo padronização entre a equipe.",
          },
        ],
      },
      {
        id: "cadastrar-paciente",
        titulo: "Cadastrar um novo paciente",
        corpo: [
          {
            t: "passos",
            itens: [
              "Abra Pacientes no menu e clique em novo paciente.",
              "Preencha os dados essenciais — o restante da ficha pode ser completado depois.",
              "Se a clínica usa cadastro público, a família pode preencher os próprios dados por um link, e a recepção converte o cadastro em paciente (veja a categoria Cadastros e recepção).",
            ],
          },
        ],
      },
      TUTORIAL_IMPORTAR_PACIENTES,
    ],
  },
  {
    id: "tarefas-alertas",
    titulo: "Tarefas e alertas",
    descricao: "Organização do trabalho da equipe e central de atenção.",
    icon: CheckSquare,
    artigos: [
      {
        id: "usar-tarefas",
        titulo: "Como usar as tarefas",
        corpo: [
          {
            t: "p",
            texto:
              "A página Tarefas organiza pendências da clínica por departamento e prioridade. Cada tarefa pode ser atribuída a uma pessoa da equipe, com prazo. Profissionais veem as tarefas atribuídas a elas.",
          },
          {
            t: "passos",
            itens: [
              "Abra Tarefas no menu e crie uma nova tarefa.",
              "Defina título, responsável, prioridade e prazo.",
              "Conclua a tarefa quando finalizar — o histórico fica registrado.",
            ],
          },
        ],
      },
      {
        id: "central-alertas",
        titulo: "Central de alertas",
        corpo: [
          {
            t: "p",
            texto:
              "A página Alertas reúne pontos que pedem atenção — pendências e situações que o sistema detecta automaticamente. Vale visitá-la periodicamente para não deixar nada passar.",
          },
        ],
      },
    ],
  },
  {
    id: "meu-financeiro",
    titulo: "Meu financeiro (repasses)",
    descricao: "Acompanhe seus recebimentos como profissional da clínica.",
    icon: Wallet,
    artigos: [
      {
        id: "ver-repasses",
        titulo: "Acompanhar meus recebimentos",
        corpo: [
          {
            t: "p",
            texto:
              "A página Meu financeiro mostra os seus repasses e recebimentos como profissional — sem expor o financeiro geral da clínica. Você acompanha o que foi gerado a partir dos seus atendimentos e o que já foi pago.",
          },
          {
            t: "dica",
            texto:
              "Dúvidas sobre valores ou regras de repasse são definidas pela administração da clínica — fale diretamente com ela.",
          },
        ],
      },
    ],
  },
  {
    id: "portal-familia",
    titulo: "Portal da família",
    descricao: "O que os responsáveis acessam e como convidá-los.",
    icon: Heart,
    artigos: [
      {
        id: "o-que-familia-ve",
        titulo: "O que a família vê no portal",
        corpo: [
          {
            t: "p",
            texto:
              "O portal é uma área exclusiva para os responsáveis do paciente, com a identidade visual da clínica. Nele a família acompanha a evolução compartilhada, o diário, relatórios liberados e o financeiro do paciente (cobranças e comprovantes).",
          },
          {
            t: "p",
            texto:
              "A família não tem acesso ao prontuário clínico interno — apenas ao que a clínica decide compartilhar.",
          },
        ],
      },
      {
        id: "convidar-familia",
        titulo: "Convidar uma família para o portal",
        gestao: true,
        corpo: [
          {
            t: "passos",
            itens: [
              "Abra a ficha do paciente.",
              "Gere o convite do portal para o responsável.",
              "Envie o link — ao aceitar, o responsável cria a senha e passa a acessar o portal daquele paciente.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "cadastros-recepcao",
    titulo: "Cadastros e recepção",
    descricao: "Links públicos de cadastro e conversão em paciente.",
    icon: Link2,
    gestao: true,
    artigos: [
      {
        id: "cadastro-publico",
        titulo: "Cadastro público: a família preenche, a recepção confere",
        corpo: [
          {
            t: "p",
            texto:
              "A página Cadastros gerencia os links públicos de cadastro: a família preenche os próprios dados (e, se a clínica emitir nota fiscal, informa em nome de quem emitir), e a recepção acompanha a situação de cada cadastro recebido.",
          },
          {
            t: "passos",
            itens: [
              "Gere e envie o link de cadastro para a família.",
              "Acompanhe em Cadastros a situação dos formulários recebidos.",
              "Quando um cadastro está completo, converta-o em paciente com um clique — sem redigitar nada.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "financeiro-clinica",
    titulo: "Financeiro da clínica",
    descricao: "Receitas, despesas, contas, plano de contas e fornecedores.",
    icon: DollarSign,
    gestao: true,
    artigos: [
      {
        id: "visao-financeiro",
        titulo: "Visão geral do financeiro",
        corpo: [
          {
            t: "p",
            texto:
              "A página Financeiro concentra as entradas e saídas da clínica, com o resumo do período e os lançamentos detalhados. Os lançamentos usam o plano de contas (categorias de receita e despesa), as contas/caixas e os centros de custo definidos em Configurações → Financeiro.",
          },
        ],
      },
      {
        id: "estrutura-financeira",
        titulo: "Configurar a estrutura financeira",
        corpo: [
          {
            t: "passos",
            itens: [
              "Em Configurações → Financeiro, monte o plano de contas com as categorias de entrada e saída.",
              "Cadastre as contas/caixas (banco, dinheiro, maquininha) com saldo inicial.",
              "Defina os tipos de serviço com valor padrão — eles agilizam a cobrança dos atendimentos.",
              "Cadastre centros de custo e fornecedores conforme a necessidade.",
            ],
          },
          {
            t: "dica",
            texto:
              "Uma estrutura simples e consistente vale mais que uma detalhada demais: comece com poucas categorias e refine com o uso.",
          },
        ],
      },
      {
        id: "repasses-equipe",
        titulo: "Repasses para a equipe",
        corpo: [
          {
            t: "p",
            texto:
              "Os valores devidos a cada profissional aparecem para ela na página Meu financeiro. A administração controla as regras e a quitação dos repasses pelo financeiro da clínica, mantendo a visão de cada profissional restrita aos próprios valores.",
          },
        ],
      },
    ],
  },
  {
    id: "contratos",
    titulo: "Contratos",
    descricao: "Modelos, geração e assinatura de contratos com as famílias.",
    icon: FileText,
    gestao: true,
    artigos: [
      {
        id: "gerar-contrato",
        titulo: "Gerar um contrato a partir de um modelo",
        corpo: [
          {
            t: "p",
            texto:
              "A página Contratos guarda seus modelos de contrato e os contratos gerados. Os modelos aceitam campos que são preenchidos automaticamente com os dados do paciente e da clínica.",
          },
          {
            t: "passos",
            itens: [
              "Cadastre ou ajuste um modelo de contrato.",
              "Gere o contrato escolhendo o paciente — os campos são preenchidos automaticamente.",
              "Envie o link de assinatura para o responsável e acompanhe o status.",
            ],
          },
          {
            t: "dica",
            texto:
              "A logo e os dados cadastrais que aparecem nos documentos são os configurados em Configurações → Identidade da clínica.",
          },
        ],
      },
    ],
  },
  {
    id: "equipe",
    titulo: "Equipe e permissões",
    descricao: "Convites, papéis e vínculo entre profissionais e pacientes.",
    icon: UserCog,
    gestao: true,
    artigos: [
      {
        id: "convidar-membro",
        titulo: "Convidar alguém para a equipe",
        corpo: [
          {
            t: "passos",
            itens: [
              "Abra Equipe no menu e crie um convite.",
              "Escolha o papel (admin, profissional ou secretária) e as especialidades, se for o caso.",
              "Envie o link do convite — a pessoa cria a conta e já entra na clínica com o papel definido.",
            ],
          },
          {
            t: "p",
            texto:
              "Convites pendentes aparecem na própria página de Equipe, e você pode reenviá-los ou cancelá-los a qualquer momento.",
          },
        ],
      },
      {
        id: "vinculo-paciente-profissional",
        titulo: "Vincular pacientes a uma profissional",
        corpo: [
          {
            t: "p",
            texto:
              "O vínculo paciente ↔ profissional define o que cada terapeuta enxerga: agenda, prontuário e plano terapêutico apenas dos pacientes vinculados a ela. O vínculo é gerenciado pela administradora.",
          },
          {
            t: "dica",
            texto:
              "Ao receber um paciente novo, lembre-se de criar o vínculo — sem ele, a profissional não vê o paciente.",
          },
        ],
      },
    ],
  },
  {
    id: "sublocacao",
    titulo: "Sublocação de salas",
    descricao: "Salas, sublocadores, contratos e portal de reservas.",
    icon: DoorOpen,
    gestao: true,
    artigos: [
      {
        id: "gerir-sublocacao",
        titulo: "Gerenciar salas e sublocadores",
        corpo: [
          {
            t: "p",
            texto:
              "A página Sublocação organiza as salas da clínica, os sublocadores, os contratos de sublocação e os usos registrados. Cada sublocador pode receber um link do portal de salas para reservar e trocar horários sem depender da recepção.",
          },
          {
            t: "passos",
            itens: [
              "Cadastre as salas e defina a disponibilidade de cada uma.",
              "Cadastre os sublocadores e gere o link do portal para cada um.",
              "Acompanhe os usos registrados e os contratos na mesma página.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "gestao-indicadores",
    titulo: "Indicadores e crescimento",
    descricao: "Panorama da clínica, comercial e importação de dados.",
    icon: BarChart3,
    gestao: true,
    artigos: [
      {
        id: "indicadores",
        titulo: "Ler os indicadores da clínica",
        corpo: [
          {
            t: "p",
            texto:
              "A página Indicadores traz o panorama do mês: atendimentos por modalidade, frequência e o resumo geral. Os números dependem dos registros do dia a dia — agenda com status de frequência atualizados e financeiro lançado.",
          },
        ],
      },
      {
        id: "comercial",
        titulo: "Comercial: acompanhar contatos e oportunidades",
        corpo: [
          {
            t: "p",
            texto:
              "A página Comercial acompanha o funil de novos contatos até virarem pacientes — útil para não perder oportunidades entre a primeira conversa e a primeira sessão.",
          },
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Identidade da clínica, catálogo clínico, financeiro e IA.",
    icon: Settings,
    gestao: true,
    artigos: [
      {
        id: "identidade-clinica",
        titulo: "Identidade da clínica: logo, dados e cor do sistema",
        corpo: [
          {
            t: "p",
            texto:
              "Em Configurações → Identidade da clínica você define a logo e os dados cadastrais que aparecem nos documentos gerados (contratos, relatórios, planos terapêuticos) e a cor do sistema para toda a equipe.",
          },
          {
            t: "p",
            texto:
              "Também é aqui que você ativa a pergunta de nota fiscal no cadastro público, caso a clínica emita NF.",
          },
        ],
      },
      {
        id: "catalogo-clinico",
        titulo: "Catálogo clínico: diagnósticos, habilidades e baterias",
        corpo: [
          {
            t: "p",
            texto:
              "O catálogo clínico padroniza o vocabulário da equipe: diagnósticos, categorias de habilidades e habilidades usadas nos planos terapêuticos, além das baterias por demanda (modelos de avaliação aplicados em um clique) e dos bancos de recursos e referências.",
          },
          {
            t: "dica",
            texto:
              "O Banco de Referências alimenta a IA do sistema: referências fixadas ou relevantes ao caso entram automaticamente no contexto de planos, sessões e relatórios.",
          },
        ],
      },
      {
        id: "recursos-ia",
        titulo: "Recursos de IA do sistema",
        corpo: [
          {
            t: "p",
            texto:
              "O Pensya usa IA para apoiar a escrita clínica — planos, registros e relatórios. As preferências ficam em Configurações → IA. A IA é apoio: o conteúdo clínico é sempre revisado e validado pela profissional.",
          },
        ],
      },
    ],
  },
];
