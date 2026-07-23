import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileSpreadsheet, ListPlus, Users, FileClock, Landmark } from "lucide-react";
import { ColarPlanilha } from "@/components/financeiro/ColarPlanilha";
import { LancamentoEmMassa } from "@/components/financeiro/ImportacaoRapida";
import { ImportarPacientesDialog } from "@/components/paciente/ImportarPacientesDialog";

type Tipo = "planilha" | "massa" | "pacientes" | "prontuario";

const OPCOES: { key: Tipo; icon: any; titulo: string; descricao: string }[] = [
  {
    key: "pacientes",
    icon: Users,
    titulo: "Pacientes em massa",
    descricao: "Traga sua lista de pacientes de outro sistema ou planilha de uma vez.",
  },
  {
    key: "prontuario",
    icon: FileClock,
    titulo: "Prontuário antigo",
    descricao: "Registros, anamneses e sessões antigas de um paciente (arquivo ou texto).",
  },
  {
    key: "planilha",
    icon: FileSpreadsheet,
    titulo: "Planilha financeira",
    descricao: "Histórico do fluxo de caixa vindo de outro sistema ou Excel — cole ou envie.",
  },
  {
    key: "massa",
    icon: ListPlus,
    titulo: "Lançamentos em massa",
    descricao: "Digite vários lançamentos financeiros de uma vez numa grade rápida.",
  },
];

/**
 * Central de Importação: um lugar só para tudo que entra de fora do sistema.
 * O extrato bancário fica no Financeiro (Lançamentos → Extrato bancário),
 * porque a conciliação é uma tarefa financeira contínua, não uma importação.
 */
export function CentralImportacao() {
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const qc = useQueryClient();

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
        {tipo === "massa" && <LancamentoEmMassa />}

        {tipo === "pacientes" && (
          <Card className="glass max-w-xl space-y-3 p-6">
            <p className="text-sm text-muted-foreground">
              Envie um arquivo (CSV/Excel) ou cole a lista — o sistema reconhece as colunas
              (nome, nascimento, responsável, telefone…) e mostra a prévia antes de importar.
            </p>
            <ImportarPacientesDialog onDone={() => qc.invalidateQueries({ queryKey: ["pacientes"] })} />
          </Card>
        )}

        {tipo === "prontuario" && (
          <Card className="glass max-w-xl space-y-3 p-6">
            <p className="text-sm">
              O prontuário antigo é importado <strong>dentro da ficha do paciente</strong>, para os
              registros já entrarem no histórico certo:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Abra a ficha do paciente;</li>
              <li>Vá em <strong>Clínico → Sessões</strong>;</li>
              <li>Abra <strong>"Importar prontuário antigo"</strong> no fim da página (aceita PDF, Word e texto).</li>
            </ol>
            <Button asChild size="sm" className="gradient-brand text-brand-foreground">
              <Link to="/pacientes">Escolher paciente <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
            </Button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">O que você quer importar?</h3>
        <p className="text-sm text-muted-foreground">
          Tudo que vem de fora entra por aqui — escolha o tipo e siga o passo a passo.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPCOES.map((o) => {
          const Icone = o.icon;
          return (
            <button key={o.key} type="button" className="text-left" onClick={() => setTipo(o.key)}>
              <Card className="glass h-full cursor-pointer p-4 transition hover:shadow-elegant hover:ring-1 hover:ring-brand/30">
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Icone className="h-5 w-5" />
                </div>
                <p className="font-medium leading-tight">{o.titulo}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{o.descricao}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand">
                  Começar <ArrowRight className="h-3 w-3" />
                </span>
              </Card>
            </button>
          );
        })}
      </div>
      <Card className="glass flex items-center gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Landmark className="h-4 w-4" />
        </div>
        <p className="flex-1 text-sm text-muted-foreground">
          <strong className="text-foreground">Extrato bancário</strong> fica no Financeiro
          (Lançamentos → Extrato bancário), junto da conciliação de pagamentos.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/financeiro">Abrir Financeiro</Link>
        </Button>
      </Card>
    </div>
  );
}
