import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User, GraduationCap, Briefcase, Heart, Wallet, Users, Pencil, Star, Megaphone,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PACIENTE_STATUS_LABEL } from "@/lib/paciente-status";

type Paciente = Record<string, any>;

const GENERO_LABEL: Record<string, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  outro: "Outro",
  nao_informar: "Prefiro não informar",
};

const PAGAMENTO_LABEL: Record<string, string> = {
  mensalidade: "Mensalidade",
  sessao: "Por sessão",
  pacote: "Pacote",
  convenio: "Convênio",
};

function fmtData(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  try {
    return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return v;
  }
}

function fmtValor(v: any): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Uma linha rótulo/valor; some quando não há valor. */
function Linha({ label, value }: { label: string; value: React.ReactNode }) {
  const vazio =
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (vazio) return null;
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium whitespace-pre-wrap">{value}</span>
    </div>
  );
}

function Secao({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/40 py-0">{children}</CardContent>
    </Card>
  );
}

export function FichaCadastralTab({
  paciente,
  onEditar,
}: {
  paciente: Paciente;
  onEditar: () => void;
}) {
  const idade = paciente.data_nascimento
    ? Math.floor(
        (Date.now() - new Date(paciente.data_nascimento).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      )
    : null;

  const nascimento = fmtData(paciente.data_nascimento);
  const genero = paciente.genero
    ? GENERO_LABEL[paciente.genero] ?? paciente.genero
    : null;

  const diagnosticos: string[] = (paciente.paciente_diagnosticos ?? [])
    .map((pd: any) => pd?.diagnostico?.nome)
    .filter(Boolean);

  const responsaveis: Paciente[] = paciente.responsaveis ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Todos os dados cadastrais do paciente. Para alterar, use o botão ao lado.
        </p>
        <Button onClick={onEditar} className="rounded-full shrink-0">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao icon={<User className="h-4 w-4 text-brand" />} title="Dados pessoais">
          <Linha label="Nome" value={paciente.nome} />
          <Linha
            label="Nascimento"
            value={nascimento ? `${nascimento}${idade != null ? ` · ${idade} anos` : ""}` : null}
          />
          <Linha label="Gênero" value={genero} />
          <Linha label="CPF" value={paciente.cpf} />
          <Linha label="Documento" value={paciente.documento} />
          <Linha label="Telefone" value={paciente.telefone} />
          <Linha label="E-mail" value={paciente.email} />
          <Linha label="Endereço" value={paciente.endereco} />
          <Linha
            label="Autoriza imagem"
            value={
              paciente.autoriza_imagem === true
                ? "Sim"
                : paciente.autoriza_imagem === false
                  ? "Não"
                  : null
            }
          />
        </Secao>

        <Secao icon={<GraduationCap className="h-4 w-4 text-brand" />} title="Escola">
          <Linha label="Escola" value={paciente.escola?.nome} />
          <Linha label="Escolaridade" value={paciente.escolaridade} />
          <Linha label="Série / curso" value={paciente.serie_curso} />
          <Linha label="Contato da escola" value={paciente.contato_escola} />
        </Secao>

        <Secao icon={<Briefcase className="h-4 w-4 text-brand" />} title="Atendimento">
          <Linha label="Modalidade" value={paciente.modalidade?.nome} />
          <Linha
            label="Profissional"
            value={paciente.profissional_responsavel?.nome}
          />
          <Linha
            label="Status"
            value={
              paciente.status
                ? PACIENTE_STATUS_LABEL[
                    paciente.status as keyof typeof PACIENTE_STATUS_LABEL
                  ] ?? paciente.status
                : null
            }
          />
          <Linha label="Motivo do status" value={paciente.motivo_status} />
          <Linha label="Início" value={fmtData(paciente.data_inicio)} />
          <Linha label="Última avaliação" value={fmtData(paciente.data_ultima_avaliacao)} />
          <Linha label="Data de alta" value={fmtData(paciente.data_alta)} />
        </Secao>

        <Secao icon={<Heart className="h-4 w-4 text-brand" />} title="Clínico">
          <Linha label="Queixa principal" value={paciente.queixa_principal} />
          <Linha label="Expectativas" value={paciente.expectativas} />
          <Linha
            label="Hipótese diagnóstica"
            value={paciente.hipotese_diagnostica ? "Sim" : null}
          />
          <Linha
            label="Diagnósticos"
            value={
              diagnosticos.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {diagnosticos.map((d, i) => (
                    <Badge key={i} className="rounded-full bg-accent text-accent-foreground">
                      {d}
                    </Badge>
                  ))}
                </span>
              ) : null
            }
          />
          <Linha label="Observações" value={paciente.observacoes} />
        </Secao>

        <Secao icon={<Megaphone className="h-4 w-4 text-brand" />} title="Origem comercial">
          <Linha
            label="Origem"
            value={
              paciente.origem_criacao === "lead_marketing"
                ? "Lead de marketing"
                : paciente.origem_criacao
                  ? paciente.origem_criacao
                  : null
            }
          />
          <Linha label="Lead" value={paciente.lead_origem?.nome} />
          <Linha label="Canal" value={paciente.canal_origem?.nome} />
          <Linha label="Campanha" value={paciente.campanha_origem?.nome} />
          <Linha label="Conversão" value={fmtData(paciente.data_conversao_marketing)} />
        </Secao>

        <Secao icon={<Wallet className="h-4 w-4 text-brand" />} title="Financeiro">
          <Linha
            label="Modelo de pagamento"
            value={
              paciente.modelo_pagamento
                ? PAGAMENTO_LABEL[paciente.modelo_pagamento] ?? paciente.modelo_pagamento
                : null
            }
          />
          <Linha label="Valor acordado" value={fmtValor(paciente.valor_acordado)} />
          <Linha
            label="Dia de vencimento"
            value={paciente.dia_vencimento ? `Dia ${paciente.dia_vencimento}` : null}
          />
          <Linha label="Nº de parcelas" value={paciente.numero_parcelas} />
        </Secao>
      </div>

      <Secao icon={<Users className="h-4 w-4 text-brand" />} title="Responsáveis">
        {responsaveis.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {responsaveis.map((r, i) => {
              const linha = [
                r.parentesco,
                r.idade && `${r.idade} anos`,
                r.profissao,
                r.estado_civil,
              ]
                .filter(Boolean)
                .join(" · ");
              const contato = [r.telefone, r.email].filter(Boolean).join(" · ");
              return (
                <div key={r.id ?? i} className="py-3 first:pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.nome || "Sem nome"}</span>
                    {r.principal && (
                      <Badge variant="secondary" className="gap-1 rounded-full">
                        <Star className="h-3 w-3" />
                        Principal
                      </Badge>
                    )}
                  </div>
                  {linha && <p className="mt-0.5 text-sm text-muted-foreground">{linha}</p>}
                  {contato && <p className="mt-0.5 text-sm">{contato}</p>}
                  {r.documento && (
                    <p className="mt-0.5 text-sm text-muted-foreground">CPF: {r.documento}</p>
                  )}
                  {r.deseja_nf && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Deseja NF{r.dados_nf ? ` — ${r.dados_nf}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Secao>
    </div>
  );
}
