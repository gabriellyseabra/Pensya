import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaOrganizacao } from "@/lib/clinica-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Dados fiscais da organização — habilita a emissão de NF e guarda os dados
 * do prestador usados na central de documentos fiscais e nos recibos.
 */
export function DadosFiscaisConfig() {
  const qc = useQueryClient();
  const { data: org, isLoading } = useQuery({
    queryKey: ["minha-organizacao"],
    queryFn: getMinhaOrganizacao,
  });

  const [emiteNf, setEmiteNf] = useState(false);
  const [inscricao, setInscricao] = useState("");
  const [codigoServico, setCodigoServico] = useState("");
  const [aliquota, setAliquota] = useState("");
  const [regime, setRegime] = useState("");
  const [prestadorReg, setPrestadorReg] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org) return;
    setEmiteNf(!!org.emite_nf);
    setInscricao(org.inscricao_municipal ?? "");
    setCodigoServico(org.codigo_servico_municipal ?? "");
    setAliquota(org.aliquota_iss != null ? String(org.aliquota_iss) : "");
    setRegime(org.regime_tributario ?? "");
    setPrestadorReg(org.prestador_registro ?? "");
    setDiscriminacao(org.discriminacao_padrao ?? "");
  }, [org]);

  async function salvar() {
    if (!org) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizacoes")
        .update({
          emite_nf: emiteNf,
          inscricao_municipal: inscricao || null,
          codigo_servico_municipal: codigoServico || null,
          aliquota_iss: aliquota === "" ? null : Number(aliquota),
          regime_tributario: regime || null,
          prestador_registro: prestadorReg || null,
          discriminacao_padrao: discriminacao || null,
        })
        .eq("id", org.id);
      if (error) throw error;
      toast.success("Dados fiscais salvos");
      qc.invalidateQueries({ queryKey: ["minha-organizacao"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <p className="py-6 text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <Card className="glass p-4 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-medium">Dados fiscais</h3>
        <p className="text-xs text-muted-foreground">
          Habilite a emissão de notas fiscais e configure os dados do prestador para NF e recibos.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
        <div>
          <Label className="text-sm">Emite nota fiscal</Label>
          <p className="text-xs text-muted-foreground">Ativa a aba "Notas fiscais" no financeiro.</p>
        </div>
        <Switch checked={emiteNf} onCheckedChange={setEmiteNf} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Inscrição municipal</Label>
          <Input value={inscricao} onChange={(e) => setInscricao(e.target.value)} placeholder="Ex: 123456-7" />
        </div>
        <div>
          <Label>Código do serviço municipal</Label>
          <Input value={codigoServico} onChange={(e) => setCodigoServico(e.target.value)} placeholder="Ex: 4.03 / 08.01" />
        </div>
        <div>
          <Label>Alíquota ISS (%)</Label>
          <Input type="number" step="0.01" value={aliquota} onChange={(e) => setAliquota(e.target.value)} placeholder="Ex: 2" />
        </div>
        <div>
          <Label>Regime tributário</Label>
          <Input value={regime} onChange={(e) => setRegime(e.target.value)} placeholder="Ex: Simples Nacional / MEI" />
        </div>
        <div className="sm:col-span-2">
          <Label>Registro do prestador</Label>
          <Input value={prestadorReg} onChange={(e) => setPrestadorReg(e.target.value)} placeholder="Ex: CRP 00/00000 (usado no recibo de saúde)" />
        </div>
        <div className="sm:col-span-2">
          <Label>Discriminação padrão</Label>
          <Textarea
            value={discriminacao}
            onChange={(e) => setDiscriminacao(e.target.value)}
            placeholder="Descrição padrão do serviço prestado (usada como padrão em NF e recibos)."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </div>
    </Card>
  );
}
