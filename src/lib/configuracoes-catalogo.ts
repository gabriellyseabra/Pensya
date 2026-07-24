/**
 * Metadados das entradas de Configurações: o que é cada catálogo, quando usar
 * e se é essencial ou avançado. As chaves casam com as abas do índice de
 * Configurações de cada sistema; rotas dedicadas entram em ROTAS_EXTRA.
 */
export type NivelConfig = "essencial" | "avancado";

export const DESCRICOES: Record<string, { descricao: string; nivel: NivelConfig }> = {
  __identidade: { descricao: "Nome, logo e cor da clínica — aparecem nos documentos e no cadastro público.", nivel: "essencial" },
  locais: { descricao: "Salas e locais de atendimento que aparecem na agenda.", nivel: "essencial" },
  modalidades: { descricao: "Tipos de atendimento (Psicopedagogia, Fono…) com cor própria na agenda.", nivel: "essencial" },
  status_frequencia: { descricao: "Status possíveis de um atendimento (presente, falta…) e se contam presença.", nivel: "essencial" },
  tipos_servico: { descricao: "Serviços que você cobra (sessão, avaliação…) com valor padrão.", nivel: "essencial" },
  contas_financeiras: { descricao: "Contas e caixas por onde o dinheiro entra e sai.", nivel: "essencial" },
  __plano_contas: { descricao: "Categorias de receitas e despesas usadas nos lançamentos e no DRE.", nivel: "avancado" },
  centros_custo: { descricao: "Agrupadores de despesa para análise gerencial (opcional).", nivel: "avancado" },
  fornecedores: { descricao: "Quem você paga — usados nas contas a pagar.", nivel: "avancado" },
  diagnosticos: { descricao: "Catálogo de diagnósticos/CIDs usados nas fichas dos pacientes.", nivel: "avancado" },
  categorias_habilidades: { descricao: "Agrupadores das habilidades trabalhadas em sessão.", nivel: "avancado" },
  habilidades: { descricao: "Habilidades acompanhadas nos planos e sessões.", nivel: "avancado" },
  escolas: { descricao: "Escolas dos pacientes — para contato e reuniões escolares.", nivel: "avancado" },
  especialidades: { descricao: "Especialidades dos profissionais da equipe.", nivel: "avancado" },
  profissionais_externos: { descricao: "Parceiros que não usam o sistema (marketing, social media…).", nivel: "avancado" },
  __baterias_link: { descricao: "Modelos de baterias de testes por demanda (TDAH, Dislexia…).", nivel: "avancado" },
  __recursos_link: { descricao: "Banco de jogos, materiais e estratégias por habilidade.", nivel: "avancado" },
  __referencias_link: { descricao: "Artigos e materiais que alimentam a IA nas sugestões clínicas.", nivel: "avancado" },
};

/** Rotas de configuração com página própria (ficavam escondidas). */
export const ROTAS_EXTRA: { key: string; label: string; href: string; descricao: string; nivel: NivelConfig }[] = [
  { key: "instrumentos", label: "Instrumentos", href: "/configuracoes/instrumentos", descricao: "Escalas e instrumentos aplicáveis aos pacientes.", nivel: "avancado" },
  { key: "rubricas", label: "Rubricas de classificação", href: "/configuracoes/rubricas", descricao: "Réguas de faixas (percentil/escore) por teste — presets + as suas (TDE II, Seabra…).", nivel: "avancado" },
  { key: "protocolos", label: "Biblioteca de Protocolos", href: "/configuracoes/protocolos", descricao: "Protocolos clínicos reutilizáveis nas sessões.", nivel: "avancado" },
  { key: "ia", label: "IA & Automações", href: "/configuracoes/ia", descricao: "Preferências da inteligência artificial e automações.", nivel: "avancado" },
  { key: "baterias", label: "Baterias por demanda", href: "/configuracoes/baterias", descricao: "Modelos de baterias de testes (TDAH, Dislexia…).", nivel: "avancado" },
  { key: "recursos", label: "Banco de Recursos", href: "/configuracoes/recursos", descricao: "Jogos, materiais e estratégias por habilidade.", nivel: "avancado" },
  { key: "referencias", label: "Banco de Referências", href: "/configuracoes/referencias", descricao: "Artigos e materiais que alimentam a IA.", nivel: "avancado" },
];

export function infoDe(key: string): { descricao: string; nivel: NivelConfig } {
  return DESCRICOES[key] ?? { descricao: "", nivel: "avancado" };
}
