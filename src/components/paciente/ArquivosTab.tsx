import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GaleriaTab } from "@/components/paciente/GaleriaTab";
import { DocumentosTab } from "@/components/paciente/DocumentosTab";
import { ImageIcon, FileText } from "lucide-react";

/**
 * Aba "Arquivos": reúne a mídia visual do paciente (Galeria: fotos e vídeos,
 * inclusive os anexados nas sessões) e os documentos (laudos, relatórios,
 * receituários, exames…) em sub-abas, evitando espalhar isso pelo painel.
 */
export function ArquivosTab({ pacienteId }: { pacienteId: string }) {
  const [tab, setTab] = useState("galeria");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="glass h-auto flex-wrap">
        <TabsTrigger value="galeria" className="gap-1.5">
          <ImageIcon className="h-4 w-4" /> Galeria
        </TabsTrigger>
        <TabsTrigger value="documentos" className="gap-1.5">
          <FileText className="h-4 w-4" /> Documentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="galeria">
        <GaleriaTab pacienteId={pacienteId} />
      </TabsContent>

      <TabsContent value="documentos">
        <DocumentosTab pacienteId={pacienteId} />
      </TabsContent>
    </Tabs>
  );
}
