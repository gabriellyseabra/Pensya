import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ExternalLink, Receipt, FileText, Download } from "lucide-react";
import { usePortal } from "@/components/portal/portal-context";
import { portalMensalidades, portalDocumentosFiscais, portalDocumentoFiscalUrl } from "@/lib/portal.functions";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/financeiro")({
  component: PortalFinanceiro,
});

const STATUS_BADGE: Record<string, { label: string; className?: string; variant?: "secondary" | "destructive" | "outline" }> = {
  pago: { label: "Pago", className: "bg-brand text-brand-foreground" },
  pendente: { label: "Em aberto", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompetencia(c: string) {
  // competência pode vir como "2026-07" ou data completa
  const m = c.match(/^(\d{4})-(\d{2})/);
  if (!m) return c;
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[parseInt(m[2], 10) - 1]}/${m[1]}`;
}

function PortalFinanceiro() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;

  const { data: mensalidades, isLoading } = useQuery({
    queryKey: ["portal-mensalidades", pid],
    queryFn: () => portalMensalidades(pid),
  });

  const { data: documentos } = useQuery({
    queryKey: ["portal-documentos-fiscais", pid],
    queryFn: () => portalDocumentosFiscais(pid),
  });

  const emAberto = (mensalidades ?? []).filter((m) => m.status !== "pago" && m.status !== "cancelado");

  const TIPO_DOC: Record<string, string> = {
    nota_fiscal: "Nota fiscal",
    recibo: "Recibo",
    recibo_saude: "Recibo de saúde",
  };

  async function baixarDocumento(pdfPath: string | null) {
    if (!pdfPath) return;
    const url = await portalDocumentoFiscalUrl(pdfPath);
    if (url) window.open(url, "_blank");
    else toast.error("Não foi possível abrir o documento.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Mensalidades, vencimentos e pagamento online.
        </p>
      </div>

      {emAberto.length > 0 && (
        <Card className="glass border-brand-yellow/60">
          <CardContent className="flex items-center gap-3 pt-5">
            <Receipt className="h-8 w-8 text-brand" />
            <p className="text-sm">
              Você tem <strong>{emAberto.length}</strong>{" "}
              {emAberto.length === 1 ? "mensalidade em aberto" : "mensalidades em aberto"}.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {(mensalidades ?? []).map((m) => {
          const badge = STATUS_BADGE[m.status] ?? { label: m.status, variant: "outline" as const };
          return (
            <Card key={m.id} className="glass">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <p className="text-sm font-medium">{formatCompetencia(m.competencia)}</p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento {format(parseISO(m.vencimento), "dd/MM/yyyy")}
                    {m.pago_em ? ` · pago em ${format(parseISO(m.pago_em), "dd/MM/yyyy")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{formatBRL(m.valor)}</p>
                  <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>
                  {m.status !== "pago" && m.status !== "cancelado" && m.checkout_url && (
                    <Button asChild size="sm" className="h-8 gradient-brand text-brand-foreground">
                      <a href={m.checkout_url} target="_blank" rel="noreferrer">
                        Pagar <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && (mensalidades ?? []).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma cobrança registrada.
          </p>
        )}
      </div>

      {(documentos ?? []).length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Documentos</h2>
          <p className="text-sm text-muted-foreground">Recibos e notas fiscais disponíveis para download.</p>
          {(documentos ?? []).map((d) => (
            <Card key={d.id} className="glass">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-brand" />
                  <div>
                    <p className="text-sm font-medium">
                      {TIPO_DOC[d.tipo] ?? "Documento"}
                      {d.numero ? ` · nº ${d.numero}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(d.data_documento), "dd/MM/yyyy")}
                      {d.descricao ? ` · ${d.descricao}` : ""} · {formatBRL(d.valor)}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8" onClick={() => baixarDocumento(d.pdf_path)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
