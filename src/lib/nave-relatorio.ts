/**
 * Padrão Nave para relatórios/laudos gerados no sistema.
 *
 * Consolida a lógica da skill "relatorioavaliacao-nave":
 *  - regras de escrita clínica (tom, o que nunca usar, ancoragens causais);
 *  - estrutura de seções do relatório de avaliação;
 *  - paleta de cores e estilos (CSS) para a versão HTML/impressão;
 *  - classificação de percentis (Guilmette, 2020) com cores;
 *  - geração de gráfico SVG do perfil cognitivo (sem dependências externas).
 *
 * É um módulo neutro (sem imports de servidor) para ser usado tanto na
 * server function de geração quanto no componente que imprime o documento.
 */

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------
export const NAVE_CORES = {
  petroleo: "#064570",
  rose: "#C9A0B5",
  verde: "#C8E6C9",
  amarelo: "#FFF9C4",
  salmao: "#FFCCBC",
  vermelho: "#FFCDD2",
  bordaTabela: "#E8E8E8",
};

// ---------------------------------------------------------------------------
// Classificação de percentil (Guilmette et al., 2020)
// ---------------------------------------------------------------------------
export type ClasseDesempenho = {
  chave: "medio_superior" | "medio_inferior" | "inferior" | "muito_inferior";
  label: string;
  cor: string;
};

export function classificarPercentil(p: number | null | undefined): ClasseDesempenho {
  const v = Number(p);
  if (p == null || Number.isNaN(v)) return { chave: "inferior", label: "—", cor: "transparent" };
  if (v >= 25) return { chave: "medio_superior", label: "Médio / Superior", cor: NAVE_CORES.verde };
  if (v >= 16) return { chave: "medio_inferior", label: "Médio inferior", cor: NAVE_CORES.amarelo };
  if (v >= 9) return { chave: "inferior", label: "Inferior à média", cor: NAVE_CORES.salmao };
  return { chave: "muito_inferior", label: "Muito inferior", cor: NAVE_CORES.vermelho };
}

// ---------------------------------------------------------------------------
// Regras de escrita clínica (injetadas no system prompt da IA)
// ---------------------------------------------------------------------------
export const REGRAS_ESCRITA_NAVE = `REGRAS DE ESCRITA CLÍNICA (padrão Nave — obrigatórias):
- Linguagem técnica com explicações didáticas acessíveis à família e à escola; prosa corrida justificada (não bullets no corpo do texto).
- NUNCA usar: "perfil heterogêneo"/"perfil homogêneo"; "observa-se que", "evidencia-se que", "é importante destacar", "cabe mencionar", "conforme observado".
- NUNCA usar travessões (—): substituir por dois-pontos (:) ou ponto-e-vírgula (;).
- Bold apenas em achados clinicamente relevantes (máximo 2 por parágrafo); nada de bold decorativo.
- Variar os verbos de análise: demonstra / revela / evidencia / indica / aponta / contrasta com / sugere / reforça.
- Sempre ancorar em dados: usar conectivos causais explícitos ("esse padrão sugere que...", "o que se articula com...", "isso explica por que...").
- Conectar, em cada domínio, o quantitativo + o qualitativo + o contexto escolar + o contexto familiar, terminando com o IMPACTO FUNCIONAL concreto no cotidiano.
- Apresentar contraevidências ou ambiguidades quando existirem; nunca afirmar diagnóstico — apresentar hipótese com critérios e cautela.
- Orientações sempre específicas e implementáveis (não genéricas): separar "Para a família" e "Para a escola".
- Não repetir informações entre domínios e conclusão.`;

// ---------------------------------------------------------------------------
// Estrutura padrão do relatório de avaliação Nave
// ---------------------------------------------------------------------------
export const ESTRUTURA_AVALIACAO_NAVE = `1. Identificação do paciente
2. Descrição da demanda (queixa da família + escola; objetivos da avaliação)
3. Procedimentos (entrevistas + instrumentos aplicados com referências)
4. Histórico do desenvolvimento
5. Comportamento e vínculo com a aprendizagem
6. Análise dos resultados por domínio (cada domínio: parágrafo de abertura, tabela de resultados com cores por classificação, e "Integração dos achados" com impacto funcional)
7. Perfil clínico: síntese das habilidades (incluir o marcador {{GRAFICO_PERFIL}} onde entra o gráfico do perfil cognitivo)
8. Conclusão (3–5 parágrafos)
9. Encaminhamentos (justificados nos achados)
10. Orientações (Para a família / Para a escola)
11. Referências`;

/**
 * Instruções de marcação HTML para a IA usar as cores de classificação e o
 * marcador do gráfico. Injetadas no prompt.
 */
export const INSTRUCOES_HTML_NAVE = `FORMATO DE SAÍDA (HTML semântico, sem CSS inline, sem <html>/<body>, sem markdown):
- Use <h2> para as seções numeradas e <h3> para subseções/domínios.
- Nas tabelas de resultados por domínio, a célula de classificação deve receber a classe correspondente ao percentil:
  P≥25 => class="cls-verde"; P16–24 => class="cls-amarelo"; P9–15 => class="cls-salmao"; P<9 => class="cls-vermelho".
  Ex.: <td class="cls-salmao">Inferior à média</td>
- Onde a estrutura indicar {{GRAFICO_PERFIL}}, escreva EXATAMENTE o texto {{GRAFICO_PERFIL}} sozinho num parágrafo; o sistema substituirá pelo gráfico.`;

// ---------------------------------------------------------------------------
// Gráfico SVG do perfil cognitivo (barras horizontais por domínio)
// ---------------------------------------------------------------------------
export type PerfilItem = { dominio: string; percentil: number };

export function svgPerfilCognitivo(itens: PerfilItem[]): string {
  const dados = (itens ?? []).filter((d) => d && d.dominio && Number.isFinite(Number(d.percentil)));
  if (dados.length === 0) return "";

  const W = 720;
  const rowH = 34;
  const padL = 208;
  const padR = 44;
  const padT = 40;
  const padB = 34;
  const H = padT + padB + dados.length * rowH;
  const plotW = W - padL - padR;
  const x = (v: number) => padL + (Math.max(0, Math.min(100, v)) / 100) * plotW;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Faixas de fundo por classificação
  const faixas = [
    { de: 0, ate: 9, cor: NAVE_CORES.vermelho },
    { de: 9, ate: 16, cor: NAVE_CORES.salmao },
    { de: 16, ate: 25, cor: NAVE_CORES.amarelo },
    { de: 25, ate: 100, cor: NAVE_CORES.verde },
  ];
  const bandas = faixas
    .map((f) => `<rect x="${x(f.de).toFixed(1)}" y="${padT}" width="${(x(f.ate) - x(f.de)).toFixed(1)}" height="${dados.length * rowH}" fill="${f.cor}" opacity="0.28"/>`)
    .join("");

  // Linhas de referência (P9, P25, P50, P75)
  const refs = [9, 25, 50, 75]
    .map((v) => `<line x1="${x(v).toFixed(1)}" y1="${padT}" x2="${x(v).toFixed(1)}" y2="${padT + dados.length * rowH}" stroke="#ffffff" stroke-width="1"/>` +
      `<text x="${x(v).toFixed(1)}" y="${padT - 6}" font-size="10" fill="#7a7a7a" text-anchor="middle">P${v}</text>`)
    .join("");

  const barras = dados
    .map((d, i) => {
      const y = padT + i * rowH + 6;
      const bh = rowH - 14;
      const w = x(d.percentil) - padL;
      const cls = classificarPercentil(d.percentil);
      const label = esc(d.dominio.length > 30 ? d.dominio.slice(0, 29) + "…" : d.dominio);
      return (
        `<text x="${padL - 10}" y="${y + bh / 2 + 4}" font-size="12" fill="#333" text-anchor="end">${label}</text>` +
        `<rect x="${padL}" y="${y}" width="${Math.max(2, w).toFixed(1)}" height="${bh}" rx="3" fill="${cls.cor}" stroke="#00000022"/>` +
        `<text x="${(padL + Math.max(2, w) + 6).toFixed(1)}" y="${y + bh / 2 + 4}" font-size="11" fill="#333">P${Math.round(d.percentil)}</text>`
      );
    })
    .join("");

  return (
    `<svg class="grafico-perfil" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Perfil cognitivo por domínio">` +
    `<text x="${padL}" y="20" font-size="13" font-weight="600" fill="${NAVE_CORES.petroleo}">Perfil cognitivo por domínio (percentil)</text>` +
    bandas + refs + barras +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Legenda de classificação (HTML)
// ---------------------------------------------------------------------------
export function legendaClassificacaoHTML(): string {
  const item = (cor: string, txt: string) =>
    `<span class="leg"><span class="leg-cor" style="background:${cor}"></span>${txt}</span>`;
  return (
    `<div class="legenda-classificacao">` +
    item(NAVE_CORES.verde, "Médio / Superior (P ≥ 25)") +
    item(NAVE_CORES.amarelo, "Médio inferior (P 16–24)") +
    item(NAVE_CORES.salmao, "Inferior à média (P 9–15)") +
    item(NAVE_CORES.vermelho, "Muito inferior (P < 9)") +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// CSS do documento (impressão / preview)
// ---------------------------------------------------------------------------
export const NAVE_CSS = `
  @page { size: A4; margin: 20mm 16mm; }
  body { font-family: Calibri, 'DM Sans', system-ui, sans-serif; color: #1f1f1f; line-height: 1.55; max-width: 800px; margin: 0 auto; padding: 24px; }
  .nave-header { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e2e2e2; padding-bottom: 10px; margin-bottom: 4px; }
  .nave-header .barra { width: 6px; height: 34px; background: ${NAVE_CORES.rose}; border-radius: 3px; }
  .nave-header .titulo { color: ${NAVE_CORES.petroleo}; font-weight: 700; font-size: 15px; letter-spacing: .3px; }
  h1 { color: ${NAVE_CORES.petroleo}; font-size: 22px; margin: 14px 0 2px; }
  h2 { color: ${NAVE_CORES.petroleo}; text-transform: uppercase; font-size: 15px; letter-spacing: .4px; margin-top: 26px; padding-bottom: 4px; border-bottom: 2px solid ${NAVE_CORES.rose}; }
  h3 { color: ${NAVE_CORES.petroleo}; font-size: 13.5px; margin-top: 18px; }
  p { text-align: justify; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12.5px; }
  th, td { border: 1px solid ${NAVE_CORES.bordaTabela}; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #eef4f8; color: ${NAVE_CORES.petroleo}; border-bottom: 2px solid ${NAVE_CORES.rose}; }
  tr:nth-child(even) td { background: #fafafa; }
  td.cls-verde { background: ${NAVE_CORES.verde} !important; }
  td.cls-amarelo { background: ${NAVE_CORES.amarelo} !important; }
  td.cls-salmao { background: ${NAVE_CORES.salmao} !important; }
  td.cls-vermelho { background: ${NAVE_CORES.vermelho} !important; }
  ul, ol { padding-left: 22px; }
  .meta { color: #666; font-size: 12px; margin: 6px 0 16px; }
  .legenda-classificacao { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #555; margin: 8px 0 4px; }
  .leg { display: inline-flex; align-items: center; gap: 5px; }
  .leg-cor { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #00000022; display: inline-block; }
  .grafico-perfil { margin: 10px 0; }
  .actions { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
  .actions button { padding: 8px 14px; border-radius: 6px; border: 0; cursor: pointer; background: ${NAVE_CORES.petroleo}; color: #fff; font-weight: 600; }
  @media print { .actions { display: none; } }
`;

export const NAVE_HEADER_HTML =
  `<div class="nave-header"><span class="barra"></span>` +
  `<span class="titulo">Relatório de Avaliação Psicopedagógica com enfoque em Neuropsicologia Escolar</span></div>`;
