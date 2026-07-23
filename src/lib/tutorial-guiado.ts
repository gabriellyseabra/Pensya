import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-role";

/**
 * Tutorial guiado "Conheça o Pensya" — um tour pelas funcionalidades usando a
 * paciente modelo (Sofia), que já vem com a ficha completa. O progresso é por
 * usuário (tabela tutorial_progresso): cada pessoa da equipe faz o próprio
 * tour, no próprio ritmo. Passos de gestão só aparecem para admin/secretária.
 */

/** "O que tem nesta tela" — a função de cada item, mostrada no preview. */
export type PassoItem = { titulo: string; descricao: string };

export type PassoTutorial = {
  key: string;
  titulo: string;
  descricao: string;
  /** Resumo do que a pessoa vai encontrar na tela (mostrado no preview). */
  resumo?: string;
  /** Itens da tela e a função de cada um (mostrados no preview). */
  itens?: PassoItem[];
  /** Ilustração da tela (id de mockup em AjudaMockups). */
  mockup?: string;
  /** Passo visível apenas para admin/secretária. */
  gestao?: boolean;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  done: boolean;
};

type PassoDef = Omit<PassoTutorial, "done">;

function montarPassos(sofiaId: string | null): PassoDef[] {
  // Sem a Sofia (ex.: paciente modelo excluída), os passos dela levam à lista.
  const ficha = (search?: Record<string, string>): Pick<PassoDef, "to" | "params" | "search"> =>
    sofiaId ? { to: "/pacientes/$id", params: { id: sofiaId }, search } : { to: "/pacientes" };

  return [
    {
      key: "ficha",
      titulo: "Abra a ficha da Sofia",
      descricao: "A paciente modelo tem tudo preenchido — comece pelo resumo dela.",
      resumo:
        "A ficha do paciente reúne, em abas, tudo sobre a Sofia: dados, avaliação, plano, sessões, frequência e perfil. O resumo é a visão geral do caso.",
      itens: [
        { titulo: "Cabeçalho", descricao: "Foto, nome, idade, escola e profissional responsável." },
        { titulo: "Abas", descricao: "Cadastro, Avaliação, Plano, Sessões, Frequência e Perfil." },
        {
          titulo: "Resumo",
          descricao: "Queixa, hipótese diagnóstica e um panorama rápido do caso.",
        },
      ],
      mockup: "ficha-paciente",
      ...ficha({ aba: "resumo" }),
    },
    {
      key: "cadastro",
      titulo: "Veja o cadastro e a anamnese",
      descricao: "Dados pessoais, responsáveis, escola e a anamnese completa.",
      resumo:
        "A aba Cadastro guarda os dados civis e a anamnese estruturada — a história de desenvolvimento, saúde, escola e família do paciente.",
      itens: [
        { titulo: "Dados pessoais", descricao: "Nascimento, documentos, contato e endereço." },
        { titulo: "Responsáveis", descricao: "Mãe, pai ou responsável, com contato de cada um." },
        {
          titulo: "Anamnese",
          descricao: "Seções de gestação, desenvolvimento, saúde, escola e rotina.",
        },
      ],
      mockup: "ficha-paciente",
      ...ficha({ aba: "cadastro" }),
    },
    {
      key: "avaliacao",
      titulo: "Veja a avaliação com resultados de testes",
      descricao: "Anamnese estruturada e bateria aplicada, com percentis e interpretação.",
      resumo:
        "A aba Avaliação conduz a testagem: a bateria aplicada, os resultados de cada teste e o raciocínio clínico que integra tudo.",
      itens: [
        {
          titulo: "Testes aplicados",
          descricao: "Cada teste com escore, percentil e classificação automática.",
        },
        {
          titulo: "Interpretação",
          descricao: "Observações qualitativas e leitura clínica de cada resultado.",
        },
        {
          titulo: "Raciocínio clínico",
          descricao: "A síntese que conecta anamnese, testes e queixa.",
        },
      ],
      mockup: "avaliacao",
      ...ficha({ aba: "clinico", sub: "avaliacao" }),
    },
    {
      key: "plano",
      titulo: "Explore o plano terapêutico",
      descricao: "Metas funcionais, escala GAS e estratégias baseadas em evidências.",
      resumo:
        "A aba Plano mostra o plano terapêutico: o perfil CIF, as metas funcionais e, em cada meta, a escala GAS e as estratégias de intervenção.",
      itens: [
        { titulo: "Perfil CIF", descricao: "Funções, atividades, participação e fatores do caso." },
        {
          titulo: "Metas funcionais",
          descricao: "O que o paciente vai conseguir fazer no dia a dia.",
        },
        {
          titulo: "Escala GAS",
          descricao: "Cinco níveis por meta (-2 a +2) para medir o progresso.",
        },
      ],
      mockup: "plano",
      ...ficha({ aba: "clinico", sub: "plano" }),
    },
    {
      key: "sessoes",
      titulo: "Leia as evoluções no prontuário",
      descricao: "Sessões registradas e vinculadas às metas do plano.",
      resumo:
        "A aba Sessões é o prontuário: o registro de cada atendimento, com a evolução, os recursos usados e o vínculo com as metas do plano.",
      itens: [
        {
          titulo: "Evolução",
          descricao: "O que foi trabalhado e as respostas do paciente na sessão.",
        },
        {
          titulo: "Metas da sessão",
          descricao: "Quais metas foram trabalhadas e o progresso (GAS) de cada uma.",
        },
        {
          titulo: "Orientação para casa",
          descricao: "O que a família deve fazer até a próxima sessão.",
        },
      ],
      mockup: "prontuario",
      ...ficha({ aba: "clinico", sub: "sessoes" }),
    },
    {
      key: "perfil",
      titulo: "Conheça o perfil clínico vivo",
      descricao: "O que funciona com a Sofia: reforçadores, barreiras e estratégias.",
      resumo:
        "O Perfil clínico vivo reúne o que se aprende sobre o paciente ao longo do acompanhamento — o que funciona e o que atrapalha.",
      itens: [
        { titulo: "Reforçadores e interesses", descricao: "O que motiva e engaja o paciente." },
        { titulo: "Barreiras", descricao: "O que atrapalha o desempenho e deve ser evitado." },
        { titulo: "Estratégias", descricao: "O que funciona (e o que não funciona) na prática." },
      ],
      mockup: "tela:Perfil clínico vivo",
      ...ficha({ aba: "clinico", sub: "perfil" }),
    },
    {
      key: "frequencia",
      titulo: "Confira a frequência",
      descricao: "Presenças e faltas da Sofia, ligadas aos atendimentos da agenda.",
      resumo:
        "A aba Frequência mostra o histórico de presenças, faltas e reposições, ligado aos atendimentos marcados na agenda.",
      itens: [
        {
          titulo: "Presenças e faltas",
          descricao: "O status de cada atendimento ao longo do tempo.",
        },
        { titulo: "Reposições", descricao: "Atendimentos remarcados e como ficaram." },
        { titulo: "Indicadores", descricao: "A frequência alimenta os números da clínica." },
      ],
      mockup: "agenda",
      ...ficha({ aba: "clinico", sub: "frequencia" }),
    },
    {
      key: "agenda",
      titulo: "Conheça a agenda",
      descricao: "É aqui que os atendimentos são marcados, com modalidade e sala.",
      resumo:
        "A Agenda é onde os atendimentos são marcados. Clique num horário para criar, escolhendo paciente, profissional, modalidade e local.",
      itens: [
        {
          titulo: "Marcar atendimento",
          descricao: "Clique num horário e preencha os dados do encontro.",
        },
        {
          titulo: "Modalidades coloridas",
          descricao: "Presencial, Online e Domiciliar têm cores próprias.",
        },
        {
          titulo: "Status de frequência",
          descricao: "Registre presença ou falta direto no atendimento.",
        },
      ],
      mockup: "agenda",
      to: "/agenda",
    },
    {
      key: "tarefas",
      titulo: "Organize-se com as tarefas",
      descricao: "Pendências da clínica com responsável, prioridade e prazo.",
      resumo:
        "A página Tarefas organiza as pendências da clínica por departamento e prioridade, cada uma com responsável e prazo.",
      itens: [
        { titulo: "Criar tarefa", descricao: "Título, responsável, prioridade e prazo." },
        { titulo: "Por prioridade", descricao: "As mais urgentes ficam em destaque." },
        { titulo: "Concluir", descricao: "Marque como feita — o histórico fica registrado." },
      ],
      mockup: "tarefas",
      to: "/tarefas",
    },
    {
      key: "identidade",
      titulo: "Deixe a clínica com a sua cara",
      descricao: "Logo, dados e cor do sistema — aparecem nos seus documentos.",
      resumo:
        "Em Configurações → Identidade da clínica você define a logo, os dados cadastrais e a cor do sistema para toda a equipe.",
      itens: [
        {
          titulo: "Logo e dados",
          descricao: "Aparecem nos contratos, relatórios e planos gerados.",
        },
        {
          titulo: "Cor do sistema",
          descricao: "Personaliza botões e destaques para toda a equipe.",
        },
        {
          titulo: "Nota fiscal",
          descricao: "Ative a pergunta de NF no cadastro público, se emitir.",
        },
      ],
      mockup: "configuracoes",
      gestao: true,
      to: "/configuracoes",
    },
    {
      key: "equipe",
      titulo: "Convide sua equipe",
      descricao: "Cada pessoa entra com o papel certo: admin, profissional ou secretária.",
      resumo:
        "A página Equipe gerencia quem faz parte da clínica: convites, papéis e o vínculo de cada profissional com seus pacientes.",
      itens: [
        { titulo: "Convidar", descricao: "Envie um link; a pessoa entra com o papel definido." },
        {
          titulo: "Papéis",
          descricao: "Admin, profissional ou secretária — cada um vê o que precisa.",
        },
        {
          titulo: "Vínculo com pacientes",
          descricao: "Define quais pacientes cada profissional enxerga.",
        },
      ],
      mockup: "equipe",
      gestao: true,
      to: "/equipe",
    },
    {
      key: "financeiro",
      titulo: "Explore o financeiro",
      descricao: "Entradas, saídas e o resumo do período da clínica.",
      resumo:
        "A página Financeiro concentra as entradas e saídas da clínica, com o resumo do período e os lançamentos detalhados.",
      itens: [
        { titulo: "Resumo do período", descricao: "Total de entradas, saídas e saldo." },
        { titulo: "Lançamentos", descricao: "Cada receita e despesa, por categoria e conta." },
        { titulo: "Repasses", descricao: "O que é devido a cada profissional da equipe." },
      ],
      mockup: "financeiro",
      gestao: true,
      to: "/financeiro",
    },
    {
      key: "cadastros",
      titulo: "Gere um link de cadastro público",
      descricao: "A família preenche os dados e você converte em paciente em 1 clique.",
      resumo:
        "A página Cadastros cria links públicos: a família preenche os próprios dados e a recepção converte o cadastro em paciente.",
      itens: [
        { titulo: "Link público", descricao: "Envie para a família preencher o cadastro." },
        {
          titulo: "Situação",
          descricao: "Acompanhe quais formulários chegaram e estão completos.",
        },
        { titulo: "Converter", descricao: "Um cadastro completo vira paciente com um clique." },
      ],
      mockup: "cadastros",
      gestao: true,
      to: "/cadastros",
    },
    {
      key: "ajuda",
      titulo: "Visite a Central de Ajuda",
      descricao: "Guias rápidos de todas as áreas, sempre à mão no menu lateral.",
      resumo:
        "A Central de Ajuda reúne tutoriais detalhados de cada área do sistema, com passos ilustrados. Fica no ícone de ajuda no topo e no menu.",
      itens: [
        { titulo: "Busca", descricao: "Ache um guia por palavra (ex.: “importar”, “agenda”)." },
        { titulo: "Categorias", descricao: "Tutoriais organizados por área do sistema." },
        {
          titulo: "Sempre à mão",
          descricao: "Acesse pelo ícone de boia no topo, a qualquer momento.",
        },
      ],
      mockup: "tela:Central de ajuda",
      to: "/central-de-ajuda",
    },
  ];
}

type Progresso = {
  passos_concluidos: string[];
  dispensado_em: string | null;
};

export function useTutorialGuiado() {
  const qc = useQueryClient();
  const { isTerapeutaRestrito, isLoading: rolesCarregando } = useRoles();

  const { data: sofiaId } = useQuery({
    queryKey: ["paciente-modelo-id"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id")
        .eq("is_modelo", true)
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const { data: progresso, isLoading: progressoCarregando } = useQuery({
    queryKey: ["tutorial-progresso"],
    queryFn: async (): Promise<Progresso> => {
      const { data } = await supabase
        .from("tutorial_progresso")
        .select("passos_concluidos, dispensado_em")
        .maybeSingle();
      return data ?? { passos_concluidos: [], dispensado_em: null };
    },
  });

  const salvar = useMutation({
    mutationFn: async (patch: Partial<Progresso>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const { error } = await supabase.from("tutorial_progresso").upsert(
        {
          user_id: u.user.id,
          passos_concluidos: patch.passos_concluidos ?? progresso?.passos_concluidos ?? [],
          dispensado_em:
            patch.dispensado_em !== undefined
              ? patch.dispensado_em
              : (progresso?.dispensado_em ?? null),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutorial-progresso"] }),
  });

  const concluidos = new Set(progresso?.passos_concluidos ?? []);
  const passos: PassoTutorial[] = montarPassos(sofiaId ?? null)
    .filter((p) => !p.gestao || !isTerapeutaRestrito)
    .map((p) => ({ ...p, done: concluidos.has(p.key) }));

  const feitos = passos.filter((p) => p.done).length;
  const pct = passos.length ? Math.round((feitos / passos.length) * 100) : 0;

  return {
    passos,
    feitos,
    pct,
    completo: passos.length > 0 && feitos === passos.length,
    dispensado: !!progresso?.dispensado_em,
    carregado: !progressoCarregando && !rolesCarregando,
    marcarPasso: (key: string) => {
      if (concluidos.has(key)) return;
      salvar.mutate({ passos_concluidos: [...concluidos, key] });
    },
    dispensar: () => salvar.mutate({ dispensado_em: new Date().toISOString() }),
    reabrir: () => salvar.mutate({ dispensado_em: null }),
  };
}
