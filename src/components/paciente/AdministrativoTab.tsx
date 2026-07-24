import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { FinanceiroPacienteTab } from "@/components/paciente/FinanceiroPacienteTab";
import { ReunioesTab } from "@/components/paciente/ReunioesTab";
import { TarefasTab } from "@/components/paciente/TarefasTab";
import { PortalTab } from "@/components/paciente/PortalTab";
import { DeclaracaoComparecimento } from "@/components/paciente/DeclaracaoComparecimento";
import { PacotesSessao } from "@/components/paciente/PacotesSessao";

/**
 * Aba Administrativa: agrega tudo que não é clínico —
 * financeiro, contratos, reuniões, tarefas e portal — em sub-abas.
 * (Documentos vive na área "Arquivos" — era duplicado aqui; a importação
 * de prontuário vive na Central de Importação.)
 *
 * `activeTab`/`onActiveTabChange` permitem que outras telas (ex: Visão Geral
 * da Avaliação) naveguem direto para uma sub-aba específica (ex: Reuniões).
 */
export function AdministrativoTab({
  pacienteId, activeTab, onActiveTabChange,
}: { pacienteId: string; activeTab?: string; onActiveTabChange?: (v: string) => void }) {
  const [internalTab, setInternalTab] = useState("financeiro");
  const bruto = activeTab ?? internalTab;
  // Sub-abas antigas removidas (duplicadas) caem no Financeiro.
  const tab = bruto === "documentos" || bruto === "importar" ? "financeiro" : bruto;
  const setTab = onActiveTabChange ?? setInternalTab;
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="glass flex-wrap h-auto">
        <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        <TabsTrigger value="contratos">Contratos</TabsTrigger>
        <TabsTrigger value="declaracoes">Declarações</TabsTrigger>
        <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
        <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        <TabsTrigger value="portal">Portal</TabsTrigger>
      </TabsList>

      <TabsContent value="financeiro" className="space-y-4">
        <PacotesSessao pacienteId={pacienteId} />
        <FinanceiroPacienteTab pacienteId={pacienteId} />
      </TabsContent>

      <TabsContent value="contratos">
        <Card className="glass">
          <CardContent className="pt-6 flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              Contratos deste paciente são gerenciados no módulo Contratos.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/contratos">
                Abrir contratos <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="declaracoes">
        <DeclaracaoComparecimento pacienteId={pacienteId} />
      </TabsContent>

      <TabsContent value="reunioes">
        <ReunioesTab pacienteId={pacienteId} />
      </TabsContent>

      <TabsContent value="tarefas">
        <TarefasTab pacienteId={pacienteId} />
      </TabsContent>

      <TabsContent value="portal">
        <PortalTab pacienteId={pacienteId} />
      </TabsContent>
    </Tabs>
  );
}
