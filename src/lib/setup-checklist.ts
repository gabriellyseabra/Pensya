import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SetupItem = {
  key: string;
  label: string;
  descricao: string;
  done: boolean;
  href: string;
};

const DISMISS_KEY = "setup-checklist-dismissed";

export function isSetupDismissed(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissSetup() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Conta linhas sem baixar dados; em erro (tabela ausente etc.) trata como "ok". */
async function contar(tabela: string, filtro?: (q: any) => any): Promise<number> {
  try {
    let q: any = supabase.from(tabela as any).select("id", { count: "exact", head: true });
    if (filtro) q = filtro(q);
    const { count, error } = await q;
    if (error) return 1; // fail-safe: nunca cobrar algo que não dá para verificar
    return count ?? 0;
  } catch {
    return 1;
  }
}

/**
 * Checklist de primeiros passos, computado no cliente (zero tabela nova).
 * Auto-completa em clínicas já em uso; o card se esconde a 100%.
 */
export function useSetupChecklist() {
  const dismissed = isSetupDismissed();

  const { data } = useQuery({
    queryKey: ["setup-checklist"],
    enabled: !dismissed,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [profissionais, servicosComValor, identidade, pacientes, atendimentos, sessoes] =
        await Promise.all([
          contar("profissionais_consultorio"),
          contar("tipos_servico", (q) => q.gt("valor_padrao", 0)),
          // Identidade: logo ou cor personalizada na organização (Pensya).
          // Na Nave a tabela não existe → contar() devolve 1 (concluído).
          contar("organizacoes", (q) => q.not("logo_path", "is", null)),
          contar("pacientes"),
          contar("atendimentos"),
          contar("prontuario_sessoes"),
        ]);
      return { profissionais, servicosComValor, identidade, pacientes, atendimentos, sessoes };
    },
  });

  const itens: SetupItem[] = data
    ? [
        {
          key: "equipe",
          label: "Cadastre os profissionais da clínica",
          descricao: "Inclua você e sua equipe — é o que libera a agenda e a folha.",
          done: data.profissionais > 0,
          href: "/equipe",
        },
        {
          key: "servicos",
          label: "Defina seus serviços e valores",
          descricao: "Sessão, avaliação, devolutiva… com os preços que você pratica.",
          done: data.servicosComValor > 0,
          href: "/configuracoes",
        },
        {
          key: "identidade",
          label: "Personalize a identidade da clínica",
          descricao: "Logo e cor aparecem nos documentos e no cadastro público.",
          done: data.identidade > 0,
          href: "/configuracoes",
        },
        {
          key: "paciente",
          label: "Cadastre o primeiro paciente",
          descricao: "Só o nome basta para começar — o resto se completa depois.",
          done: data.pacientes > 0,
          href: "/pacientes",
        },
        {
          key: "agenda",
          label: "Crie o primeiro agendamento",
          descricao: "Salas e modalidades já vêm prontas; é só marcar o horário.",
          done: data.atendimentos > 0,
          href: "/agenda",
        },
        {
          key: "sessao",
          label: "Registre a primeira sessão",
          descricao: "O prontuário nasce aqui — com resumo por IA se quiser.",
          done: data.sessoes > 0,
          href: "/pacientes",
        },
      ]
    : [];

  const feitos = itens.filter((i) => i.done).length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;
  const completo = itens.length > 0 && feitos === itens.length;

  return { itens, feitos, pct, completo, carregado: !!data, dismissed };
}
