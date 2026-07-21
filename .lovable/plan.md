## 1. Exclusão de paciente

- Adicionar botão "Arquivar" (soft delete) na lista de pacientes e na página do paciente — marca `pacientes.ativo = false` e oculta dos filtros padrão (toggle "Mostrar arquivados").
- Adicionar ação "Excluir definitivamente" (hard delete) visível **apenas para admin**, com diálogo de confirmação que exige digitar o nome do paciente. Remove o paciente e dados vinculados via `ON DELETE CASCADE` já existentes; para tabelas sem cascade, a server function apaga em ordem.
- Server fn `arquivarPaciente` / `excluirPacienteDefinitivo` em `src/lib/cadastro.functions.ts`, protegida com `requireSupabaseAuth` + checagem de role.

## 2. Cadastro manual simplificado + auto-preenchimento na anamnese

- Reduzir o formulário de cadastro manual aos campos essenciais:
  - Nome, data de nascimento, responsável (nome + telefone)
  - Escola + ano escolar (com combobox "buscar ou cadastrar nova")
  - Convênio / forma de pagamento
- Componente `EscolaCombobox`: lista escolas existentes (`escolas`) + opção "➕ Cadastrar nova escola" inline (dialog rápido com nome, cidade, contato).
- Ao salvar, os campos cadastrados são automaticamente refletidos no **Perfil Clínico Vivo** e pré-preenchidos na **anamnese** (seção de dados de identificação / contexto escolar), sem necessidade de redigitar. A anamnese lê de `pacientes` e `responsaveis` antes de aplicar overrides locais.

## 3. Importação em massa de pacientes (PDF/DOCX/Excel)

- Nova aba "Importar pacientes" em `/pacientes` com upload (PDF, DOCX, XLSX, CSV).
- Server fn `importarPacientesArquivo`: parser (xlsx para planilhas, IA via Lovable AI para PDF/DOCX) extrai linhas → retorna preview tabular editável.
- Tela de preview: tabela com campos detectados (nome, nascimento, responsável, telefone, escola, convênio), permite editar célula a célula, marcar/desmarcar linhas, e mostra avisos (duplicado, escola não cadastrada → cria automaticamente).
- Botão "Confirmar e criar N pacientes" insere em lote.

## 4. Sublocação de salas (agenda + financeiro)

- Nova aba "Sublocação" dentro da rota `/agenda`, com sub-navegação:
  - **Salas**: cadastro de salas (nome, descrição, capacidade, cor). Usa `locais` existente, estendendo se necessário.
  - **Sublocadores**: cadastro de profissionais externos que sublocam (nome, contato, CPF/CNPJ). Estende `profissionais_externos`.
  - **Contratos de sublocação**: por sublocador × sala, define modelo de cobrança configurável:
    - valor fixo por sessão / hora
    - % sobre atendimento
    - mensalidade fixa + extras
  - **Disponibilidade**: marcar bloqueios da sala (indisponível para sublocação) por período recorrente ou pontual.
  - **Agenda de uso**: lançar uso de sala (sublocador, sala, data, duração) — gera automaticamente lançamento financeiro a receber conforme o contrato.
- Visualização geral na agenda principal: filtro/legenda por sala mostrando ocupações próprias **e** sublocações.

## Detalhes técnicos

**Migrações**:
- `pacientes`: confirmar coluna `ativo boolean default true`.
- Nova tabela `salas` (se `locais` não cobrir): `nome`, `cor`, `capacidade`, `ativo`, `observacoes`.
- Nova tabela `sublocadores`: `nome`, `documento`, `telefone`, `email`, `especialidade`, `ativo`.
- Nova tabela `sublocacao_contratos`: `sublocador_id`, `sala_id`, `modelo` (`fixo_sessao`|`percentual`|`mensal_extras`), `valor_base`, `percentual`, `vigencia_inicio/fim`.
- Nova tabela `sublocacao_disponibilidade`: `sala_id`, `inicio`, `fim`, `tipo` (`disponivel`|`bloqueada`), `recorrencia_json`.
- Nova tabela `sublocacao_usos`: `contrato_id`, `data`, `inicio`, `fim`, `valor_calculado`, `lancamento_id` (FK a `lancamentos_financeiros`).
- RLS scoped (admin gerencia tudo; profissionais leem).
- Trigger/server fn ao inserir `sublocacao_usos` cria `lancamentos_financeiros` (a receber) com valor calculado conforme contrato.

**Server functions** (`src/lib/`):
- `cadastro.functions.ts` → `arquivarPaciente`, `restaurarPaciente`, `excluirPacienteDefinitivo`, `criarEscolaRapida`.
- `importar-pacientes.functions.ts` (novo) → `parsearArquivoPacientes`, `criarPacientesEmLote`.
- `sublocacao.functions.ts` (novo) → CRUDs de salas/sublocadores/contratos/disponibilidade/usos + cálculo financeiro.

**Frontend**:
- `pacientes.index.tsx`: ações arquivar/excluir, filtro arquivados, nova aba "Importar".
- `CadastrarPacienteForm` enxuto + `EscolaCombobox`.
- `ImportarPacientes.tsx` (upload + preview editável).
- `/agenda` ganha tabs: "Atendimentos" | "Sublocação"; sub-rotas para salas/sublocadores/contratos/usos.
- Indicador no calendário principal mostrando uso de sala (interno vs sublocação).

## Ordem de execução

1. Migração 1 (pacientes.ativo + sublocação schema).
2. Server functions de cadastro/exclusão + UI.
3. Cadastro simplificado + EscolaCombobox + auto-preenchimento anamnese.
4. Importação em massa (parser + preview + bulk insert).
5. Sublocação: cadastros → contratos → disponibilidade → usos → integração financeira → visualização na agenda.
