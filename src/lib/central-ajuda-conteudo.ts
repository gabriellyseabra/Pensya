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
 * Cada artigo é um TUTORIAL detalhado (formato de página inteira): introdução
 * "antes de começar", passos numerados com tabelas de campos, dicas e
 * ilustrações, e "o que fazer depois". A `corpo` guarda um resumo curto usado
 * na busca e no preview.
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

/** Atalho: monta um artigo-tutorial com um resumo curto para a busca/preview. */
function tut(
  id: string,
  titulo: string,
  resumo: string,
  tutorial: TutorialAjuda,
  gestao?: boolean,
): ArtigoAjuda {
  return { id, titulo, gestao, corpo: [{ t: "p", texto: resumo }], tutorial };
}

/**
 * Tutorial detalhado de importação de pacientes. Definido uma vez e
 * referenciado em duas categorias (Primeiros passos e Pacientes e prontuário).
 * Marcado como gestão: aparece só para admin/secretária, porque importar a
 * base é uma ação administrativa.
 */
const TUTORIAL_IMPORTAR_PACIENTES: ArtigoAjuda = tut(
  "importar-pacientes",
  "Como importar seus pacientes (Excel, CSV, SisClin ou colar)",
  "Traga sua base de pacientes de uma planilha Excel/CSV, da exportação direta do SisClin ou colando as células copiadas da sua planilha. O sistema reconhece as colunas automaticamente pelos nomes dos cabeçalhos e mostra um preview editável antes de criar.",
  {
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
  true,
);

export const CATEGORIAS_AJUDA: CategoriaAjuda[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    descricao: "Conheça o Pensya, a navegação e como cada papel funciona.",
    icon: Rocket,
    artigos: [
      TUTORIAL_IMPORTAR_PACIENTES,
      tut(
        "o-que-e-pensya",
        "O que é o Pensya e como ele organiza a clínica",
        "O Pensya reúne agenda, pacientes e prontuário, tarefas, financeiro, contratos, equipe e portal da família em um só lugar. Cada clínica tem seu espaço isolado — só a sua equipe vê os seus dados.",
        {
          passos: [
            {
              titulo: "Tudo da clínica em um só lugar",
              descricao:
                "O Pensya reúne o dia a dia da clínica: agenda, pacientes e prontuário, tarefas, financeiro, contratos, equipe e portal da família. Em vez de planilhas soltas, tudo conversa entre si — o atendimento na agenda vira sessão no prontuário, que alimenta os relatórios e o financeiro.",
            },
            {
              titulo: "Cada clínica é um espaço isolado",
              descricao:
                "Os dados dos seus pacientes são visíveis apenas para a sua equipe. Nenhuma outra clínica que use o Pensya enxerga qualquer informação sua.",
            },
            {
              titulo: "Navegue pelo menu lateral",
              descricao:
                "O menu escuro à esquerda é o ponto de partida para todas as áreas. Ele fica recolhido mostrando só os ícones; passe o mouse para expandir e ver os nomes. No celular, toque no ícone de menu no topo.",
              dica: "As páginas que aparecem no seu menu dependem do seu papel na clínica — por isso o seu menu pode ser diferente do de uma colega.",
              mockup: "menu-lateral",
            },
          ],
        },
      ),
      tut(
        "papeis-e-permissoes",
        "Papéis e permissões: o que cada pessoa vê",
        "Cada membro tem um papel (admin, profissional ou secretária), definido pela administradora na página Equipe. O papel determina quais páginas e dados a pessoa acessa.",
        {
          passos: [
            {
              titulo: "Os três papéis da clínica",
              descricao: "Cada pessoa da equipe entra com um papel, que define o que ela enxerga:",
              campos: [
                {
                  campo: "Admin",
                  descricao:
                    "Vê e gerencia tudo: financeiro da clínica, contratos, equipe, indicadores e configurações.",
                },
                {
                  campo: "Profissional",
                  descricao:
                    "Acessa Dashboard, Agenda, Pacientes, Tarefas e o próprio financeiro — só dos pacientes vinculados a ela.",
                },
                {
                  campo: "Secretária",
                  descricao:
                    "Apoia a recepção e a organização: agenda, cadastros e rotinas administrativas.",
                },
              ],
              mockup: "papeis",
            },
            {
              titulo: "Quem define o papel",
              descricao:
                "É a administradora da clínica, na página Equipe. Se você precisa de uma área que não aparece no seu menu, fale com ela — é quem ajusta o papel de cada pessoa.",
            },
          ],
        },
      ),
      tut(
        "paciente-modelo",
        "Paciente modelo: um tutorial vivo dentro do sistema",
        "Toda clínica começa com a Sofia, uma paciente fictícia com a ficha completa (anamnese, avaliação com testes, plano com metas e GAS, sessões e perfil vivo), para você explorar tudo sem medo. Dá para ocultá-la quando quiser.",
        {
          passos: [
            {
              titulo: "Conheça a Sofia",
              descricao:
                "Toda clínica no Pensya começa com a Sofia, uma paciente fictícia com a ficha completa de ponta a ponta: cadastro, responsáveis, anamnese estruturada, avaliação concluída com resultados de testes, plano terapêutico com CIF, metas funcionais e GAS, sessões vinculadas às metas, perfil clínico vivo e frequência. Ela existe para você explorar cada funcionalidade vendo dados de verdade.",
              mockup: "ficha-paciente",
            },
            {
              titulo: "Explore à vontade",
              descricao:
                "Abra Pacientes e clique em “Sofia (Paciente Modelo)” — ela tem o selo “modelo”. Percorra as abas, edite, registre uma sessão de teste, gere um documento: tudo é fictício e pode ser alterado sem medo.",
            },
            {
              titulo: "Faça o tour guiado",
              descricao:
                "No Dashboard, o card “Conheça o Pensya” usa a Sofia para apresentar cada área do sistema, marcando seu progresso. Se você dispensou, retome pelo botão “Retomar tutorial” aqui na Central de ajuda.",
            },
            {
              titulo: "Oculte quando não precisar mais",
              descricao:
                "Na lista de pacientes, clique em “Ocultar paciente modelo”. Para trazê-la de volta, use “Mostrar paciente modelo” no mesmo lugar.",
              dica: "Ocultar o modelo vale para toda a clínica e é reversível a qualquer momento — nada é apagado. O progresso do tutorial é individual: cada pessoa da equipe faz o próprio tour.",
            },
          ],
        },
      ),
      tut(
        "acessar-conta",
        "Acesso à conta e redefinição de senha",
        "Você entra com e-mail e senha. Se foi convidada para uma clínica, use o link do convite. Esqueceu a senha? Redefina pela própria tela de login.",
        {
          passos: [
            {
              titulo: "Entrar no Pensya",
              descricao:
                "Acesse com e-mail e senha na tela de login. Se você foi convidada para a equipe de uma clínica, use o link do convite recebido por e-mail — ele já vincula sua conta à clínica com o papel correto.",
            },
            {
              titulo: "Redefinir a senha",
              descricao: "Esqueceu a senha? É rápido de resolver na própria tela de login:",
              campos: [
                { campo: "1. Esqueci minha senha", descricao: "Clique no link na tela de login." },
                {
                  campo: "2. Informe o e-mail",
                  descricao: "Use o e-mail cadastrado e confira a caixa de entrada (e o spam).",
                },
                {
                  campo: "3. Nova senha",
                  descricao: "Abra o link recebido e defina a nova senha.",
                },
              ],
            },
          ],
        },
      ),
      tut(
        "ver-como",
        "Pré-visualizar o sistema como outro papel (“Ver como”)",
        "Administradoras podem visualizar o sistema como uma profissional ou secretária, para conferir o que cada papel enxerga. Muda só a sua tela; suas permissões reais continuam as mesmas.",
        {
          passos: [
            {
              titulo: "Ative a pré-visualização",
              descricao:
                "Administradoras podem visualizar o sistema como se fossem uma profissional ou secretária, para conferir exatamente o que cada papel enxerga — útil antes de orientar a equipe.",
            },
            {
              titulo: "Só a sua tela muda",
              descricao:
                "A pré-visualização muda apenas menus e páginas visíveis; suas permissões reais continuam as mesmas. Para voltar, desative a pré-visualização no mesmo lugar.",
            },
          ],
        },
        true,
      ),
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda e sessões",
    descricao: "Marcação de atendimentos, frequência, modalidades e locais.",
    icon: Calendar,
    artigos: [
      tut(
        "marcar-atendimento",
        "Como marcar um atendimento",
        "Abra a Agenda, clique no horário, escolha paciente, profissional, modalidade e local, e salve. O atendimento aparece na hora para todas as envolvidas.",
        {
          passos: [
            {
              titulo: "Abra a Agenda e escolha o horário",
              descricao:
                "Abra a Agenda pelo menu lateral e clique no horário desejado (ou no botão de novo atendimento).",
              mockup: "agenda",
            },
            {
              titulo: "Preencha o atendimento",
              descricao: "Informe os dados do encontro:",
              campos: [
                { campo: "Paciente", descricao: "Quem será atendido." },
                { campo: "Profissional", descricao: "Quem vai atender." },
                {
                  campo: "Modalidade",
                  descricao: "Presencial, Online ou Domiciliar (com cor própria na agenda).",
                },
                { campo: "Local", descricao: "Sala ou unidade do atendimento." },
              ],
            },
            {
              titulo: "Salve",
              descricao: "O atendimento aparece imediatamente na agenda de todas as envolvidas.",
              dica: "Profissionais veem na agenda os atendimentos dos pacientes vinculados a elas. O vínculo paciente ↔ profissional é feito pela administradora.",
            },
          ],
        },
      ),
      tut(
        "status-frequencia",
        "Registrar presença, falta e status de frequência",
        "Cada atendimento tem um status de frequência (compareceu, faltou, remarcado…). Mantê-los em dia alimenta os indicadores e o histórico do paciente.",
        {
          passos: [
            {
              titulo: "Marque o status no atendimento",
              descricao:
                "Abra o atendimento na agenda e escolha o status de frequência. Manter isso em dia alimenta os indicadores da clínica e o histórico do paciente.",
              mockup: "agenda",
            },
            {
              titulo: "Personalize a lista de status",
              descricao:
                "A administradora personaliza os status disponíveis em Configurações → Clínica → Status de frequência (cada um com sua cor).",
            },
          ],
        },
      ),
      tut(
        "modalidades-locais",
        "Modalidades de atendimento e locais",
        "Modalidades (psicopedagogia, fono, avaliação…) e locais (salas, unidades, on-line) organizam a agenda e os relatórios. Cada modalidade pode ter uma cor.",
        {
          passos: [
            {
              titulo: "Por que cadastrar",
              descricao:
                "Modalidades e locais organizam a agenda e os relatórios. Cada modalidade pode ter uma cor própria, o que facilita a leitura visual da agenda.",
            },
            {
              titulo: "Cadastre em Configurações",
              descricao: "Acesse Configurações → Clínica:",
              campos: [
                { campo: "Modalidades", descricao: "Cadastre o nome e escolha a cor." },
                { campo: "Locais", descricao: "Cadastre o nome e o endereço, se houver." },
              ],
              mockup: "configuracoes",
            },
          ],
        },
        true,
      ),
    ],
  },
  {
    id: "pacientes",
    titulo: "Pacientes e prontuário",
    descricao: "Cadastro, ficha completa, evolução clínica e plano terapêutico.",
    icon: Users,
    artigos: [
      tut(
        "ficha-paciente",
        "A ficha do paciente: o que tem em cada área",
        "Na página Pacientes, clique em um nome para abrir a ficha completa: dados pessoais, escola, saúde, anamnese, e o prontuário com sessões, plano e avaliação.",
        {
          passos: [
            {
              titulo: "Abra a ficha",
              descricao:
                "Na página Pacientes, clique em um nome para abrir a ficha completa. Você também pode buscar um paciente a qualquer momento pela busca rápida no topo da tela.",
              mockup: "ficha-paciente",
            },
            {
              titulo: "O que tem em cada aba",
              descricao: "A ficha concentra tudo do paciente, organizado em abas:",
              campos: [
                {
                  campo: "Cadastro",
                  descricao: "Dados pessoais, responsáveis, escola e anamnese.",
                },
                {
                  campo: "Avaliação",
                  descricao: "Anamnese, testagem com resultados e raciocínio clínico.",
                },
                {
                  campo: "Plano",
                  descricao: "Plano terapêutico com metas funcionais e escala GAS.",
                },
                { campo: "Sessões", descricao: "O prontuário — registro de cada atendimento." },
                { campo: "Frequência", descricao: "Presenças, faltas e reposições." },
                {
                  campo: "Perfil",
                  descricao: "Perfil clínico vivo: o que funciona com o paciente.",
                },
              ],
            },
          ],
        },
      ),
      tut(
        "quem-ve-paciente",
        "Quem enxerga cada paciente",
        "Profissionais veem só os pacientes vinculados a elas. A administradora vê todos e faz os vínculos na gestão da equipe.",
        {
          passos: [
            {
              titulo: "Cada profissional vê os seus pacientes",
              descricao:
                "Profissionais veem somente os pacientes vinculados a elas — agenda, prontuário e plano terapêutico desses pacientes. A administradora vê todos e faz os vínculos na gestão da equipe.",
              mockup: "papeis",
            },
            {
              titulo: "Paciente sumido? Confira o vínculo",
              descricao:
                "Se um paciente que deveria aparecer para você não aparece, provavelmente falta o vínculo — peça à administradora para conferir na página Equipe.",
            },
          ],
        },
      ),
      tut(
        "evolucao-sessoes",
        "Registrar a evolução das sessões",
        "Após cada atendimento, registre a evolução no prontuário do paciente: o que foi trabalhado, respostas e observações. O histórico fica em ordem cronológica.",
        {
          passos: [
            {
              titulo: "Registre logo após o atendimento",
              descricao:
                "O registro de sessão fica dentro da ficha do paciente, na aba Sessões. Registre o que foi trabalhado, as respostas do paciente e observações.",
              mockup: "prontuario",
            },
            {
              titulo: "Vincule às metas do plano",
              descricao:
                "Ligue a sessão às metas do plano terapêutico e registre o progresso de cada meta — é isso que alimenta o monitoramento da evolução ao longo do ciclo.",
            },
            {
              titulo: "O histórico se organiza sozinho",
              descricao:
                "Os registros ficam em ordem cronológica no prontuário e alimentam os relatórios de evolução, dando base para revisar o plano com segurança.",
            },
          ],
        },
      ),
      tut(
        "plano-terapeutico",
        "Plano terapêutico e avaliações",
        "Monte o plano com objetivos e habilidades, e conduza avaliações quando o caso pedir. As metas são funcionais (sem estrutura SMART no título), com escala GAS.",
        {
          passos: [
            {
              titulo: "Monte o plano",
              descricao:
                "Na ficha do paciente, aba Plano, monte o plano terapêutico com o perfil CIF, os objetivos e as metas. As metas são funcionais — descrevem o que a pessoa vai conseguir fazer no dia a dia; métricas e prazos ficam nos campos próprios e na escala GAS, não no título.",
              mockup: "plano",
            },
            {
              titulo: "Conduza a avaliação quando precisar",
              descricao:
                "Na aba Avaliação, registre a anamnese e a testagem, com os resultados dos testes (percentil, classificação e interpretação). O raciocínio clínico conecta tudo.",
              mockup: "avaliacao",
            },
            {
              titulo: "Catálogo padronizado",
              descricao:
                "Habilidades, diagnósticos e instrumentos vêm do catálogo mantido pela administradora em Configurações, garantindo padronização entre a equipe.",
            },
          ],
        },
      ),
      tut(
        "cadastrar-paciente",
        "Cadastrar um novo paciente",
        "Abra Pacientes, clique em novo paciente e preencha o essencial — o resto da ficha se completa depois. Ou use o cadastro público para a família preencher.",
        {
          passos: [
            {
              titulo: "Novo paciente",
              descricao:
                "Abra Pacientes no menu e clique em novo paciente. Preencha os dados essenciais — só o nome é obrigatório; o restante da ficha pode ser completado depois.",
              mockup: "lista-pacientes",
            },
            {
              titulo: "Ou deixe a família preencher",
              descricao:
                "Se a clínica usa cadastro público, a família preenche os próprios dados por um link e a recepção converte o cadastro em paciente (veja a categoria Cadastros e recepção).",
            },
          ],
          oQueFazerDepois: [
            {
              titulo: "Preencher a anamnese",
              descricao: "Complete a ficha clínica na aba Avaliação.",
            },
            { titulo: "Vincular à profissional", descricao: "Defina o profissional responsável." },
            { titulo: "Agendar", descricao: "Marque o primeiro atendimento na agenda." },
          ],
        },
      ),
      TUTORIAL_IMPORTAR_PACIENTES,
    ],
  },
  {
    id: "tarefas-alertas",
    titulo: "Tarefas e alertas",
    descricao: "Organização do trabalho da equipe e central de atenção.",
    icon: CheckSquare,
    artigos: [
      tut(
        "usar-tarefas",
        "Como usar as tarefas",
        "A página Tarefas organiza pendências por departamento e prioridade. Cada tarefa tem responsável e prazo; profissionais veem as atribuídas a elas.",
        {
          passos: [
            {
              titulo: "Crie uma tarefa",
              descricao: "Abra Tarefas no menu e crie uma nova, definindo:",
              campos: [
                { campo: "Título", descricao: "O que precisa ser feito." },
                {
                  campo: "Responsável",
                  descricao: "Quem vai executar (profissionais veem as suas).",
                },
                { campo: "Prioridade", descricao: "Ajuda a organizar o que é mais urgente." },
                { campo: "Prazo", descricao: "Data limite da tarefa." },
              ],
              mockup: "tarefas",
            },
            {
              titulo: "Conclua quando terminar",
              descricao:
                "Marque a tarefa como concluída ao finalizar — o histórico fica registrado.",
            },
          ],
        },
      ),
      tut(
        "central-alertas",
        "Central de alertas",
        "A página Alertas reúne pontos que pedem atenção — pendências e situações que o sistema detecta automaticamente. Visite-a periodicamente.",
        {
          passos: [
            {
              titulo: "O que são os alertas",
              descricao:
                "A página Alertas reúne pontos que pedem atenção — pendências e situações que o sistema detecta automaticamente. Vale visitá-la periodicamente para não deixar nada passar.",
              mockup: "tela:Alertas",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "meu-financeiro",
    titulo: "Meu financeiro (repasses)",
    descricao: "Acompanhe seus recebimentos como profissional da clínica.",
    icon: Wallet,
    artigos: [
      tut(
        "ver-repasses",
        "Acompanhar meus recebimentos",
        "A página Meu financeiro mostra seus repasses e recebimentos como profissional, sem expor o financeiro geral da clínica.",
        {
          passos: [
            {
              titulo: "Onde ver",
              descricao:
                "A página Meu financeiro mostra os seus repasses e recebimentos como profissional — sem expor o financeiro geral da clínica. Você acompanha o que foi gerado a partir dos seus atendimentos e o que já foi pago.",
              mockup: "tela:Meu financeiro",
            },
            {
              titulo: "Dúvidas sobre valores",
              descricao:
                "As regras de repasse são definidas pela administração da clínica — para dúvidas sobre valores, fale diretamente com ela.",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "portal-familia",
    titulo: "Portal da família",
    descricao: "O que os responsáveis acessam e como convidá-los.",
    icon: Heart,
    artigos: [
      tut(
        "o-que-familia-ve",
        "O que a família vê no portal",
        "O portal é uma área exclusiva dos responsáveis, com a marca da clínica: evolução compartilhada, diário, relatórios liberados e financeiro do paciente. A família não vê o prontuário interno.",
        {
          passos: [
            {
              titulo: "Uma área só para os responsáveis",
              descricao:
                "O portal é uma área exclusiva para os responsáveis do paciente, com a identidade visual da clínica. Nele a família acompanha a evolução compartilhada, o diário, relatórios liberados e o financeiro do paciente (cobranças e comprovantes).",
              mockup: "portal",
            },
            {
              titulo: "O que fica protegido",
              descricao:
                "A família não tem acesso ao prontuário clínico interno — apenas ao que a clínica decide compartilhar.",
            },
          ],
        },
      ),
      tut(
        "convidar-familia",
        "Convidar uma família para o portal",
        "Na ficha do paciente, gere o convite do portal para o responsável e envie o link. Ao aceitar, ele cria a senha e passa a acessar o portal daquele paciente.",
        {
          passos: [
            {
              titulo: "Gere e envie o convite",
              descricao: "Na ficha do paciente, gere o convite do portal para o responsável:",
              campos: [
                { campo: "1. Abra a ficha", descricao: "Vá até o paciente desejado." },
                {
                  campo: "2. Gere o convite",
                  descricao: "Crie o convite do portal para o responsável.",
                },
                {
                  campo: "3. Envie o link",
                  descricao:
                    "Ao aceitar, o responsável cria a senha e passa a acessar o portal daquele paciente.",
                },
              ],
              mockup: "portal",
            },
          ],
        },
        true,
      ),
    ],
  },
  {
    id: "cadastros-recepcao",
    titulo: "Cadastros e recepção",
    descricao: "Links públicos de cadastro e conversão em paciente.",
    icon: Link2,
    gestao: true,
    artigos: [
      tut(
        "cadastro-publico",
        "Cadastro público: a família preenche, a recepção confere",
        "A página Cadastros gerencia links públicos: a família preenche os próprios dados e a recepção converte o cadastro em paciente com um clique, sem redigitar nada.",
        {
          passos: [
            {
              titulo: "Envie o link para a família",
              descricao:
                "A página Cadastros gerencia os links públicos: a família preenche os próprios dados (e, se a clínica emitir nota fiscal, informa em nome de quem emitir).",
              mockup: "cadastros",
            },
            {
              titulo: "Acompanhe e converta",
              descricao: "Acompanhe a situação dos formulários recebidos e converta em paciente:",
              campos: [
                {
                  campo: "Situação",
                  descricao: "Veja quais cadastros estão pendentes ou completos.",
                },
                {
                  campo: "Converter",
                  descricao:
                    "Um cadastro completo vira paciente com um clique, sem redigitar nada.",
                },
              ],
            },
          ],
        },
      ),
    ],
  },
  {
    id: "financeiro-clinica",
    titulo: "Financeiro da clínica",
    descricao: "Receitas, despesas, contas, plano de contas e fornecedores.",
    icon: DollarSign,
    gestao: true,
    artigos: [
      tut(
        "visao-financeiro",
        "Visão geral do financeiro",
        "A página Financeiro concentra entradas e saídas da clínica, com resumo do período e lançamentos, usando o plano de contas, as contas/caixas e os centros de custo.",
        {
          passos: [
            {
              titulo: "Entradas, saídas e resumo",
              descricao:
                "A página Financeiro concentra as entradas e saídas da clínica, com o resumo do período e os lançamentos detalhados. Os lançamentos usam o plano de contas, as contas/caixas e os centros de custo definidos em Configurações → Financeiro.",
              mockup: "financeiro",
            },
          ],
        },
      ),
      tut(
        "estrutura-financeira",
        "Configurar a estrutura financeira",
        "Em Configurações → Financeiro, monte o plano de contas, as contas/caixas, os tipos de serviço com valor, os centros de custo e os fornecedores.",
        {
          passos: [
            {
              titulo: "Monte a base em Configurações",
              descricao: "Em Configurações → Financeiro, prepare a estrutura:",
              campos: [
                {
                  campo: "Plano de contas",
                  descricao: "Categorias de entrada (receita) e saída (despesa).",
                },
                {
                  campo: "Contas / caixas",
                  descricao: "Banco, dinheiro, maquininha — com saldo inicial.",
                },
                {
                  campo: "Tipos de serviço",
                  descricao: "Com valor padrão, para agilizar a cobrança.",
                },
                {
                  campo: "Centros de custo e fornecedores",
                  descricao: "Conforme a necessidade da clínica.",
                },
              ],
              mockup: "configuracoes",
            },
            {
              titulo: "Comece simples",
              descricao: "Uma estrutura enxuta e consistente vale mais que uma detalhada demais.",
              dica: "Comece com poucas categorias e refine com o uso — dá para ajustar a qualquer momento.",
            },
          ],
        },
      ),
      tut(
        "repasses-equipe",
        "Repasses para a equipe",
        "Os valores devidos a cada profissional aparecem para ela em Meu financeiro. A administração controla as regras e a quitação pelo financeiro da clínica.",
        {
          passos: [
            {
              titulo: "Como funcionam os repasses",
              descricao:
                "Os valores devidos a cada profissional aparecem para ela na página Meu financeiro. A administração controla as regras e a quitação dos repasses pelo financeiro da clínica, mantendo a visão de cada profissional restrita aos próprios valores.",
              mockup: "financeiro",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "contratos",
    titulo: "Contratos",
    descricao: "Modelos, geração e assinatura de contratos com as famílias.",
    icon: FileText,
    gestao: true,
    artigos: [
      tut(
        "gerar-contrato",
        "Gerar um contrato a partir de um modelo",
        "A página Contratos guarda modelos e contratos gerados. Os modelos preenchem automaticamente os dados do paciente e da clínica; envie o link de assinatura ao responsável.",
        {
          passos: [
            {
              titulo: "Prepare o modelo e gere",
              descricao:
                "A página Contratos guarda seus modelos e os contratos gerados. Os modelos aceitam campos preenchidos automaticamente com os dados do paciente e da clínica.",
              campos: [
                { campo: "1. Modelo", descricao: "Cadastre ou ajuste um modelo de contrato." },
                {
                  campo: "2. Gerar",
                  descricao: "Escolha o paciente — os campos são preenchidos automaticamente.",
                },
                {
                  campo: "3. Assinatura",
                  descricao: "Envie o link de assinatura ao responsável e acompanhe o status.",
                },
              ],
              mockup: "contratos",
            },
            {
              titulo: "Logo e dados nos documentos",
              descricao:
                "A logo e os dados cadastrais que aparecem vêm de Configurações → Identidade da clínica.",
              dica: "Preencha a identidade da clínica antes de gerar contratos, para que os documentos já saiam com a sua marca.",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "equipe",
    titulo: "Equipe e permissões",
    descricao: "Convites, papéis e vínculo entre profissionais e pacientes.",
    icon: UserCog,
    gestao: true,
    artigos: [
      tut(
        "convidar-membro",
        "Convidar alguém para a equipe",
        "Em Equipe, crie um convite, escolha o papel e as especialidades, e envie o link. A pessoa cria a conta e já entra na clínica com o papel definido.",
        {
          passos: [
            {
              titulo: "Crie o convite",
              descricao: "Abra Equipe no menu e crie um convite:",
              campos: [
                { campo: "Papel", descricao: "Admin, profissional ou secretária." },
                { campo: "Especialidades", descricao: "Se for o caso, para profissionais." },
                {
                  campo: "Link do convite",
                  descricao: "A pessoa cria a conta e entra com o papel definido.",
                },
              ],
              mockup: "equipe",
            },
            {
              titulo: "Gerencie os convites",
              descricao:
                "Convites pendentes aparecem na própria página de Equipe — você pode reenviá-los ou cancelá-los a qualquer momento.",
            },
          ],
        },
      ),
      tut(
        "vinculo-paciente-profissional",
        "Vincular pacientes a uma profissional",
        "O vínculo paciente ↔ profissional define o que cada terapeuta enxerga. É gerenciado pela administradora — sem ele, a profissional não vê o paciente.",
        {
          passos: [
            {
              titulo: "O que o vínculo controla",
              descricao:
                "O vínculo paciente ↔ profissional define o que cada terapeuta enxerga: agenda, prontuário e plano terapêutico apenas dos pacientes vinculados a ela. É gerenciado pela administradora.",
              mockup: "equipe",
            },
            {
              titulo: "Não esqueça ao receber um paciente novo",
              descricao: "Ao receber um paciente novo, crie o vínculo.",
              dica: "Sem o vínculo, a profissional não vê o paciente — é a causa mais comum de “o paciente não aparece para mim”.",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "sublocacao",
    titulo: "Sublocação de salas",
    descricao: "Salas, sublocadores, contratos e portal de reservas.",
    icon: DoorOpen,
    gestao: true,
    artigos: [
      tut(
        "gerir-sublocacao",
        "Gerenciar salas e sublocadores",
        "A página Sublocação organiza salas, sublocadores, contratos e usos. Cada sublocador recebe um link do portal para reservar e trocar horários sozinho.",
        {
          passos: [
            {
              titulo: "Cadastre salas e sublocadores",
              descricao: "A página Sublocação organiza os espaços da clínica:",
              campos: [
                {
                  campo: "Salas",
                  descricao: "Cadastre as salas e defina a disponibilidade de cada uma.",
                },
                {
                  campo: "Sublocadores",
                  descricao: "Cadastre e gere o link do portal de salas para cada um.",
                },
                {
                  campo: "Contratos e usos",
                  descricao: "Acompanhe os contratos de sublocação e os usos registrados.",
                },
              ],
              mockup: "tela:Sublocação",
            },
            {
              titulo: "Portal de reservas",
              descricao:
                "Cada sublocador pode reservar e trocar horários pelo link do portal, sem depender da recepção.",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "gestao-indicadores",
    titulo: "Indicadores e crescimento",
    descricao: "Panorama da clínica e comercial.",
    icon: BarChart3,
    gestao: true,
    artigos: [
      tut(
        "indicadores",
        "Ler os indicadores da clínica",
        "A página Indicadores traz o panorama do mês: atendimentos por modalidade, frequência e resumo geral. Os números dependem dos registros do dia a dia.",
        {
          passos: [
            {
              titulo: "O panorama do mês",
              descricao:
                "A página Indicadores traz atendimentos por modalidade, frequência e o resumo geral. Os números dependem dos registros do dia a dia — agenda com status de frequência atualizados e financeiro lançado.",
              mockup: "tela:Indicadores",
            },
          ],
        },
      ),
      tut(
        "comercial",
        "Comercial: acompanhar contatos e oportunidades",
        "A página Comercial acompanha o funil de novos contatos até virarem pacientes, para não perder oportunidades entre a primeira conversa e a primeira sessão.",
        {
          passos: [
            {
              titulo: "O funil de novos contatos",
              descricao:
                "A página Comercial acompanha o funil de novos contatos até virarem pacientes — útil para não perder oportunidades entre a primeira conversa e a primeira sessão.",
              mockup: "tela:Comercial",
            },
          ],
        },
      ),
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Identidade da clínica, catálogo clínico, financeiro e IA.",
    icon: Settings,
    gestao: true,
    artigos: [
      tut(
        "identidade-clinica",
        "Identidade da clínica: logo, dados e cor do sistema",
        "Em Configurações → Identidade da clínica, defina a logo e os dados que aparecem nos documentos e a cor do sistema para toda a equipe.",
        {
          passos: [
            {
              titulo: "Logo, dados e cor",
              descricao:
                "Em Configurações → Identidade da clínica, defina a logo e os dados cadastrais que aparecem nos documentos gerados (contratos, relatórios, planos) e a cor do sistema para toda a equipe.",
              mockup: "configuracoes",
            },
            {
              titulo: "Nota fiscal",
              descricao:
                "Aqui também você ativa a pergunta de nota fiscal no cadastro público, caso a clínica emita NF.",
            },
          ],
        },
      ),
      tut(
        "catalogo-clinico",
        "Catálogo clínico: diagnósticos, habilidades e baterias",
        "O catálogo padroniza o vocabulário da equipe: diagnósticos, habilidades, baterias por demanda e os bancos de recursos e referências.",
        {
          passos: [
            {
              titulo: "Padronize o vocabulário",
              descricao:
                "O catálogo clínico padroniza diagnósticos, categorias de habilidades e habilidades usadas nos planos, além das baterias por demanda (modelos de avaliação aplicados em um clique) e dos bancos de recursos e referências.",
              mockup: "configuracoes",
            },
            {
              titulo: "Referências alimentam a IA",
              descricao:
                "O Banco de Referências alimenta a IA do sistema: referências fixadas ou relevantes ao caso entram automaticamente no contexto de planos, sessões e relatórios.",
              dica: "Quanto melhor o catálogo, mais consistentes ficam os planos e relatórios de toda a equipe.",
            },
          ],
        },
      ),
      tut(
        "recursos-ia",
        "Recursos de IA do sistema",
        "O Pensya usa IA para apoiar a escrita clínica — planos, registros e relatórios. As preferências ficam em Configurações → IA. A IA é apoio; a profissional sempre revisa.",
        {
          passos: [
            {
              titulo: "IA como apoio à escrita",
              descricao:
                "O Pensya usa IA para apoiar a escrita clínica — planos, registros e relatórios. As preferências ficam em Configurações → IA.",
              mockup: "tela:Configurações · IA",
            },
            {
              titulo: "Sempre com revisão da profissional",
              descricao:
                "A IA é apoio: o conteúdo clínico é sempre revisado e validado pela profissional antes de ser usado.",
            },
          ],
        },
      ),
    ],
  },
];
