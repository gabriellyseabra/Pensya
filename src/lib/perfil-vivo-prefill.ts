import { ANAMNESE_SECOES, faixaDoValor, faixasDoCampo, type CampoDef } from "@/lib/anamnese-schema";
import type { PerfilVivo } from "@/hooks/use-perfil-vivo";

type Secoes = Record<string, Record<string, any>>;

const SECAO_POR_KEY = new Map(ANAMNESE_SECOES.map((s) => [s.key, s]));

function campoDef(secaoKey: string, campoKey: string): CampoDef | undefined {
  return SECAO_POR_KEY.get(secaoKey)?.campos.find((c) => c.key === campoKey);
}

function valor(secoes: Secoes, secaoKey: string, campoKey: string): any {
  return secoes?.[secaoKey]?.[campoKey];
}

/** Formata o valor de um campo de anamnese como texto curto, de acordo com seu tipo. */
function formatarCampo(secoes: Secoes, secaoKey: string, campoKey: string): string {
  const def = campoDef(secaoKey, campoKey);
  const v = valor(secoes, secaoKey, campoKey);
  if (def == null || v == null || v === "") return "";
  switch (def.tipo) {
    case "chips":
    case "multi":
      return Array.isArray(v) && v.length ? v.join(", ") : "";
    case "scale": {
      if (typeof v !== "number") return "";
      const label = faixaDoValor(v, faixasDoCampo(def.escalaLabels));
      return label.replace(/\s*\(.*\)$/, "");
    }
    case "boolean":
      return v ? "Sim" : "Não";
    case "number":
      return String(v);
    default:
      return typeof v === "string" ? v : "";
  }
}

function origemDoCampo(secaoKey: string, campoKey: string): string {
  const secao = SECAO_POR_KEY.get(secaoKey);
  const def = campoDef(secaoKey, campoKey);
  return `${secao?.titulo ?? secaoKey} > ${def?.label ?? campoKey}`;
}

/** Junta os textos de vários campos de anamnese em uma frase única, descartando os vazios. */
function compor(secoes: Secoes, refs: [string, string][]): { texto: string; origem: string[] } {
  const partes: string[] = [];
  const origem: string[] = [];
  for (const [secaoKey, campoKey] of refs) {
    const txt = formatarCampo(secoes, secaoKey, campoKey);
    if (txt) {
      partes.push(txt);
      origem.push(origemDoCampo(secaoKey, campoKey));
    }
  }
  return { texto: partes.join(" · "), origem };
}

function chipsArray(secoes: Secoes, secaoKey: string, campoKey: string): string[] {
  const v = valor(secoes, secaoKey, campoKey);
  return Array.isArray(v) ? v : [];
}

export type SugestoesPerfilVivo = {
  sugestoes: Partial<PerfilVivo>;
  /** Mapeia cada caminho de campo do Perfil Vivo (ex: "contexto_social.rotina") à origem na anamnese, para tooltip. */
  origem: Record<string, string[]>;
};

/**
 * Gera sugestões de preenchimento do Perfil Clínico Vivo a partir dos dados já
 * coletados na Anamnese, evitando que a mesma informação seja digitada duas vezes.
 * Função pura: não acessa rede nem persiste nada — quem usa decide se/quando aplicar.
 */
export function gerarSugestoesPerfilVivo(secoesEstruturadas: Secoes): SugestoesPerfilVivo {
  const secoes = secoesEstruturadas ?? {};
  const origem: Record<string, string[]> = {};
  const add = (path: string, r: { texto: string; origem: string[] }) => {
    if (r.origem.length) origem[path] = r.origem;
    return r.texto || undefined;
  };

  const rotina = compor(secoes, [["rotina", "estrutura_diaria"]]);
  const suporteFamiliar = compor(secoes, [["contexto_familiar", "configuracao"], ["contexto_familiar", "rede_apoio"]]);
  const ambienteSocial = compor(secoes, [["social", "contato_visual"], ["social", "amigos"], ["social", "brincadeira"]]);
  const obsContextoSocial = compor(secoes, [["contexto_familiar", "observacoes"]]);

  const medicacoes = compor(secoes, [["saude", "medicacoes"]]);
  const comorbidades = compor(secoes, [["saude", "condicoes"], ["historico_clinico", "diagnosticos_previos"]]);
  const profissionais = compor(secoes, [["historico_clinico", "tratamentos_anteriores"]]);
  const obsClinico = compor(secoes, [["historico_clinico", "exames"]]);

  const ambienteEscolar = compor(secoes, [["escolar", "escola_atual"], ["escolar", "tipo"], ["escolar", "serie"]]);
  const suportePedagogico = compor(secoes, [["aprendizagem", "estrategias_que_funcionam"]]);
  const dificuldadesEscolares = compor(secoes, [["escolar", "queixas_escola"]]);
  const obsEscolar = compor(secoes, [["escolar", "adaptacao"]]);

  const sugestoes: Partial<PerfilVivo> = {
    contexto_social: {
      rotina: add("contexto_social.rotina", rotina),
      suporte_familiar: add("contexto_social.suporte_familiar", suporteFamiliar),
      ambiente_social: add("contexto_social.ambiente_social", ambienteSocial),
      observacoes: add("contexto_social.observacoes", obsContextoSocial),
    },
    contexto_clinico: {
      medicacoes: add("contexto_clinico.medicacoes", medicacoes),
      comorbidades: add("contexto_clinico.comorbidades", comorbidades),
      profissionais: add("contexto_clinico.profissionais", profissionais),
      observacoes: add("contexto_clinico.observacoes", obsClinico),
    },
    contexto_escolar_detalhes: {
      ambiente: add("contexto_escolar_detalhes.ambiente", ambienteEscolar),
      suporte_pedagogico: add("contexto_escolar_detalhes.suporte_pedagogico", suportePedagogico),
      dificuldades: add("contexto_escolar_detalhes.dificuldades", dificuldadesEscolares),
      observacoes: add("contexto_escolar_detalhes.observacoes", obsEscolar),
    },
    interesses: chipsArray(secoes, "interesses", "interesses"),
    reforcadores: chipsArray(secoes, "interesses", "reforcadores").map((descricao) => ({ descricao, intensidade: "media" as const })),
  };

  if (sugestoes.interesses?.length) origem["interesses"] = [origemDoCampo("interesses", "interesses")];
  if (sugestoes.reforcadores?.length) origem["reforcadores"] = [origemDoCampo("interesses", "reforcadores")];

  return { sugestoes, origem };
}
