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
