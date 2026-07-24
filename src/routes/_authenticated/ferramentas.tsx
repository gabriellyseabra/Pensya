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

/** Curva normal (Gauss) com a posição do z marcada e a área do percentil sombreada. */
function CurvaGauss({ z, cor = "#7c3aed" }: { z: number; cor?: string }) {
  const W = 320, H = 130, pad = 12, base = H - 20;
  const xmin = -3.6, xmax = 3.6;
  const N = 120;
  const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const peak = phi(0);
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (W - 2 * pad);
  const sy = (y: number) => base - (y / peak) * (base - 12);
  const xs = Array.from({ length: N + 1 }, (_, i) => xmin + ((xmax - xmin) * i) / N);
  const curve = "M" + xs.map((x) => `${sx(x).toFixed(1)},${sy(phi(x)).toFixed(1)}`).join(" L");
  const zc = Math.max(xmin, Math.min(xmax, z));
  const left = xs.filter((x) => x <= zc);
  const area = left.length
    ? `M${sx(xmin).toFixed(1)},${base} L` + left.map((x) => `${sx(x).toFixed(1)},${sy(phi(x)).toFixed(1)}`).join(" L") + ` L${sx(zc).toFixed(1)},${base} Z`
    : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* faixas de DP */}
      {[-3, -2, -1, 0, 1, 2, 3].map((s) => (
        <g key={s}>
          <line x1={sx(s)} y1={base} x2={sx(s)} y2={base + 3} stroke="#cbd5e1" />
          <text x={sx(s)} y={base + 14} fontSize="8" fill="#94a3b8" textAnchor="middle">{s}</text>
        </g>
      ))}
      <line x1={pad} y1={base} x2={W - pad} y2={base} stroke="#e2e8f0" />
      {area && <path d={area} fill={cor} fillOpacity={0.18} />}
      <path d={curve} fill="none" stroke={cor} strokeWidth={1.5} />
      <line x1={sx(zc)} y1={sy(phi(zc))} x2={sx(zc)} y2={base} stroke={cor} strokeWidth={1.5} strokeDasharray="3 3" />
      <circle cx={sx(zc)} cy={sy(phi(zc))} r={3.5} fill={cor} />
    </svg>
  );
}

/* ===================== Conversor de escores + classificação ===================== */

function CalculadoraEscoreZ({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rubricas, resolver } = useRubricas();
  const [media, setMedia] = useState("");
  const [dp, setDp] = useState("");
  const [bruto, setBruto] = useState("");
  const [direcao, setDirecao] = useState<"maior_melhor" | "menor_melhor">("maior_melhor");
  const [rubricaId, setRubricaId] = useState<string | null>(null);

  const rubrica = resolver(rubricaId);

  const res = useMemo(() => {
    const m = Number(media), s = Number(dp), x = Number(bruto);
    if (media === "" || dp === "" || bruto === "" || !s || Number.isNaN(m) || Number.isNaN(x)) return null;
    // Direção do escore: em testes "maior é melhor" z = (x-m)/DP; em testes onde
    // maior é pior (erros, tempo), o sinal inverte: z = (m-x)/DP.
    const z = direcao === "menor_melhor" ? (m - x) / s : (x - m) / s;
    const T = 50 + 10 * z;
    const padrao = 100 + 15 * z;
    const percentil = Math.min(99.9, Math.max(0.1, normalCDF(z) * 100));
    return { z, T, padrao, percentil };
  }, [media, dp, bruto, direcao]);

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
            <Label className="text-xs">Tipo de teste (direção do escore)</Label>
            <Select value={direcao} onValueChange={(v) => setDirecao(v as "maior_melhor" | "menor_melhor")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="maior_melhor">Escore alto = melhor desempenho · z = (x − média)/DP</SelectItem>
                <SelectItem value="menor_melhor">Escore alto = pior desempenho (erros, tempo) · z = (média − x)/DP</SelectItem>
              </SelectContent>
            </Select>
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
          {res && (
            <div className="rounded-lg border border-border/40 bg-white p-2">
              <CurvaGauss z={res.z} cor={classif?.cor ?? "#7c3aed"} />
              <p className="text-center text-[10px] text-muted-foreground">
                Posição na curva normal · z = {res.z.toFixed(2)} · percentil {res.percentil.toFixed(1)}
              </p>
            </div>
          )}
          <RubricaPreview rubrica={rubrica} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Precificação ============================ */

type ItemServico = { id: string; rotulo: string; valor: string };
let _sq = 0;
const novoItem = (): ItemServico => ({ id: `s${_sq++}`, rotulo: "", valor: "" });

function CalculadoraPrecificacao({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [modo, setModo] = useState<"pacote" | "servico">("pacote");

  // --- modo pacote ---
  const [valorSessao, setValorSessao] = useState("");
  const [qtd, setQtd] = useState("4");
  const [desconto, setDesconto] = useState("");
  const [tipoDesc, setTipoDesc] = useState<"pct" | "reais">("pct");

  const pacote = useMemo(() => {
    const v = Number(valorSessao), q = Number(qtd), d = Number(desconto) || 0;
    if (!v || !q) return null;
    const subtotal = v * q;
    const descontoVal = tipoDesc === "pct" ? (subtotal * d) / 100 : d;
    const total = Math.max(0, subtotal - descontoVal);
    return { subtotal, descontoVal, total, porSessao: total / q };
  }, [valorSessao, qtd, desconto, tipoDesc]);

  // --- modo serviço (avaliação, laudo, devolutiva, reunião…) ---
  const [itens, setItens] = useState<ItemServico[]>([novoItem(), novoItem()]);
  const [materiais, setMateriais] = useState("");
  const [deslocamento, setDeslocamento] = useState("");
  const [descServico, setDescServico] = useState("");
  const [impostoPct, setImpostoPct] = useState("");
  const [taxaPct, setTaxaPct] = useState("");

  function setItem(id: string, campo: keyof ItemServico, v: string) {
    setItens((is) => is.map((i) => (i.id === id ? { ...i, [campo]: v } : i)));
  }

  const servico = useMemo(() => {
    const soma = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const mat = Number(materiais) || 0;
    const desl = Number(deslocamento) || 0;
    const bruto = soma + mat + desl;
    const desc = Number(descServico) || 0;
    const preco = Math.max(0, bruto - desc);
    const imposto = (preco * (Number(impostoPct) || 0)) / 100;
    const taxa = (preco * (Number(taxaPct) || 0)) / 100;
    const liquido = Math.max(0, preco - imposto - taxa);
    if (bruto <= 0) return null;
    return { soma, mat, desl, bruto, desc, preco, imposto, taxa, liquido };
  }, [itens, materiais, deslocamento, descServico, impostoPct, taxaPct]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Precificação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">O que você está precificando?</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as "pacote" | "servico")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pacote">Pacote de sessões</SelectItem>
                <SelectItem value="servico">Serviço (avaliação, laudo, devolutiva…)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modo === "pacote" ? (
            <>
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
              {pacote && (
                <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{BRL(pacote.subtotal)}</span></div>
                  {pacote.descontoVal > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Desconto</span><span>− {BRL(pacote.descontoVal)}</span></div>}
                  <div className="flex justify-between border-t border-border/40 pt-1.5 text-base font-semibold"><span>Total</span><span>{BRL(pacote.total)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Valor efetivo por sessão</span><span>{BRL(pacote.porSessao)}</span></div>
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => copiar(`${qtd} sessões — ${BRL(pacote.total)} (${BRL(pacote.porSessao)}/sessão)`)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar proposta
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs">Itens que compõem o serviço</Label>
                <p className="mb-1.5 text-[10px] text-muted-foreground">Ex.: aplicação, correção, redação do laudo, devolutiva, reunião escolar — cada um com seu valor.</p>
                <div className="space-y-1.5">
                  {itens.map((i) => (
                    <div key={i.id} className="flex gap-2">
                      <Input value={i.rotulo} onChange={(e) => setItem(i.id, "rotulo", e.target.value)} placeholder="Descrição" className="h-8 flex-1 text-xs" />
                      <Input type="number" step="0.01" value={i.valor} onChange={(e) => setItem(i.id, "valor", e.target.value)} placeholder="R$" className="h-8 w-24 text-xs" />
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-1.5 h-7 text-xs" onClick={() => setItens((is) => [...is, novoItem()])}>
                  + Item
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Materiais/insumos (R$)</Label><Input type="number" step="0.01" value={materiais} onChange={(e) => setMateriais(e.target.value)} placeholder="0" /></div>
                <div><Label className="text-xs">Deslocamento (R$)</Label><Input type="number" step="0.01" value={deslocamento} onChange={(e) => setDeslocamento(e.target.value)} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Desconto (R$)</Label><Input type="number" step="0.01" value={descServico} onChange={(e) => setDescServico(e.target.value)} placeholder="0" /></div>
                <div><Label className="text-xs">Imposto (%)</Label><Input type="number" step="0.01" value={impostoPct} onChange={(e) => setImpostoPct(e.target.value)} placeholder="0" /></div>
                <div><Label className="text-xs">Taxa receb. (%)</Label><Input type="number" step="0.01" value={taxaPct} onChange={(e) => setTaxaPct(e.target.value)} placeholder="0" /></div>
              </div>
              {servico && (
                <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{BRL(servico.soma)}</span></div>
                  {(servico.mat > 0 || servico.desl > 0) && (
                    <div className="flex justify-between text-muted-foreground"><span>Materiais + deslocamento</span><span>{BRL(servico.mat + servico.desl)}</span></div>
                  )}
                  {servico.desc > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>Desconto</span><span>− {BRL(servico.desc)}</span></div>}
                  <div className="flex justify-between border-t border-border/40 pt-1.5 text-base font-semibold"><span>Preço a cobrar</span><span>{BRL(servico.preco)}</span></div>
                  {(servico.imposto > 0 || servico.taxa > 0) && (
                    <>
                      <div className="flex justify-between text-xs text-muted-foreground"><span>− Imposto</span><span>{BRL(servico.imposto)}</span></div>
                      <div className="flex justify-between text-xs text-muted-foreground"><span>− Taxa de recebimento</span><span>{BRL(servico.taxa)}</span></div>
                      <div className="flex justify-between text-xs font-medium"><span>Líquido estimado</span><span>{BRL(servico.liquido)}</span></div>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => copiar(`Serviço — ${BRL(servico.preco)}`)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar preço
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
