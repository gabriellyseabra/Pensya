import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type Pacote = {
  id: string;
  descricao: string | null;
  total_sessoes: number;
  sessoes_usadas: number;
  valor: number;
  data_compra: string;
  ativo: boolean;
};

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Pacotes pré-pagos de sessões com saldo consumível, para quem cobra por sessão. */
export function PacotesSessao({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = ["pacotes-sessao", pacienteId];

  // Só aparece quando o paciente é cobrado por pacote.
  const { data: modelo } = useQuery({
    queryKey: ["paciente-modelo-pagamento", pacienteId],
    queryFn: async () => (await supabase.from("pacientes").select("modelo_pagamento").eq("id", pacienteId).single()).data?.modelo_pagamento ?? null,
  });

  const { data: pacotes = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacotes_sessao")
        .select("id, descricao, total_sessoes, sessoes_usadas, valor, data_compra, ativo")
        .eq("paciente_id", pacienteId)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pacote[];
    },
  });

  // Frequência do paciente — base do débito automático do pacote.
  const { data: freq = [] } = useQuery({
    queryKey: ["pacotes-frequencia", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("frequencia")
        .select("tipo, data_referencia")
        .eq("paciente_id", pacienteId);
      return (data ?? []) as { tipo: string; data_referencia: string }[];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pacotes_sessao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Pacote removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Card só aparece para pacientes no modelo "pacote".
  if (modelo !== "pacote") return null;

  // Débito automático: presença, reposição e falta não justificada consomem;
  // falta justificada mantém o crédito (será reposta). Aloca do pacote mais antigo.
  const CONSOME = ["presente", "reposicao", "falta_nao_justificada"];
  const pacotesAsc = [...pacotes].sort((a, b) => a.data_compra.localeCompare(b.data_compra));
  const inicio = pacotesAsc[0]?.data_compra;
  const consumo = freq.filter((f) => CONSOME.includes(f.tipo) && (!inicio || f.data_referencia >= inicio)).length;
  const usadasPorId: Record<string, number> = {};
  let restante = consumo;
  for (const p of pacotesAsc) {
    const u = Math.min(p.total_sessoes, restante);
    usadasPorId[p.id] = u;
    restante -= u;
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand" />
            <div>
              <h3 className="font-medium">Pacotes de sessões</h3>
              <p className="text-xs text-muted-foreground">Saldo pré-pago que debita a cada sessão realizada.</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} className="gradient-brand text-brand-foreground">
            <Plus className="mr-1.5 h-4 w-4" /> Novo pacote
          </Button>
        </div>

        {pacotes.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum pacote ativo.</p>}

        <div className="space-y-2">
          {pacotes.map((p) => {
            const usadas = usadasPorId[p.id] ?? 0;
            const saldo = p.total_sessoes - usadas;
            const pct = p.total_sessoes ? Math.round((usadas / p.total_sessoes) * 100) : 0;
            const esgotado = saldo <= 0;
            return (
              <div key={p.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.descricao || "Pacote de sessões"}</p>
                    <p className="text-xs text-muted-foreground">
                      {currency(p.valor)} · comprado em {format(parseISO(p.data_compra), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${esgotado ? "text-destructive" : "text-brand"}`}>{saldo}<span className="text-xs font-normal text-muted-foreground">/{p.total_sessoes}</span></p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">restantes</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Debita automaticamente pela frequência</span>
                  <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => remover.mutate(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <NovoPacoteDialog
          open={open}
          onOpenChange={setOpen}
          pacienteId={pacienteId}
          onSaved={() => qc.invalidateQueries({ queryKey })}
        />
      </CardContent>
    </Card>
  );
}

function NovoPacoteDialog({
  open, onOpenChange, pacienteId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pacienteId: string;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [total, setTotal] = useState("10");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [lancar, setLancar] = useState(true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const { error } = await supabase.from("pacotes_sessao").insert({
        paciente_id: pacienteId,
        descricao: descricao.trim() || null,
        total_sessoes: Number(total) || 1,
        valor: Number(valor) || 0,
        data_compra: data,
      });
      if (error) throw error;

      // Opcional: registra a compra como receita confirmada no financeiro.
      if (lancar && Number(valor) > 0) {
        await supabase.from("lancamentos_financeiros").insert({
          tipo: "receita",
          status: "confirmado",
          descricao: `Pacote de sessões${descricao.trim() ? ` — ${descricao.trim()}` : ""}`,
          valor: Number(valor),
          vencimento: data,
          competencia: `${data.slice(0, 7)}-01`,
          pago_em: data,
          paciente_id: pacienteId,
        } as any);
      }
      toast.success("Pacote criado");
      setDescricao(""); setTotal("10"); setValor("");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar pacote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Novo pacote de sessões</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição (opcional)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pacote 10 sessões de terapia" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Sessões</Label>
              <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
            Registrar entrada no financeiro
          </label>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar pacote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
