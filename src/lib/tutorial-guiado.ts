import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-role";

/**
 * Tutorial guiado "Conheça o Pensya" — um tour pelas funcionalidades usando a
 * paciente modelo (Sofia), que já vem com a ficha completa. O progresso é por
 * usuário (tabela tutorial_progresso): cada pessoa da equipe faz o próprio
 * tour, no próprio ritmo. Passos de gestão só aparecem para admin/secretária.
 */

export type PassoTutorial = {
  key: string;
  titulo: string;
  descricao: string;
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
      ...ficha({ aba: "resumo" }),
    },
    {
      key: "cadastro",
      titulo: "Veja o cadastro e a anamnese",
      descricao: "Dados pessoais, responsáveis, escola e a anamnese completa.",
      ...ficha({ aba: "cadastro" }),
    },
    {
      key: "avaliacao",
      titulo: "Veja a avaliação com resultados de testes",
      descricao: "Anamnese estruturada e bateria aplicada, com percentis e interpretação.",
      ...ficha({ aba: "clinico", sub: "avaliacao" }),
    },
    {
      key: "plano",
      titulo: "Explore o plano terapêutico",
      descricao: "Metas funcionais, escala GAS e estratégias baseadas em evidências.",
      ...ficha({ aba: "clinico", sub: "plano" }),
    },
    {
      key: "sessoes",
      titulo: "Leia as evoluções no prontuário",
      descricao: "Sessões registradas e vinculadas às metas do plano.",
      ...ficha({ aba: "clinico", sub: "sessoes" }),
    },
    {
      key: "perfil",
      titulo: "Conheça o perfil clínico vivo",
      descricao: "O que funciona com a Sofia: reforçadores, barreiras e estratégias.",
      ...ficha({ aba: "clinico", sub: "perfil" }),
    },
    {
      key: "frequencia",
      titulo: "Confira a frequência",
      descricao: "Presenças e faltas da Sofia, ligadas aos atendimentos da agenda.",
      ...ficha({ aba: "clinico", sub: "frequencia" }),
    },
    {
      key: "agenda",
      titulo: "Conheça a agenda",
      descricao: "É aqui que os atendimentos são marcados, com modalidade e sala.",
      to: "/agenda",
    },
    {
      key: "tarefas",
      titulo: "Organize-se com as tarefas",
      descricao: "Pendências da clínica com responsável, prioridade e prazo.",
      to: "/tarefas",
    },
    {
      key: "identidade",
      titulo: "Deixe a clínica com a sua cara",
      descricao: "Logo, dados e cor do sistema — aparecem nos seus documentos.",
      gestao: true,
      to: "/configuracoes",
    },
    {
      key: "equipe",
      titulo: "Convide sua equipe",
      descricao: "Cada pessoa entra com o papel certo: admin, profissional ou secretária.",
      gestao: true,
      to: "/equipe",
    },
    {
      key: "financeiro",
      titulo: "Explore o financeiro",
      descricao: "Entradas, saídas e o resumo do período da clínica.",
      gestao: true,
      to: "/financeiro",
    },
    {
      key: "cadastros",
      titulo: "Gere um link de cadastro público",
      descricao: "A família preenche os dados e você converte em paciente em 1 clique.",
      gestao: true,
      to: "/cadastros",
    },
    {
      key: "ajuda",
      titulo: "Visite a Central de Ajuda",
      descricao: "Guias rápidos de todas as áreas, sempre à mão no menu lateral.",
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
