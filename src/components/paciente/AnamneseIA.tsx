import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sintetizarAnamnese } from "@/lib/anamnese.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { usePerfilVivo } from "@/hooks/use-perfil-vivo";


type Sintese = {
  resumo_executivo?: string;
  marcos_relevantes?: string[];
  fatores_protetivos?: string[];
  fatores_de_risco?: string[];
  correlacoes_clinicas?: string[];
  lacunas_a_investigar?: string[];
  hipoteses_a_considerar?: string[];
  encaminhamentos_sugeridos?: string[];
};

function ListBlock({ title, items, tone }: { title: string; items?: string[]; tone?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className={`text-sm font-medium mb-2 ${tone ?? ""}`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-muted-foreground flex gap-2">
            <span className="text-brand mt-1">•</span><span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnamneseIA({ pacienteId }: { pacienteId: string }) {
  const sintetizar = useServerFn(sintetizarAnamnese);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Sintese | null>(null);
  const { merge } = usePerfilVivo(pacienteId);

  async function gerar() {
    setLoading(true);
    try {
      const result = await sintetizar({ data: { paciente_id: pacienteId } });
      setData(result as Sintese);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar síntese");
    } finally {
      setLoading(false);
    }
  }

  async function aplicarAoPerfil() {
    if (!data) return;
    await merge.mutateAsync({
      hipoteses_ativas: data.hipoteses_a_considerar ?? [],
      potencializadores: data.fatores_protetivos ?? [],
      barreiras: (data.fatores_de_risco ?? []).map((d) => ({ descricao: d })),
    });
    toast.success("Aplicado ao Perfil Clínico Vivo");
  }

  return (
    <Card className="glass border-brand/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" />
          Síntese clínica inteligente
        </CardTitle>
        <div className="flex gap-2">
          {data && (
            <Button size="sm" variant="secondary" onClick={aplicarAoPerfil} disabled={merge.isPending}>
              <ArrowDownToLine className="w-4 h-4 mr-2" />Aplicar ao Perfil Vivo
            </Button>
          )}
          <Button size="sm" onClick={gerar} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando…</> : <><Sparkles className="w-4 h-4 mr-2" />{data ? "Regenerar" : "Gerar com IA"}</>}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!data && !loading && (
          <p className="text-sm text-muted-foreground">A IA conecta gestação, parto, desenvolvimento, contexto familiar e queixa atual para apoiar o raciocínio clínico. Nenhum dado é inventado — apenas correlações entre os registros existentes.</p>
        )}
        {data && (
          <div className="space-y-5">
            {data.resumo_executivo && (
              <div className="rounded-lg bg-brand/5 border border-brand/20 p-4">
                <p className="text-sm">{data.resumo_executivo}</p>
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              <ListBlock title="Marcos relevantes" items={data.marcos_relevantes} />
              <ListBlock title="Correlações clínicas" items={data.correlacoes_clinicas} />
              <ListBlock title="Fatores protetivos" items={data.fatores_protetivos} tone="text-emerald-600" />
              <ListBlock title="Fatores de risco" items={data.fatores_de_risco} tone="text-amber-600" />
              <ListBlock title="Hipóteses a considerar" items={data.hipoteses_a_considerar} />
              <ListBlock title="Lacunas a investigar" items={data.lacunas_a_investigar} />
              <ListBlock title="Encaminhamentos sugeridos" items={data.encaminhamentos_sugeridos} />
            </div>
            <p className="text-xs text-muted-foreground italic">Síntese gerada por IA com base nos registros. Sempre valide com seu julgamento clínico.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
