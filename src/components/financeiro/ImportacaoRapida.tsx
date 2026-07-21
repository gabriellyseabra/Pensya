import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradeAnual } from "./GradeAnual";
import { ColarPlanilha } from "./ColarPlanilha";
import { EntradaRapida } from "./EntradaRapida";

export function ImportacaoRapida() {
  return (
    <Card className="glass">
      <CardContent className="pt-6">
        <Tabs defaultValue="grade">
          <TabsList>
            <TabsTrigger value="grade">Grade anual</TabsTrigger>
            <TabsTrigger value="colar">Colar / Upload</TabsTrigger>
            <TabsTrigger value="rapida">Entrada rápida</TabsTrigger>
          </TabsList>
          <TabsContent value="grade" className="pt-4"><GradeAnual /></TabsContent>
          <TabsContent value="colar" className="pt-4"><ColarPlanilha /></TabsContent>
          <TabsContent value="rapida" className="pt-4"><EntradaRapida /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
