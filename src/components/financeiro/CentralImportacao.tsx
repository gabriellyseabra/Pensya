import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileSpreadsheet, Landmark, ListPlus, Users, FileClock, ArrowRight } from "lucide-react";
import { ColarPlanilha } from "@/components/financeiro/ColarPlanilha";
import { LancamentoEmMassa } from "@/components/financeiro/ImportacaoRapida";
import { ExtratoBancario } from "@/components/financeiro/extrato/ExtratoBancario";
import { cn } from "@/lib/utils";

type Tipo = "planilha" | "extrato" | "massa";

const OPCOES: {
  key: Tipo | "pacientes" | "prontuario";
  icon: any;
  titulo: string;
  descricao: string;
  externo?: { to: string; label: string };
}[] = [
  {
    key: "extrato",
    icon: Landmark,
    titulo: "Extrato bancário",
    descricao: "Suba o extrato (CSV/OFX) e concilie cada transação com pacientes e categorias.",
  },
  {
    key: "planilha",
    icon: FileSpreadsheet,
    titulo: "Planilha de fluxo de caixa",
    descricao: "Traga o histórico de outro sistema ou Excel — cole ou envie o arquivo, revise e importe.",
  },
  {
    key: "massa",
    icon: ListPlus,
    titulo: "Lançamentos em massa",
    descricao: "Digite vários lançamentos de uma vez numa grade rápida (bom para rotina do mês).",
  },
  {
    key: "pacientes",
    icon: Users,
    titulo: "Pacientes",
    descricao: "Importe sua lista de pacientes em lote — fica na página Pacientes.",
    externo: { to: "/pacientes", label: "Abrir Pacientes" },
  },
  {
    key: "prontuario",
    icon: FileClock,
    titulo: "Prontuário antigo",
    descricao: "Traga registros antigos de um paciente — fica na ficha dele, em Clínico → Sessões.",
    externo: { to: "/pacientes", label: "Escolher paciente" },
  },
];

/**
 * Central de Importação: um lugar só para tudo que entra de fora.
 * Passo 1 escolhe o tipo; o painel correspondente cuida de enviar,
 * pré-visualizar e confirmar.
 */
export function CentralImportacao() {
  const [tipo, setTipo] = useState<Tipo | null>(null);

  if (tipo) {
    const opcao = OPCOES.find((o) => o.key === tipo);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setTipo(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Outros tipos de importação
          </Button>
          <span className="text-sm font-medium text-muted-foreground">· {opcao?.titulo}</span>
        </div>
        {tipo === "planilha" && <ColarPlanilha />}
        {tipo === "extrato" && <ExtratoBancario />}
        {tipo === "massa" && <LancamentoEmMassa />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">O que você quer importar?</h3>
        <p className="text-sm text-muted-foreground">
          Tudo que vem de fora do sistema entra por aqui — escolha o tipo e siga o passo a passo.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OPCOES.map((o) => {
          const Icone = o.icon;
          const conteudo = (
            <Card
              className={cn(
                "glass h-full cursor-pointer p-4 transition hover:shadow-elegant hover:ring-1 hover:ring-brand/30",
              )}
            >
              <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icone className="h-5 w-5" />
              </div>
              <p className="font-medium leading-tight">{o.titulo}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{o.descricao}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand">
                {o.externo ? o.externo.label : "Começar"} <ArrowRight className="h-3 w-3" />
              </span>
            </Card>
          );
          return o.externo ? (
            <Link key={o.key} to={o.externo.to}>{conteudo}</Link>
          ) : (
            <button key={o.key} type="button" className="text-left" onClick={() => setTipo(o.key as Tipo)}>
              {conteudo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
