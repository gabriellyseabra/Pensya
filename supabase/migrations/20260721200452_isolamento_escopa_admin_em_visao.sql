-- Com a visão de clínica ativa, a pensya_admin fica ESCOPADA à clínica
-- visitada (org_id = my_org_id()); o bypass total dela passa a valer apenas
-- quando nenhuma visão está ativa (painel de gestão agregado). Esta mudança
-- RESTRINGE o acesso da admin — usuários comuns mantêm o comportamento
-- atual, pois para eles is_pensya_admin() é falso e my_org_id() é o vínculo.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'Isolamento por organizacao'
  LOOP
    EXECUTE format('DROP POLICY "Isolamento por organizacao" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (org_id = public.my_org_id() OR org_id IS NULL OR (public.is_pensya_admin() AND public.my_org_id() IS NULL)) WITH CHECK (org_id = public.my_org_id() OR (public.is_pensya_admin() AND public.my_org_id() IS NULL));',
      'Isolamento por organizacao', t
    );
  END LOOP;
END $$;