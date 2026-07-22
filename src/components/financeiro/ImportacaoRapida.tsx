import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradeAnual } from "./GradeAnual";
import { EntradaRapida } from "./EntradaRapida";

// Ferramentas para lançar vários valores de uma vez, à mão — diferente da
// aba "Fluxo de caixa (planilha)", que importa um arquivo de outro sistema.
export function LancamentoEmMassa() {
  return (
    <Card className="glass">
      <CardContent className="pt-6 space-y-4">
        <div className="text-sm">
          <p className="font-medium">Lançar vários valores de uma vez, sem planilha</p>
          <p className="text-muted-foreground">
            Use quando quiser digitar rapidamente vários lançamentos direto no sistema. Para trazer
            registros já prontos de outro sistema, use a aba <strong>Fluxo de caixa (planilha)</strong>.
          </p>
        </div>
        <Tabs defaultValue="grade">
          <TabsList>
            <TabsTrigger value="grade">Grade anual</TabsTrigger>
            <TabsTrigger value="rapida">Entrada rápida</TabsTrigger>
          </TabsList>
          <TabsContent value="grade" className="pt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Preencha, mês a mês, os valores de cada categoria — como uma planilha anual de previsão.
            </p>
            <GradeAnual />
          </TabsContent>
          <TabsContent value="rapida" className="pt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Adicione lançamentos avulsos (entrada ou saída) em sequência, um embaixo do outro.
            </p>
            <EntradaRapida />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
