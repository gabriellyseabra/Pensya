import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContasFinanceirasConfig } from "./config/ContasFinanceirasConfig";
import { FormasRecebimentoConfig } from "./config/FormasRecebimentoConfig";
import { ConveniosConfig } from "./config/ConveniosConfig";
import { CrudTable, PlanoContasTable } from "@/routes/_authenticated/configuracoes.index";

const ABAS = [
  { key: "contas", label: "Contas e bancos" },
  { key: "formas", label: "Formas de recebimento" },
  { key: "convenios", label: "Convênios" },
  { key: "plano", label: "Plano de contas" },
  { key: "servicos", label: "Tipos de serviço" },
  { key: "centros", label: "Centros de custo" },
  { key: "fornecedores", label: "Fornecedores" },
] as const;

/**
 * Status de configuração mínima do financeiro: precisa de ao menos uma conta e
 * uma forma de recebimento antes de lançar/cobrar. Usado pelo alerta na página.
 */
export function useFinanceiroSetupStatus() {
  const { data } = useQuery({
    queryKey: ["financeiro-setup-status"],
    staleTime: 60_000,
    queryFn: async () => {
      const [contas, formas] = await Promise.all([
        supabase.from("contas_financeiras").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("formas_recebimento").select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);
      return { contas: contas.count ?? 0, formas: formas.count ?? 0 };
    },
  });
  const contas = data?.contas ?? 0;
  const formas = data?.formas ?? 0;
  return { carregado: !!data, temContas: contas > 0, temFormas: formas > 0, configurado: contas > 0 && formas > 0 };
}

export function FinanceiroConfig() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="contas">
        <TabsList className="glass h-auto flex-wrap">
          {ABAS.map((a) => (
            <TabsTrigger key={a.key} value={a.key}>{a.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="contas" className="mt-4"><ContasFinanceirasConfig /></TabsContent>
        <TabsContent value="formas" className="mt-4"><FormasRecebimentoConfig /></TabsContent>
        <TabsContent value="convenios" className="mt-4"><ConveniosConfig /></TabsContent>
        <TabsContent value="plano" className="mt-4"><PlanoContasTable /></TabsContent>
        <TabsContent value="servicos" className="mt-4">
          <CrudTable tableName="tipos_servico" label="Tipos de serviço" fields={["nome", "valor_padrao"]} />
        </TabsContent>
        <TabsContent value="centros" className="mt-4">
          <CrudTable tableName="centros_custo" label="Centros de custo" fields={["nome"]} />
        </TabsContent>
        <TabsContent value="fornecedores" className="mt-4">
          <CrudTable tableName="fornecedores" label="Fornecedores" fields={["nome", "documento", "email", "telefone"]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
