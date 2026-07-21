---
name: nave-plano-funcional
description: >
  Gera plano terapêutico psicopedagógico completo com CIF, GAS e metas SMART funcionais. Faz perguntas clínicas guiadas antes de gerar, lê laudos, relatórios, registros de reunião e PDIs enviados. Output em HTML interativo ou PDF: perfil CIF, metas SMART por domínio, escala GAS com 5 níveis por meta, estratégias baseadas em evidências, orientações para família e escola.

  Use SEMPRE que mencionar: "gerar plano terapêutico", "montar o plano", "plano com GAS", "plano com CIF", "plano com metas SMART", "plano baseado no laudo", "plano para esse paciente", "metas funcionais", "objetivos com GAS", "preciso do plano", "gerar PDI funcional", "criar objetivos terapêuticos".

  Também use quando a profissional enviar laudo, relatório de avaliação, registro de reunião, transcrição de sessão ou prontuário e pedir para montar metas, plano de intervenção ou objetivos — mesmo sem usar os termos exatos acima.
---

# Skill: Plano Terapêutico Funcional — CIF + GAS + SMART

## Visão geral

Esta skill conduz a psicopedagoga por um processo guiado de raciocínio clínico, do perfil do paciente ao plano terapêutico completo. Ela **faz perguntas antes de gerar**, lê arquivos enviados, e entrega um documento HTML interativo ou PDF com tudo organizado: perfil CIF, metas SMART funcionais, escalas GAS e estratégias de intervenção.

**Princípio fundamental:** toda meta terapêutica só é válida se serve ao funcionamento real do paciente. "Aumentar fluência leitora" não é uma meta funcional. "Conseguir ler o enunciado das provas com autonomia" — é.

---

## Passo 1 — Ler os arquivos enviados

Antes de fazer qualquer pergunta, leia **tudo** que foi enviado:

- **PDFs de avaliação / laudo:** extraia domínios avaliados, escores (percentis, pontuações-padrão), perfil cognitivo, hipótese diagnóstica, queixas da família e observações de comportamento durante a aplicação.
- **Registros de reunião com família / escola:** extraia queixas funcionais, o que a família e escola observam no dia a dia, fatores ambientais facilitadores e barreiras.
- **PDI ou plano anterior:** identifique o que já foi trabalhado, o que avançou e o que ainda é demanda.
- **Registros de sessão / prontuário:** extraia padrões de desempenho, resposta às intervenções anteriores, pontos fortes observados.
- **Texto livre colado:** mapeie as informações disponíveis por área.

Se nenhum arquivo foi enviado, avance para o Passo 2 e colete as informações via perguntas.

---

## Passo 2 — Perguntas de contexto clínico

Faça as perguntas em **um único bloco organizado** — não uma por vez. Adapte as perguntas ao que já está disponível nos arquivos. Não repita o que já foi informado.

Organize as perguntas em três grupos:

### Grupo A — Dados básicos (se não disponíveis nos arquivos)
- Nome/código do paciente, idade, ano escolar, diagnóstico (se houver), medicação em uso
- Frequência e duração das sessões
- Há quanto tempo está em atendimento (novo paciente ou continuidade?)

### Grupo B — Perfil funcional CIF
- **Participação comprometida:** O que essa criança não consegue participar agora — na escola, em casa, nas relações? O que ela evita? O que a família e escola reportam que ela NÃO CONSEGUE FAZER na vida real?
- **Objetivo de participação:** Se a intervenção funcionar — o que muda concretamente na vida real desta criança em 3 meses?
- **Pontos fortes e motivações:** O que ela faz bem? O que engaja ela? Quais habilidades estão preservadas?
- **Fatores ambientais:** A escola oferece suporte? A família é presente e adere às orientações? Há outros profissionais envolvidos?

### Grupo C — Prioridades e formato de output
- Quais são as 2–3 prioridades clínicas principais para este ciclo?
- Prazo do ciclo (padrão: 10–12 semanas)?
- **Formato de output:** HTML interativo ou PDF?

> **Regra:** se os arquivos enviados já respondem a maioria das perguntas, pergunte apenas o que estiver faltando — especialmente o objetivo de participação e as prioridades. Nunca omita as perguntas do Grupo C.

---

## Passo 3 — Raciocínio clínico antes de gerar

Antes de escrever qualquer meta, leia o arquivo de referência:

→ **`references/raciocinio-clinico.md`** — lógica de priorização por área, cadeia de aprendizagem, quando cada domínio precede o outro, banco de estratégias baseadas em evidências e erros comuns no planejamento.

Com base nos dados coletados, faça o mapeamento CIF internamente:

| Componente CIF | O que extrair |
|---|---|
| Funções e Estruturas | O que está comprometido no nível neurológico/cognitivo — percentis, descrições qualitativas |
| Atividades | O que ela não consegue executar — com dado observável (velocidade, frequência, % de acertos) |
| Participação | Como isso afeta a vida real — escola, casa, vínculos. **Este é o objetivo final do plano** |
| Fatores Ambientais | O que o contexto facilita ou dificulta — escola, família, rede de apoio |
| Fatores Pessoais | Pontos fortes, motivações, autoestima, estratégias que já usa |

Identifique a hierarquia das prioridades. Consulte `references/raciocinio-clinico.md` para a lógica de ordenação.

---

## Passo 4 — Construir as metas SMART funcionais

Para cada prioridade clínica, construa a meta seguindo rigorosamente o critério SMART:

| Letra | Critério | Regra prática |
|---|---|---|
| S | Específica | Verbo de ação + contexto preciso. "Ler texto familiar em voz alta" — não "melhorar a leitura" |
| M | Mensurável | Parâmetro quantificável: palavras/min, % de acertos, nº de sessões consecutivas, frequência |
| A | Alcançável | Realista para o perfil e frequência. Baseado no baseline real — não em estimativa |
| R | Relevante | **A mais importante.** Descreve mudança na participação real. "Se esta meta for atingida — o que muda na vida desta criança?" |
| T | Temporal | Prazo definido em semanas |

**Regra de ouro da meta funcional:** a meta descreve mudança na **participação** — não só melhora no desempenho dentro da sessão. "Lê 25 palavras/min no consultório" não é funcional. "Consegue acompanhar a leitura silenciosa da turma" — é.

**Número de metas:** 2 a 5 por ciclo, dependendo do perfil e da frequência de atendimento. Não sobrecarregar — profundidade é melhor que quantidade.

Para exemplos de metas bem e mal construídas → `references/raciocinio-clinico.md`

---

## Passo 5 — Construir a escala GAS para cada meta

Para cada meta SMART, construa os 5 níveis da escala GAS.

**Sequência de construção:**
1. O **nível 0** é a meta SMART — escreva exatamente o texto da meta
2. Escreva o **−2** (estagnação ou regressão em relação ao baseline)
3. Escreva o **+2** (superação com generalização para outros contextos)
4. Complete o **−1** (progresso real, mas insuficiente para o prazo)
5. Complete o **+1** (além do esperado, mas sem generalização do +2)

**Regras para cada nível:**
- Cada nível deve ser **observável na sessão** — descreva como você saberia que a criança está ali
- **Sem sobreposição** entre níveis vizinhos — use números e parâmetros distintos
- Inclua sempre a **linha de base** antes dos 5 níveis — sem baseline, o nível 0 é uma aposta
- O nível −2 e +2 não precisam de número exato, mas precisam de descrição comportamental clara

Para a tabela-modelo de GAS com exemplos por domínio → `references/gas-exemplos.md`

---

## Passo 6 — Estratégias de intervenção

Para cada meta, defina as estratégias e recursos com **justificativa clínica** — não apenas o nome do recurso.

Formato de cada estratégia:
- **Nome do recurso / técnica**
- **Por que este recurso para este perfil** (conexão com a função comprometida ou o fator pessoal)
- **Como aplicar** (frequência, nível de suporte, progressão)
- **Referência científica quando disponível**

Para o banco de estratégias por domínio → `references/raciocinio-clinico.md`

---

## Passo 7 — Gerar o output

Consulte `references/output-template.md` para o template HTML/PDF completo.

O documento final contém, nesta ordem:

1. **Cabeçalho:** dados do paciente, diagnóstico, frequência, ciclo de intervenção, data
2. **Síntese do Perfil CIF:** tabela com os 5 componentes preenchidos
3. **Objetivo de Participação:** o que muda na vida real ao final do ciclo
4. **Metas e Escala GAS:** para cada meta — linha de base, 5 níveis GAS, estratégias de intervenção
5. **Orientações para a Família:** o que fazer em casa — específico, não genérico
6. **Orientações para a Escola:** adaptações, comunicações, o que não fazer
7. **Parceiros clínicos:** articulações com outros profissionais
8. **Espaço de revisão:** campo para registrar o nível GAS atingido ao final do ciclo
9. **Assinatura e datas:** elaboração e revisão prevista

**Formato HTML:** arquivo único com design Nave (petrol #025073, rosé #C97A8A, DM Sans), abas navegáveis, campos editáveis, botão de impressão/PDF.

**Formato PDF:** gerado via ReportLab canvas com layout de uma coluna, fontes embutidas, tabelas GAS com cores por nível.

---

## Checklist de qualidade antes de entregar

- [ ] Todas as metas têm verbo de ação + parâmetro mensurável + prazo
- [ ] Cada meta responde: "se atingida — o que muda na vida real desta criança?"
- [ ] Baseline identificado para cada meta (dado observável, não estimativa)
- [ ] Cada nível GAS é observável e distinguível do vizinho
- [ ] Estratégias têm justificativa clínica — não são lista genérica de atividades
- [ ] Orientações para família são específicas e operacionais
- [ ] O documento está no formato escolhido pela profissional (HTML ou PDF)
- [ ] Nenhum dado clínico foi inventado — tudo veio dos arquivos ou das respostas às perguntas

---

## Arquivos de referência

| Arquivo | Quando ler |
|---|---|
| `references/raciocinio-clinico.md` | Sempre — base do raciocínio clínico, priorização por área e banco de estratégias |
| `references/gas-exemplos.md` | Ao construir as escalas GAS — exemplos por domínio com 5 níveis preenchidos |
| `references/output-template.md` | Ao gerar o HTML ou PDF — estrutura visual, componentes e paleta de cores |
