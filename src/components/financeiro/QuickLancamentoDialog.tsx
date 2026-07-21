import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LancamentoForm } from "./LancamentoForm";
import { PacienteCombobox } from "./extrato/PacienteCombobox";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";

export function QuickLancamentoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState("lancamento");

  function fecharAposSalvar() {
    invalidarFinanceiro(qc);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="lancamento">Lançamento geral</TabsTrigger>
            <TabsTrigger value="pagamento">Pagamento de paciente</TabsTrigger>
          </TabsList>
          <TabsContent value="lancamento" className="pt-3">
            <LancamentoForm editing={null} onCancel={() => onOpenChange(false)} onSaved={fecharAposSalvar} />
          </TabsContent>
          <TabsContent value="pagamento" className="pt-3">
            <PagamentoPacienteForm onCancel={() => onOpenChange(false)} onSaved={fecharAposSalvar} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type TipoCobranca = "mensalidade" | "sessao_avulsa" | "pacote_mensal";

const NOME_PLANO_CONTA: Record<Exclude<TipoCobranca, "mensalidade">, string> = {
  sessao_avulsa: "Sessão avulsa",
  pacote_mensal: "Pacote mensal",
};

function PagamentoPacienteForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoCobranca>("mensalidade");
  const [competencia, setCompetencia] = useState(hoje.slice(0, 7)); // yyyy-MM
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState<string>("");
  const [pago, setPago] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: pacientes } = useQuery({
    queryKey: ["quick-lanc-pacientes"],
    queryFn: async () => (await supabase.from("pacientes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: planosReceita } = useQuery({
    queryKey: ["quick-lanc-planos-receita"],
    queryFn: async () => (await supabase.from("plano_contas").select("id, nome").eq("tipo", "receita").eq("ativo", true)).data ?? [],
  });

  async function salvar() {
    if (!pacienteId) { toast.error("Selecione o paciente"); return; }
    if (!valor || Number(valor) <= 0) { toast.error("Informe o valor"); return; }
    setSaving(true);
    try {
      if (tipo === "mensalidade") {
        const comp = `${competencia}-01`;
        const { error } = await supabase.from("pagamentos").upsert(
          {
            paciente_id: pacienteId,
            competencia: comp,
            valor: Number(valor),
            vencimento: data,
            status: pago ? "pago" : "pendente",
            pago_em: pago ? hoje : null,
          },
          { onConflict: "paciente_id,competencia" },
        );
        if (error) throw error;
      } else {
        const planoConta = (planosReceita ?? []).find((p: any) => p.nome === NOME_PLANO_CONTA[tipo]);
        const { error } = await supabase.from("lancamentos_financeiros").insert({
          tipo: "receita",
          status: pago ? "confirmado" : "previsto",
          descricao: NOME_PLANO_CONTA[tipo],
          valor: Number(valor),
          vencimento: data,
          competencia: data,
          pago_em: pago ? hoje : null,
          plano_conta_id: planoConta?.id ?? null,
          paciente_id: pacienteId,
        });
        if (error) throw error;
      }
      toast.success("Pagamento registrado");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar pagamento");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Paciente</Label>
          <PacienteCombobox pacientes={pacientes ?? []} value={pacienteId} onChange={(id) => setPacienteId(id)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Tipo de cobrança</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCobranca)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensalidade">Mensalidade</SelectItem>
              <SelectItem value="sessao_avulsa">Sessão avulsa</SelectItem>
              <SelectItem value="pacote_mensal">Pacote mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tipo === "mensalidade" ? (
          <div>
            <Label>Competência</Label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
        ) : (
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Status</Label>
          <Select value={pago ? "pago" : "pendente"} onValueChange={(v) => setPago(v === "pago")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Salvar
        </Button>
      </DialogFooter>
    </>
  );
}
