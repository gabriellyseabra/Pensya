import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { differenceInDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invalidarFinanceiro } from "@/lib/financeiro-cache";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Vencido = {
  id: string; paciente_id: string; competencia: string; valor: number;
  vencimento: string; infinitepay_checkout_url: string | null;
  paciente: { nome: string; status: string; telefone: string | null; responsaveis: { nome: string; telefone: string | null; principal: boolean }[] } | null;
};

/**
 * Visão de inadimplência: mensalidades vencidas agrupadas por família,
 * com cobrança em 1 clique via WhatsApp (mensagem pronta + link de pagamento).
 */
export function Inadimplencia() {
  const qc = useQueryClient();
  const hoje = new Date();

  const { data: vencidos = [], isLoading } = useQuery({
    queryKey: ["inadimplencia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, paciente_id, competencia, valor, vencimento, infinitepay_checkout_url, paciente:pacientes(nome, status, telefone, responsaveis(nome, telefone, principal))")
        .eq("status", "pendente")
        .lt("vencimento", format(hoje, "yyyy-MM-dd"))
        .order("vencimento");
      if (error) throw new Error(error.message);
      // Só cobra pacientes ativos — pausados/altas/inativos não entram na inadimplência.
      return ((data ?? []) as unknown as Vencido[]).filter((v) => v.paciente?.status === "ativo");
    },
  });

  const marcarPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos")
        .update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Baixa registrada");
      qc.invalidateQueries({ queryKey: ["inadimplencia"] });
      invalidarFinanceiro(qc);
    },
  });

  // Agrupa por paciente
  const porPaciente = new Map<string, { nome: string; telefone: string | null; itens: Vencido[] }>();
  for (const v of vencidos) {
    const resp = v.paciente?.responsaveis?.find((r) => r.principal) ?? v.paciente?.responsaveis?.[0];
    const g = porPaciente.get(v.paciente_id) ?? {
      nome: v.paciente?.nome ?? "Paciente",
      telefone: resp?.telefone ?? v.paciente?.telefone ?? null,
      itens: [],
    };
    g.itens.push(v);
    porPaciente.set(v.paciente_id, g);
  }
  const grupos = [...porPaciente.entries()];
  const totalGeral = vencidos.reduce((a, v) => a + Number(v.valor), 0);

  function cobrarWhatsApp(g: { nome: string; telefone: string | null; itens: Vencido[] }) {
    const total = g.itens.reduce((a, v) => a + Number(v.valor), 0);
    const linhas = g.itens.map((v) =>
      `• ${v.competencia}: ${BRL(Number(v.valor))} (venceu ${format(parseISO(v.vencimento), "dd/MM")})`,
    ).join("\n");
    const link = g.itens.find((v) => v.infinitepay_checkout_url)?.infinitepay_checkout_url;
    const msg = `Olá! Tudo bem? 😊\nPassando para lembrar da mensalidade de ${g.nome.split(" ")[0]}:\n${linhas}\nTotal: ${BRL(total)}${link ? `\n\nPague online: ${link}` : ""}\nQualquer dúvida estamos à disposição!`;
    const fone = (g.telefone ?? "").replace(/\D/g, "");
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : null;
    if (url) window.open(url, "_blank");
    else {
      navigator.clipboard.writeText(msg).then(
        () => toast.success("Sem telefone cadastrado — mensagem copiada!"),
        () => toast.info(msg),
      );
    }
  }

  return (
    <Card className="glass p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Inadimplência
          </h3>
          <p className="text-xs text-muted-foreground">
            {vencidos.length} mensalidade(s) vencida(s) · total {BRL(totalGeral)}
          </p>
        </div>
      </div>

      {isLoading && <p className="py-4 text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && grupos.length === 0 && (
        <p className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nenhuma mensalidade em atraso. 🎉
        </p>
      )}

      <div className="space-y-2">
        {grupos.map(([pid, g]) => {
          const total = g.itens.reduce((a, v) => a + Number(v.valor), 0);
          const maisAntiga = g.itens[0];
          const diasAtraso = differenceInDays(hoje, parseISO(maisAntiga.vencimento));
          return (
            <div key={pid} className="rounded-xl border border-border/60 bg-secondary/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{g.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.itens.length} mensalidade(s) · mais antiga há {diasAtraso} dia(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={diasAtraso > 30 ? "destructive" : "secondary"} className="tabular-nums">
                    {BRL(total)}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => cobrarWhatsApp(g)}>
                    <MessageCircle className="mr-1 h-3.5 w-3.5" /> Cobrar no WhatsApp
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.itens.map((v) => (
                  <button
                    key={v.id}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums hover:bg-emerald-500/20"
                    title="Clique para dar baixa (marcar como pago)"
                    onClick={() => { if (confirm(`Marcar ${v.competencia} (${BRL(Number(v.valor))}) como pago?`)) marcarPago.mutate(v.id); }}
                  >
                    {v.competencia} · {BRL(Number(v.valor))} ✓
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
