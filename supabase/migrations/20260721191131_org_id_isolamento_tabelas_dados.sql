-- =========================================================
-- Fase 1 — org_id + isolamento por organização em todas as tabelas
-- de dados (exceto profiles/user_roles/organizacoes/organizacao_membros,
-- que são de plataforma, e configuracoes_clinica, que será absorvida
-- por organizacoes numa migration separada).
--
-- Estratégia: policy RESTRICTIVE (é combinada com AND às policies
-- permissivas já existentes — nenhuma delas precisa ser reescrita).
-- Leitura permite org_id IS NULL (linhas "padrão da plataforma",
-- ex.: catálogos semeados). Escrita exige org_id = my_org_id()
-- (ninguém além da pensya_admin grava linha "global").
-- =========================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'processo_acessos','negocio_metas','paciente_diagnosticos','plano_meta_componentes',
    'sublocacao_usos','frequencia','contratos','cadastro_publico','responsaveis',
    'portal_acessos','leads','profissionais_externos','scripts','extrato_identificadores',
    'sublocacao_disponibilidade','status_frequencia','profissionais_consultorio_especialidades',
    'folha_pagamento','prontuario_sessoes','marketing_rotina_execucoes','metas_terapeuticas',
    'avaliacao_documentos','planos_terapeuticos','fornecedores','colaborador_config',
    'referencias','contas_fixas','avaliacao_sessoes_plano','plano_estrategias',
    'categorias_habilidades','pacientes','plano_contas','locais','lead_interacoes',
    'canais_marketing','documento_templates','marketing_principios','paciente_profissionais',
    'baterias_modelo_itens','contas_financeiras','salas','dominios_cognitivos','centros_custo',
    'testes_catalogo','marketing_funis','plano_devolutivas','plano_gas','contract_templates',
    'infinitepay_config','bateria_itens','atendimentos','extrato_lotes','campanhas',
    'testes_aplicados','investimentos','portal_registros','marketing_indicadores',
    'marketing_objetivos','especialidades','escolas','portal_convites','reunioes',
    'habilidades','sessao_planejamentos','baterias_modelo','paciente_pre_anamnese',
    'paciente_documentos','departamentos','pipeline_etapas','classificacao_normativa',
    'infinitepay_eventos','tarefas','plano_meta_fontes','plano_formulacao_itens',
    'extrato_transacoes','plano_evidencias','processos','sublocacao_contratos',
    'sublocadores','sessao_metas','marketing_rotinas','tipos_servico',
    'profissionais_consultorio','plano_ciclo_revisoes','modalidades','pagamentos',
    'marketing_indicador_valores','avaliacoes','recursos','plano_objetivos','plano_metas',
    'lancamentos_financeiros','marketing_funil_acoes','convites_equipe','diagnosticos'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE;', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.my_org_id();', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id);', 'idx_' || t || '_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (org_id = public.my_org_id() OR org_id IS NULL OR public.is_pensya_admin()) WITH CHECK (org_id = public.my_org_id() OR public.is_pensya_admin());',
      'Isolamento por organizacao', t
    );
  END LOOP;
END $$;
