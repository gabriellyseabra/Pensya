# Pensya — Estratégia e Roadmap do SaaS

> Documento de decisão estratégica. Registra a análise feita em jul/2026 sobre como transformar o SISClin
> (hoje em Google Planilhas) em um sistema profissional por assinatura, usando a base de código da Nave Clínica.

## 0. Nome do produto: **Pensya**

Decidido em jul/2026. Palavra inventada a partir de "pensar", com grafia de marca — substitui o nome
SISClin no produto novo (o SISClin em Planilhas segue como legado/porta de entrada).

- **Domínios** (verificados livres em 21/jul/2026 — registrar IMEDIATAMENTE, disponibilidade muda):
  - `pensya.com.br` → registro.br (~R$ 40/ano) — domínio principal (site de vendas + `app.pensya.com.br`).
  - `pensya.app` → ~US$ 10/ano — garantir também, aponta para o mesmo lugar.
  - `pensya.com` já tem dono: verificar se é site ativo ou estacionado antes de investir em identidade visual.
- **Pendências de marca**: garantir @pensya (Instagram) e fazer busca no INPI (classes de software/saúde/educação)
  antes do investimento em identidade visual.

## 1. Decisão: dois projetos, mesma base de código

O SISClin será um **projeto separado**, criado a partir de uma **cópia integral deste repositório** — com
Supabase próprio, deploy próprio na Vercel e domínio próprio. A Nave Clínica continua exatamente como está.

**Por que essa escolha:**
- A Nave funciona como **laboratório**: toda alteração é testada primeiro aqui, com liberdade de errar.
  O que der certo é levado para o SISClin.
- Nada se perde na duplicação: cérebro 3D (`src/components/paciente/Brain3D.tsx`), design system,
  planejamento de sessão, plano terapêutico, avaliação/testagem — tudo é o mesmo código.
- O risco de mexer na fundação do banco de produção da Nave (com pacientes reais) fica zerado.

**Como levar melhorias da Nave para o SISClin (sem refazer nada):**
Os dois repositórios compartilham a mesma história no Git. No repositório do SISClin, adiciona-se a Nave
como *remote* e usa-se `git cherry-pick` (para levar um ajuste específico) ou `git merge` (para levar um
conjunto). Não é trabalho manual duplicado — é sincronização.

```bash
# uma vez, no repositório do SISClin:
git remote add nave https://github.com/gabriellyseabra/nave-cl-nica.git
# sempre que quiser trazer uma melhoria testada na Nave:
git fetch nave
git cherry-pick <commit-da-melhoria>
```

Quanto mais o SISClin divergir (white-label, multi-tenant), mais alguns cherry-picks vão pedir pequenos
ajustes manuais — normal e administrável.

## 2. Ponto estrutural: o SISClin precisa ser multi-clínica por dentro

Separar o SISClin da Nave **não** elimina a necessidade de multi-tenancy — apenas muda onde ela mora.
Dentro do SISClin, **todas as alunas usarão o mesmo sistema e o mesmo banco**, então cada clínica precisa
ser uma "organização" isolada (uma aluna jamais pode ver pacientes da outra).

A alternativa (uma cópia do sistema + um Supabase para cada aluna) não escala: custo por projeto Supabase,
dezenas de deploys para atualizar um a um, e onboarding manual a cada venda. Com multi-tenant, vender para
uma aluna nova = ela se cadastra e cria a clínica dela, sem você tocar em nada.

O que isso exige no banco do SISClin (uma vez só, no projeto novo — a Nave não é tocada):
1. Tabelas `organizacoes` (nome, logo, cores, WhatsApp, plano) e `organizacao_membros` (usuário ↔ clínica ↔ papel).
2. Coluna `org_id` em todas as tabelas de dados (~80 tabelas de `supabase/migrations/`).
3. Reescrever as políticas de RLS: hoje são "equipe autenticada vê tudo" (`is_equipe()` / `USING (true)`);
   passam a filtrar por organização. Idem para `has_role`, `tem_acesso_portal` e as funções `portal_*`.
4. Trigger `handle_new_user`: de "primeiro usuário do sistema é admin" para "quem cria a organização é admin dela".
5. Storage (buckets) e `infinitepay_config` (recebimentos dos pacientes de cada clínica) com escopo por organização.
6. Catálogos (diagnósticos, testes, habilidades, normas): seed global copiado para cada organização na criação.

## 2b. Controle de acesso DENTRO de cada clínica (papéis e vínculo por paciente)

Cada clínica assinante pode ter equipe própria, e a admin controla o que cada pessoa acessa.
O isolamento tem **duas camadas**, implementadas juntas na Fase 1 (mesmo mecanismo de RLS):

- **Camada 1 — entre clínicas**: nenhuma organização enxerga dados de outra (seção 2).
- **Camada 2 — dentro da clínica**, por papéis fixos:
  - **Admin** (quem assina): vê e gerencia tudo da clínica dela — inclusive financeiro, gestão e configurações.
  - **Profissional**: vê **somente os pacientes vinculados a ela** via `paciente_profissionais`
    (agenda, prontuário, plano terapêutico, avaliação desses pacientes). Sem acesso a financeiro,
    gestão, relatórios gerenciais e configurações. O vínculo é feito pela admin na tela de equipe.
  - **Secretária**: agenda e cadastros; sem prontuário clínico e sem financeiro (ajustável).

Decisão de escopo: **papéis fixos, sem matriz de permissões customizável** no lançamento —
granularidade maior só se houver demanda real. Custo: não há custo de infraestrutura; é esforço de
desenvolvimento e teste dentro da Fase 1 (~20–30% a mais na fase), pois as RLS já serão todas reescritas.

Teste obrigatório da camada 2: logar como profissional e comprovar que pacientes não vinculados,
financeiro e gestão ficam inacessíveis (incluindo via server functions e storage).

## 3. White-label (personalização por clínica)

A marca "Nave" está fixa em ~25 arquivos (~127 ocorrências). No SISClin ela vira configuração da organização:
- Título/UI: `src/routes/__root.tsx`, `app-shell.tsx`, `app-sidebar.tsx`, `auth.tsx`, `dashboard.tsx`.
- Cores: `src/styles.css` já usa tokens CSS — a paleta passa a ser injetada por clínica (ThemeProvider).
- Logo: `public/logo-nave.png` → `organizacoes.logo_url` (upload no onboarding).
- PDFs/documentos: `src/lib/nave-relatorio.ts`, `plano-documento.ts`, `contratos.ts`, `templates.functions.ts`.
- Portal da família herda o branding da clínica do paciente.

## 4. Módulos liberados para as alunas

Controle por *feature flags* na organização (campo `plano`/`features`), respeitado pela sidebar e rotas:
- **Essencial**: pacientes, agenda, prontuário/sessões, plano terapêutico, financeiro básico.
- **Completo**: + portal da família, relatórios/devolutivas com IA, avaliação/testagem.
- **Fora do SISClin** (uso interno Nave): marketing/CRM, sublocação, folha de pagamento, POPs.
- **IA (Gemini)**: o custo é seu — colocar cota de gerações/mês por plano para proteger a margem.
- **WhatsApp**: v1 mantém o modelo atual (link `wa.me` com mensagem pronta), usando o número configurado
  pela clínica. Envio automático de lembretes (API oficial Meta ou Evolution API, credencial por clínica) fica para v2.

## 5. Domínio

- Registrar domínio próprio do produto: `pensya.com.br` (principal) + `pensya.app` (ver seção 0).
- `pensya.com.br` = página de vendas; `app.pensya.com.br` = sistema. Nenhuma menção a "Nave" para as alunas.
- Subdomínio por clínica (`clinicax.pensya.app`) é possível no futuro (wildcard na Vercel), mas desnecessário
  no lançamento — a personalização aparece após o login e no portal da família.

## 6. Modelo comercial (sugestão)

- **Planos**: Mensal (preço cheio) + Anual (~2 meses de desconto). Deixar o trimestral de fora no lançamento
  (menos opções = menos fricção); adicionar depois se houver demanda.
- **Preço por tamanho de equipe** (recomendado): faixas *Solo* (1 profissional), *Equipe* (até 3–5) e
  *Clínica* (acima), em vez de preço por assento — mais simples de comunicar e de cobrar no início.
  O sistema conta os membros ativos da organização e valida o limite do plano. Famílias do portal
  **não contam** como usuário pago (ilimitadas — argumento de venda).
- **Lançamento**: turma fundadora com as alunas — preço reduzido (ou congelado vitalício) em troca de feedback
  e depoimentos; teste grátis de 7 a 14 dias.
- **Cobrança da assinatura**: v1 com links InfinitePay (já integrado) + controle manual em tabela `assinaturas`
  (org, plano, ciclo, status, vencimento) com bloqueio suave por inadimplência (leitura ok, escrita bloqueada).
  Quando passar de ~10 clientes, migrar para recorrência automática (Asaas — forte no Brasil com Pix/boleto — ou Stripe).
- **LGPD**: como plataforma hospedando dados de saúde de menores de clínicas terceiras, é obrigatório ter
  Termo de Uso, Política de Privacidade e contrato de operadora de dados **antes da primeira assinatura paga**
  (providenciar com advogado).

## 7. Roadmap

**Fase 0 — Segurança e criação do projeto**
1. ⚠️ Rotacionar `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` (o `.env` com essas chaves está no repositório);
   garantir `.env` no `.gitignore`. Vale para a Nave também, independente do SISClin.
2. Criar repositório novo (cópia deste), projeto Supabase novo e projeto Vercel novo; registrar o domínio.

**Fase 1 — Fundação multi-clínica** (itens da seção 2, no banco novo — nasce vazio, sem migração de dados)
+ onboarding self-service: cadastro → cria organização → wizard (nome, logo, cores) → convites de equipe
(reaproveitar `convites_equipe`).

**Fase 2 — White-label** (seção 3)

**Fase 3 — Módulos e flags** (seção 4)

**Fase 4 — Comercial**: tabela `assinaturas` + bloqueio, página de vendas no domínio raiz, piloto com 3–5
alunas fundadoras → ajustes → abertura.

**Verificação de isolamento (crítico antes de qualquer aluna real):** criar 2 organizações de teste e comprovar
que nenhuma enxerga dados da outra — incluindo portal da família, storage e funções `SECURITY DEFINER`;
rodar o advisor de segurança do Supabase após reescrever as RLS.

## 8. Roadmap de funcionalidades competitivas (jul/2026)

> Análise feita a partir do vídeo-demonstração do **ClínicaExperts** (sistema de gestão de clínicas), adaptada
> à realidade da psicopedagogia/terapia. Achado central: o Pensya **já tem as peças de dados** que pareciam
> exclusivas do concorrente (recorrência de sessões, comissão/repasse flexível, mensalidade recorrente, CRM
> Kanban, assinatura de documentos com variáveis). O que falta não é função — é **automação de servidor**
> (não existe nenhuma edge function nem job agendado hoje) e alguns módulos operacionais pontuais.
> Cada bloco abaixo traz a decisão tomada com a Gabi.

### O que NÃO fazer (fora do escopo — é clínica de estética/médica)
Estoque com lotes/validade/XML, baixa de consumo de materiais, injetáveis/mapas corporais, odontograma,
IMC/Fitzpatrick/adipometria, análise facial por IA, prescrição via MEMED, vídeo de teleconsulta embutido.

### Bloco A — Financeiro desacoplado do adquirente *(1º a executar)*
Nem toda clínica usa InfinitePay. Abstrair:
- **Contas financeiras** (caixa, banco, cofre) com **logo do banco** (seletor com logos + upload como fallback).
- **Formas de recebimento** (dinheiro, Pix, cartão/maquininha com taxa configurável) independentes de adquirente.
- No fechamento: escolher forma + **conta de destino** (o "split" do concorrente) e calcular o **líquido**
  descontando a taxa. InfinitePay vira *uma* opção, não a base.

### Bloco B — Convênios + lista de espera
- **Convênios** como entidade: cadastro dos aceitos, vínculo no agendamento, **tabela de valores por
  convênio × procedimento**. Financeiro distingue particular × convênio (reflete em recebimento/repasse).
- **Lista de espera** por profissional/convênio; ao cancelar um horário, o sistema sugere encaixe compatível.
- Depende do Bloco A.

### Bloco C — Pacote/pré-pago de sessões (saldo consumível)
Para quem cobra por sessão: paciente compra N sessões, saldo debita a cada sessão concluída ("saldo 6/10").
Liga no financeiro (entrada do pacote) e na agenda (debita ao concluir). Depende do Bloco A.

### Bloco D — Documentos e diagnóstico *(rápido, independente)*
- **Declaração de comparecimento**: modelo editável com logo da clínica + variáveis automáticas (nome, data,
  horário) — reaproveita a infra de templates/assinatura existente.
- **Campo de diagnóstico** para paciente já diagnosticado: catálogo **CID-11** (público — OMS/DATASUS).
  DSM-5-TR: **não reproduzir o texto dos critérios (copyright APA)**; a IA pode *raciocinar* sobre os critérios
  para **sugerir hipóteses a partir dos dados** (raciocínio clínico, não distribuição do material) — validar.
- **QR-Code foto → prontuário**: profissional gera QR na tela, aponta o celular e a foto (produção escrita,
  desenho) cai direto no prontuário/galeria.

### Bloco E — Teleconsulta (link colável)
Campo de link no agendamento, aceitando **link fixo** (Zoom pessoal) **ou por atendimento** (Meet).
Custo zero. Sem vídeo embutido.

### Bloco F — Gestão de insumos e licenças de testes *(módulo leve)*
- **Insumos do consultório**: item + quantidade + alerta de reposição (sem lote/XML/baixa automática).
- **Licenças de testes**: controle de folhas/aplicações restantes e validade da licença (ex.: créditos
  VOL/Vetor), com alerta. Útil e específico da área — ninguém faz.

### Bloco G — Avaliação, testes e laudos *(o diferencial — "liderar")*
Cuidado jurídico: **o Pensya não distribui tabela de norma de teste algum**. Automatiza só o que não é
protegido (organização de escores, gráficos, redação da narrativa interpretativa, montagem do laudo).
Escore/percentil vem inserido pela profissional licenciada, ou a clínica cadastra a tabela que licenciou;
instrumentos de domínio público podem vir prontos.
- **Gerador de gráficos como ferramenta do sistema**: tipo de gráfico e paleta editáveis, **sugestão de tipo
  conforme o que o teste avalia**, inserível numa janela na página de Avaliação para apresentar gráficos +
  detalhes do teste.
- **Manter** narrativa, percentis e **classificação Guillmette** já existentes.
- **Reformular a `AvaliacaoTab`**: hoje há lacunas (testes, resultados, testes qualitativos) e "texto muito
  grande". Ação: **auditar a tela atual antes de redesenhar**.
- Produtizar (adaptado) o arsenal de skills clínicas (APET, ETDAH-PAIS, MFFT-BR, TNABV, PROADE, Ice Cream,
  Cinco Pontos, devolutiva, plano funcional) — o que o concorrente jamais teria.

### Bloco H — Evolução longitudinal por meta
Indicador **embutido** na meta que já existe ("melhora / estável / estagnada" + mini gráfico), recolhido por
padrão, expande sob demanda. Reaproveita o modelo Sofia (sessão ↔ meta). **Sem módulo novo** (evitar confusão).

### Bloco I — Cérebro 3D (refino)
Manter visível, mas: **corrigir bug de cor das regiões** (bolinhas não colorindo certo — diagnosticar primeiro),
**ocultar o card lateral** e trazê-lo sob demanda (drawer ao clicar na região), **reduzir o espaço** ocupado.

### Fora do escopo por ora (reavaliar)
- **Automação/régua de comunicação** (lembrete + confirmação-que-vira-verde + aniversário): mecânica é edge
  function + `pg_cron`; e-mail é ~custo zero, WhatsApp exige API oficial da Meta. **Aguardando reunião da Gabi
  sobre WhatsApp (semana de jul/2026).**
- **WhatsApp integrado (Clean Chat)** e **escriba de sessão por áudio** (transcrição barata mas somável →
  gated por cota + consentimento LGPD): apostas de médio prazo.
- **Autoagendamento público**: adiado; alvo futuro é a **agenda de sublocação** (profissional reserva sala).

### Ordem de execução acordada
A (financeiro desacoplado) → D (documentos/diagnóstico/QR, rápido) → B (convênios/espera) + C (pacotes) →
F (insumos/licenças) → G (avaliação/gráficos/laudos) → H (evolução longitudinal) → I (cérebro 3D) →
depois: automação/WhatsApp/escriba conforme decisão comercial.

## 9. Bloco J — Gestão de documentos fiscais (NF, recibo e recibo de saúde)

Nível **controle + dados prontos** (sem integração fiscal/custo), multi-clínica, periodicidade variável.
Decidido em jul/2026 com a Gabi.

### Três tipos de documento
- **Nota fiscal (NFS-e)**: controle do que emitir; dados prontos para colar no portal municipal; registro
  de número/data + upload do PDF/XML após emitir. Sem emissão automática (nível 3 fica para depois, via
  provedor tipo PlugNotas/Focus — o modelo de dados abaixo já é compatível).
- **Recibo simples**: PDF gerado pelo sistema (logo + dados da clínica), não-fiscal.
- **Recibo de saúde**: PDF gerado com os campos do IRPF/Receita Saúde (prestador + CPF/registro, tomador +
  CPF, paciente, valor, data, descrição do serviço de saúde). O lançamento oficial no app Receita Saúde
  (gov.br) permanece manual — integração é fase futura.

### Dados
- Tabela `documentos_fiscais` (tipo, paciente/tomador, competência, valor, descrição, status, número,
  pdf_path/xml_path, visivel_portal, observações).
- Vínculo de receitas via `pagamentos.documento_fiscal_id` e `lancamentos_financeiros.documento_fiscal_id`
  — uma nota/recibo pode agregar 1 sessão, o mês do paciente, ou um pacote (cobre o "varia").
- Dados fiscais da clínica em `organizacoes` (inscrição municipal, código do serviço, alíquota ISS, regime,
  discriminação padrão, registro do prestador).

### Telas / fluxo (Financeiro › Notas fiscais)
1. Lista com filtros (período/status/tipo/paciente) e total a emitir.
2. Pendências: receitas pagas sem documento de pacientes que desejam NF.
3. Gerar documento: escolhe tomador + itens/período/pacote → cria (pendente para NF; gerado para recibos).
4. Dados para emissão (NF): bloco pronto com botões de copiar por campo.
5. Registrar emissão (NF): número + data + upload PDF/XML. Recibos: PDF gerado na hora.
6. Relatório do período (CSV/PDF) para o contador.
7. Config fiscal da clínica em Financeiro › Configurar (aparece só com `emite_nf`).

### Portal da família + WhatsApp
- Documentos com `visivel_portal` aparecem no portal da família com download do PDF.
- Botão "Enviar por WhatsApp" que abre mensagem pronta (valor/competência + link do documento).

### Multi-clínica
Parte fiscal é por clínica e opcional; quem não liga `emite_nf`/não configura não vê a central.

<!-- redeploy: força produção com a correção do Gerar do mês (#29) -->
