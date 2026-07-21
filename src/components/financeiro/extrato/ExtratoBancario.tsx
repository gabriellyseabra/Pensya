import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportarExtrato } from "./ImportarExtrato";
import { RevisaoExtrato } from "./RevisaoExtrato";

export function ExtratoBancario() {
  const [aba, setAba] = useState("importar");

  return (
    <Tabs value={aba} onValueChange={setAba}>
      <TabsList>
        <TabsTrigger value="importar">Importar</TabsTrigger>
        <TabsTrigger value="revisar">Revisar e aprovar</TabsTrigger>
      </TabsList>
      <TabsContent value="importar" className="pt-4">
        <ImportarExtrato onImportado={() => setAba("revisar")} />
      </TabsContent>
      <TabsContent value="revisar" className="pt-4">
        <RevisaoExtrato />
      </TabsContent>
    </Tabs>
  );
}
