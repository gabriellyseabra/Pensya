import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer } from "lucide-react";

function currency(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(num: number, den: number) {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

export function DRE() {
  const [escopo, setEscopo] = useState<"mes" | "ano">("mes");
  const [refMonth, setRefMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));

  const [ano, mes] = refMonth.split("-").map(Number);
  const base = new Date(ano, mes - 1, 1);
  const ini = escopo === "mes" ? startOfMonth(base) : startOfYear(base);
  const fim = escopo === "mes" ? endOfMonth(base) : endOfYear(base);
  const iniAnt = escopo === "mes" ? startOfMonth(subMonths(base, 1)) : startOfYear(subMonths(base, 12));
  const fimAnt = escopo === "mes" ? endOfMonth(subMonths(base, 1)) : endOfYear(subMonths(base, 12));

  const { data } = useQuery({
    queryKey: ["dre", escopo, refMonth],
    queryFn: async () => {
      const inicioStr = iniAnt.toISOString().slice(0, 10);
      const fimStr = fim.toISOString().slice(0, 10);
      const [pagsRes, lancsRes, planosRes, tiposRes] = await Promise.all([
        supabase.from("pagamentos").select("valor, pago_em, status, vencimento")
          .gte("vencimento", inicioStr).lte("vencimento", fimStr),
        supabase.from("lancamentos_financeiros")
          .select("valor, tipo, status, vencimento, pago_em, plano_conta_id, tipo_servico_id")
          .neq("status", "cancelado")
          .gte("vencimento", inicioStr).lte("vencimento", fimStr),
        supabase.from("plano_contas").select("id, nome, tipo, parent_id, codigo").eq("ativo", true),
        supabase.from("tipos_servico").select("id, nome"),
      ]);
      return {
        pags: pagsRes.data ?? [],
        lancs: lancsRes.data ?? [],
        planos: planosRes.data ?? [],
        tipos: tiposRes.data ?? [],
      };
    },
  });

  const calc = useMemo(() => {
    if (!data) return null;
    const periodo = (di: Date, df: Date) => {
      const diStr = di.toISOString().slice(0, 10);
      const dfStr = df.toISOString().slice(0, 10);
      const pagsP = data.pags.filter((p) => p.vencimento >= diStr && p.vencimento <= dfStr && p.status === "pago");
      const lancsP = data.lancs.filter((l) => l.vencimento >= diStr && l.vencimento <= dfStr && l.status === "confirmado");

      const receitaPacientes = pagsP.reduce((s, p) => s + Number(p.valor), 0);
      const receitasLanc = lancsP.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
      const receitaBruta = receitaPacientes + receitasLanc;

      const despesas = lancsP.filter((l) => l.tipo === "despesa");

      // categorização por plano de contas (nome do pai)
      const planoMap = new Map(data.planos.map((p: any) => [p.id, p]));
      const categoria = (l: any) => {
        const plano: any = l.plano_conta_id ? planoMap.get(l.plano_conta_id) : null;
        if (!plano) return "Sem categoria";
        const pai: any = plano.parent_id ? planoMap.get(plano.parent_id) : plano;
        return pai?.nome ?? plano.nome;
      };

      const porCategoria: Record<string, number> = {};
      for (const d of despesas) {
        const cat = categoria(d);
        porCategoria[cat] = (porCategoria[cat] ?? 0) + Number(d.valor);
      }

      const totalDespesas = despesas.reduce((s, l) => s + Number(l.valor), 0);
      const custosDiretos = (porCategoria["Materiais clínicos"] ?? 0);
      const lucroBruto = receitaBruta - custosDiretos;
      const opex = totalDespesas - custosDiretos;
      const ebitda = lucroBruto - opex;
      const resultado = ebitda;

      return { receitaBruta, receitaPacientes, receitasLanc, custosDiretos, lucroBruto, opex, ebitda, resultado, porCategoria, totalDespesas };
    };
    return { atual: periodo(ini, fim), anterior: periodo(iniAnt, fimAnt) };
  }, [data, ini, fim, iniAnt, fimAnt]);

  if (!calc) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const rows = [
    { label: "Receita bruta", a: calc.atual.receitaBruta, b: calc.anterior.receitaBruta, bold: true },
    { label: "  Receitas de pacientes", a: calc.atual.receitaPacientes, b: calc.anterior.receitaPacientes },
    { label: "  Outras receitas", a: calc.atual.receitasLanc, b: calc.anterior.receitasLanc },
    { label: "(-) Custos diretos", a: -calc.atual.custosDiretos, b: -calc.anterior.custosDiretos },
    { label: "Lucro bruto", a: calc.atual.lucroBruto, b: calc.anterior.lucroBruto, bold: true, divider: true },
    { label: "(-) Despesas operacionais", a: -calc.atual.opex, b: -calc.anterior.opex },
  ];

  // Despesas detalhadas
  const detalhe = Object.entries(calc.atual.porCategoria).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4 print:bg-white">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={escopo} onValueChange={(v) => setEscopo(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mensal</SelectItem>
            <SelectItem value="ano">Anual</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="month"
          value={refMonth}
          onChange={(e) => setRefMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <div className="flex-1" />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />Exportar / Imprimir
        </Button>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            DRE — {escopo === "mes"
              ? format(base, "MMMM yyyy", { locale: ptBR })
              : format(base, "yyyy")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Comparativo com {escopo === "mes" ? "mês" : "ano"} anterior.
            Considera apenas lançamentos confirmados/pagos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Conta</th>
                  <th className="text-right py-2">Atual</th>
                  <th className="text-right py-2 text-muted-foreground">Anterior</th>
                  <th className="text-right py-2 text-muted-foreground">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const delta = r.b ? ((r.a - r.b) / Math.abs(r.b)) * 100 : 0;
                  return (
                    <tr key={i} className={r.divider ? "border-t-2 border-border" : ""}>
                      <td className={`py-1.5 ${r.bold ? "font-semibold" : ""}`}>{r.label}</td>
                      <td className={`py-1.5 text-right ${r.bold ? "font-semibold" : ""} ${r.a < 0 ? "text-destructive" : ""}`}>
                        {currency(r.a)}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">{currency(r.b)}</td>
                      <td className={`py-1.5 text-right text-xs ${delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {r.b ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-foreground/30 bg-muted/30">
                  <td className="py-2 font-bold">EBITDA / Resultado</td>
                  <td className={`py-2 text-right font-bold ${calc.atual.ebitda < 0 ? "text-destructive" : "text-emerald-700"}`}>
                    {currency(calc.atual.ebitda)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{currency(calc.anterior.ebitda)}</td>
                  <td className="py-2 text-right text-xs text-muted-foreground">
                    margem {pct(calc.atual.ebitda, calc.atual.receitaBruta)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Despesas por categoria — período atual</CardTitle></CardHeader>
        <CardContent>
          {detalhe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa confirmada no período.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {detalhe.map(([nome, valor]) => (
                  <tr key={nome} className="border-b last:border-0">
                    <td className="py-1.5">{nome}</td>
                    <td className="py-1.5 text-right font-medium text-destructive">-{currency(valor)}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground w-16">
                      {pct(valor, calc.atual.totalDespesas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
