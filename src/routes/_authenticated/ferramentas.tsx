import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Wrench, ArrowRight, CalendarClock, Sigma, Calculator, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/PageHero";
import { GeradorGraficoAvaliacao } from "@/components/prontuario/GeradorGraficoAvaliacao";
import { RubricaPreview } from "@/components/prontuario/RubricaPreview";
import { useRubricas } from "@/hooks/use-rubricas";
import { classificar } from "@/lib/avaliacao-classificacao";

export const Route = createFileRoute("/_authenticated/ferramentas")({
  component: FerramentasPage,
});

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Distribuição normal acumulada (Abramowitz & Stegun 7.1.26). */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function copiar(txt: string) {
  navigator.clipboard.writeText(txt).then(() => toast.success("Copiado"), () => toast.info(txt));
}

function FerramentasPage() {
  const [aberto, setAberto] = useState<string | null>(null);

  const ferramentas = [
    {
      key: "graficos", titulo: "Gerador de gráficos", icon: BarChart3,
      descricao: "Monte gráficos do zero — por teste, área, instrumento ou tarefa clínica — com as cores da classificação. Barras, linha, radar ou pizza; exporta PNG.",
    },
    {
      key: "idade", titulo: "Idade cronológica", icon: CalendarClock,
      descricao: "Calcula anos, meses e dias entre a data de nascimento e a data da aplicação — o número que a maioria dos testes pede.",
    },
    {
      key: "escore_z", titulo: "Conversor de escores + classificação", icon: Sigma,
      descricao: "Converte escore bruto em z, T, escore-padrão e percentil (curva normal) e classifica pela rubrica escolhida. Você insere os dados — sem tabela de norma embutida.",
    },
    {
      key: "precificacao", titulo: "Precificação", icon: Calculator,
      descricao: "Simula valor por sessão, quantidade, desconto e total — para montar um pacote ou proposta sem lançar nada.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={Wrench}
        eyebrow="Gestão"
        title="Ferramentas"
        description="Utilidades avulsas da clínica — independentes de um paciente ou avaliação específica."
        variant="brand"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ferramentas.map((f) => (
          <Card key={f.key} className="glass card-lift">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{f.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.descricao}</p>
              </div>
              <Button variant="outline" size="sm" className="self-start" onClick={() => setAberto(f.key)}>
                Abrir <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <GeradorGraficoAvaliacao open={aberto === "graficos"} onOpenChange={(o) => !o && setAberto(null)} />
      <CalculadoraIdade open={aberto === "idade"} onClose={() => setAberto(null)} />
      <CalculadoraEscoreZ open={aberto === "escore_z"} onClose={() => setAberto(null)} />
      <CalculadoraPrecificacao open={aberto === "precificacao"} onClose={() => setAberto(null)} />
    </div>
  );
}

/* ========================= Idade cronológica ========================= */

function CalculadoraIdade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nasc, setNasc] = useState("");
  const [ref, setRef] = useState(format(new Date(), "yyyy-MM-dd"));

  const res = useMemo(() => {
    if (!nasc || !ref) return null;
    const n = new Date(nasc + "T00:00:00");
    const r = new Date(ref + "T00:00:00");
    if (isNaN(+n) || isNaN(+r) || r < n) return null;
    let anos = r.getFullYear() - n.getFullYear();
    let meses = r.getMonth() - n.getMonth();
    let dias = r.getDate() - n.getDate();
    if (dias < 0) {
      meses -= 1;
      dias += new Date(r.getFullYear(), r.getMonth(), 0).getDate();
    }
    if (meses < 0) { anos -= 1; meses += 12; }
    const totalDias = Math.round((+r - +n) / 86400000);
    return { anos, meses, dias, decimal: (totalDias / 365.25).toFixed(2) };
  }, [nasc, ref]);

  const textoCurto = res ? `${res.anos}a ${res.meses}m ${res.dias}d` : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Idade cronológica</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} />
            </div>
            <div>
              <Label>Data de referência</Label>
              <Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          </div>
          {res ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-center">
              <p className="text-2xl font-semibold">{res.anos}a {res.meses}m {res.dias}d</p>
              <p className="mt-1 text-xs text-muted-foreground">≈ {res.decimal} anos</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => copiar(textoCurto)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Informe as duas datas (a de referência deve ser após o nascimento).</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== Conversor de escores + classificação ===================== */

function CalculadoraEscoreZ({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rubricas, resolver } = useRubricas();
  const [media, setMedia] = useState("");
  const [dp, setDp] = useState("");
  const [bruto, setBruto] = useState("");
  const [rubricaId, setRubricaId] = useState<string | null>(null);

  const rubrica = resolver(rubricaId);

  const res = useMemo(() => {
    const m = Number(media), s = Number(dp), x = Number(bruto);
    if (media === "" || dp === "" || bruto === "" || !s || Number.isNaN(m) || Number.isNaN(x)) return null;
    const z = (x - m) / s;
    const T = 50 + 10 * z;
    const padrao = 100 + 15 * z;
    const percentil = Math.min(99.9, Math.max(0.1, normalCDF(z) * 100));
    return { z, T, padrao, percentil };
  }, [media, dp, bruto]);

  const classif = res ? classificar(rubrica, { percentil: res.percentil, escorePadrao: res.padrao }) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conversor de escores + classificação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Insira o escore bruto e a média/desvio-padrão da norma do seu material. O sistema converte pela curva
            normal — não guarda tabela de norma de nenhum teste.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Bruto</Label><Input type="number" step="0.01" value={bruto} onChange={(e) => setBruto(e.target.value)} /></div>
            <div><Label className="text-xs">Média</Label><Input type="number" step="0.01" value={media} onChange={(e) => setMedia(e.target.value)} /></div>
            <div><Label className="text-xs">Desvio-padrão</Label><Input type="number" step="0.01" value={dp} onChange={(e) => setDp(e.target.value)} /></div>
          </div>
          <div>
            <Label className="text-xs">Rubrica de classificação</Label>
            <Select value={rubricaId ?? "__padrao__"} onValueChange={(v) => setRubricaId(v === "__padrao__" ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__padrao__">Padrão (clínica — 7 faixas)</SelectItem>
                {rubricas.filter((r) => r.id).map((r) => (
                  <SelectItem key={r.id} value={r.id!}>{r.nome}{r.is_preset ? "" : " · sua rubrica"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {res && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "z", v: res.z.toFixed(2) },
                { l: "T (M=50/DP=10)", v: res.T.toFixed(1) },
                { l: "Escore-padrão (M=100/DP=15)", v: res.padrao.toFixed(1) },
                { l: "Percentil", v: res.percentil.toFixed(1) },
              ].map((o) => (
                <div key={o.l} className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{o.l}</p>
                  <p className="text-lg font-semibold tabular-nums">{o.v}</p>
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Classificação</span>
                {classif
                  ? <span className="rounded px-2 py-0.5 text-sm font-medium" style={{ backgroundColor: `${classif.cor}26`, color: classif.cor }}>{classif.rotulo}</span>
                  : <span className="text-sm text-muted-foreground">—</span>}
              </div>
            </div>
          )}
          <RubricaPreview rubrica={rubrica} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Precificação ============================ */

function CalculadoraPrecificacao({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [valorSessao, setValorSessao] = useState("");
  const [qtd, setQtd] = useState("4");
  const [desconto, setDesconto] = useState("");
  const [tipoDesc, setTipoDesc] = useState<"pct" | "reais">("pct");

  const res = useMemo(() => {
    const v = Number(valorSessao), q = Number(qtd), d = Number(desconto) || 0;
    if (!v || !q) return null;
    const subtotal = v * q;
    const descontoVal = tipoDesc === "pct" ? (subtotal * d) / 100 : d;
    const total = Math.max(0, subtotal - descontoVal);
    return { subtotal, descontoVal, total, porSessao: total / q };
  }, [valorSessao, qtd, desconto, tipoDesc]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Precificação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Valor por sessão (R$)</Label><Input type="number" step="0.01" value={valorSessao} onChange={(e) => setValorSessao(e.target.value)} /></div>
            <div><Label className="text-xs">Nº de sessões</Label><Input type="number" step="1" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0" /></div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipoDesc} onValueChange={(v) => setTipoDesc(v as "pct" | "reais")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Percentual (%)</SelectItem>
                  <SelectItem value="reais">Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {res && (
            <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{BRL(res.subtotal)}</span></div>
              {res.descontoVal > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Desconto</span><span>− {BRL(res.descontoVal)}</span></div>}
              <div className="flex justify-between border-t border-border/40 pt-1.5 text-base font-semibold"><span>Total</span><span>{BRL(res.total)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Valor efetivo por sessão</span><span>{BRL(res.porSessao)}</span></div>
              <Button size="sm" variant="outline" className="mt-2 w-full"
                onClick={() => copiar(`${qtd} sessões — ${BRL(res.total)} (${BRL(res.porSessao)}/sessão)`)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar proposta
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
