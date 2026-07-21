import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gerarDevolutivaIA } from "@/lib/devolutiva.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, FileText, Trash2, Printer, Save } from "lucide-react";

/**
 * Devolutiva clínica automática (Fase 3 · ETAPA 13).
 * Gera uma síntese técnica do ciclo a partir das evidências registradas nas
 * sessões (GAS, evidências, componentes, progresso, variáveis transversais).
 */

type Conteudo = {
  resumo_evolucao?: string;
  metas_alcancadas?: string[];
  metas_andamento?: string[];
  componentes_evolucao?: string[];
  componentes_limitantes?: string[];
  mudancas_comportamentais?: string;
  mudancas_participacao?: string;
  variaveis_transversais?: string;
  proximas_prioridades?: string[];
};

export function DevolutivaAutomatica({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const gerar = useServerFn(gerarDevolutivaIA);
  const [loading, setLoading] = useState(false);
  const [previa, setPrevia] = useState<{ conteudo: Conteudo; plano_id: string | null; ai_modelo: string } | null>(null);

  const { data: historico = [] } = useQuery({
    queryKey: ["devolutivas", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plano_devolutivas")
        .select("id, conteudo, created_at, plano_id, ai_modelo")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  async function run() {
    setLoading(true);
    try {
      const r: any = await gerar({ data: { paciente_id: pacienteId } });
      setPrevia({ conteudo: r.conteudo as Conteudo, plano_id: r.plano_id, ai_modelo: r.ai_modelo });
      toast.success("Devolutiva gerada — revise e salve");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar devolutiva");
    } finally { setLoading(false); }
  }

  async function salvar() {
    if (!previa) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("plano_devolutivas").insert({
      paciente_id: pacienteId, plano_id: previa.plano_id, conteudo: previa.conteudo as any,
      ai_modelo: previa.ai_modelo, gerado_por: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Devolutiva salva");
    setPrevia(null);
    qc.invalidateQueries({ queryKey: ["devolutivas", pacienteId] });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta devolutiva?")) return;
    await supabase.from("plano_devolutivas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["devolutivas", pacienteId] });
  }

  return (
    <Card className="glass border-brand/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-brand" /> Devolutiva clínica automática</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Síntese técnica do ciclo baseada nas evidências das sessões.</p>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Gerar devolutiva
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {previa && (
          <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="secondary">Prévia — não salva</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPrevia(null)}>Descartar</Button>
                <Button size="sm" onClick={salvar}><Save className="mr-2 h-3.5 w-3.5" />Salvar devolutiva</Button>
              </div>
            </div>
            <DevolutivaView conteudo={previa.conteudo} />
          </div>
        )}

        {historico.length === 0 && !previa && (
          <p className="text-sm text-muted-foreground">Nenhuma devolutiva gerada ainda. Clique em <strong>Gerar devolutiva</strong> ao fim de um ciclo.</p>
        )}

        {historico.map((d) => (
          <div key={d.id} className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Devolutiva de {format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(d.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
              </div>
            </div>
            <DevolutivaView conteudo={d.conteudo as Conteudo} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DevolutivaView({ conteudo }: { conteudo: Conteudo }) {
  const c = conteudo ?? {};
  return (
    <div className="space-y-3 text-sm">
      {c.resumo_evolucao && <Bloco titulo="Resumo da evolução"><p className="text-muted-foreground">{c.resumo_evolucao}</p></Bloco>}
      <div className="grid gap-3 sm:grid-cols-2">
        {!!c.metas_alcancadas?.length && <Lista titulo="Metas alcançadas" itens={c.metas_alcancadas} />}
        {!!c.metas_andamento?.length && <Lista titulo="Metas em andamento" itens={c.metas_andamento} />}
        {!!c.componentes_evolucao?.length && <Lista titulo="Componentes com maior evolução" itens={c.componentes_evolucao} />}
        {!!c.componentes_limitantes?.length && <Lista titulo="Componentes ainda limitantes" itens={c.componentes_limitantes} />}
      </div>
      {c.mudancas_comportamentais && <Bloco titulo="Mudanças comportamentais"><p className="text-muted-foreground">{c.mudancas_comportamentais}</p></Bloco>}
      {c.mudancas_participacao && <Bloco titulo="Mudanças na participação"><p className="text-muted-foreground">{c.mudancas_participacao}</p></Bloco>}
      {c.variaveis_transversais && <Bloco titulo="Variáveis transversais"><p className="text-muted-foreground">{c.variaveis_transversais}</p></Bloco>}
      {!!c.proximas_prioridades?.length && <Lista titulo="Próximas prioridades" itens={c.proximas_prioridades} />}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold text-foreground">{titulo}</p><div className="mt-0.5">{children}</div></div>;
}
function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{titulo}</p>
      <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
        {itens.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
