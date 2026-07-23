import { Fragment, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  X,
  ClipboardPaste,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { criarPacientesEmLote } from "@/lib/importar-pacientes.functions";
import {
  parsearPlanilhaPacientes,
  parsearTextoColado,
  baixarModeloPlanilhaPacientes,
} from "@/lib/importar-pacientes-parser";

type Row = {
  nome: string;
  data_nascimento?: string | null;
  genero?: string | null;
  cpf?: string | null;
  documento?: string | null;
  email?: string | null;
  endereco?: string | null;
  escola?: string | null;
  escolaridade?: string | null;
  serie_curso?: string | null;
  contato_escola?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
  responsavel_email?: string | null;
  responsavel_documento?: string | null;
  responsavel_parentesco?: string | null;
  responsavel2_nome?: string | null;
  profissional_responsavel?: string | null;
  especialidade?: string | null;
  diagnostico?: string | null;
  modalidade?: string | null;
  local_atendimento?: string | null;
  status?: string | null;
  data_ultima_avaliacao?: string | null;
  data_alta?: string | null;
  convenio?: string | null;
  queixa_principal?: string | null;
  expectativas?: string | null;
  observacoes?: string | null;
  data_inicio?: string | null;
  modelo_pagamento?: string | null;
  valor_acordado?: number | string | null;
  dia_vencimento?: number | string | null;
  numero_parcelas?: number | string | null;
  _check?: boolean;
  _expanded?: boolean;
};

// Campos exibidos no painel "mais campos" — fora das colunas principais da tabela.
const EXTRA_FIELDS: { key: keyof Row; label: string; type?: string }[] = [
  { key: "genero", label: "Gênero" },
  { key: "cpf", label: "CPF" },
  { key: "documento", label: "Documento" },
  { key: "email", label: "Email" },
  { key: "endereco", label: "Endereço" },
  { key: "escolaridade", label: "Escolaridade" },
  { key: "contato_escola", label: "Contato da escola" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "modalidade", label: "Modalidade" },
  { key: "status", label: "Status" },
  { key: "profissional_responsavel", label: "Profissional responsável" },
  { key: "especialidade", label: "Especialidade" },
  { key: "local_atendimento", label: "Local de atendimento" },
  { key: "data_ultima_avaliacao", label: "Última avaliação", type: "date" },
  { key: "data_alta", label: "Data da alta", type: "date" },
  { key: "responsavel2_nome", label: "Responsável 2" },
  { key: "responsavel_email", label: "Email do responsável" },
  { key: "responsavel_documento", label: "Documento do responsável" },
  { key: "responsavel_parentesco", label: "Parentesco do responsável" },
  { key: "convenio", label: "Convênio" },
  { key: "queixa_principal", label: "Queixa principal" },
  { key: "expectativas", label: "Expectativas" },
  { key: "observacoes", label: "Observações" },
  { key: "data_inicio", label: "Data de início", type: "date" },
  { key: "modelo_pagamento", label: "Modelo de pagamento" },
  { key: "valor_acordado", label: "Valor acordado (R$)", type: "number" },
  { key: "dia_vencimento", label: "Dia de vencimento", type: "number" },
  { key: "numero_parcelas", label: "Nº de parcelas", type: "number" },
];

function countExtra(r: Row): number {
  return EXTRA_FIELDS.reduce((acc, f) => acc + (r[f.key] ? 1 : 0), 0);
}

export function ImportarPacientesDialog({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [pasteText, setPasteText] = useState("");
  const qc = useQueryClient();

  const criar = useServerFn(criarPacientesEmLote);

  async function carregar(fonte: () => Promise<Row[]>, vazioMsg: string) {
    setParsing(true);
    setRows([]);
    try {
      const lista = (await fonte()).map((p) => ({ ...p, _check: true, _expanded: false }));
      if (lista.length === 0) toast.warning(vazioMsg);
      setRows(lista);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar os dados");
    } finally {
      setParsing(false);
    }
  }

  function handleUpload(file: File) {
    setFileName(file.name);
    carregar(() => parsearPlanilhaPacientes(file), "Nenhum paciente identificado no arquivo.");
  }

  function handlePaste() {
    if (!pasteText.trim()) {
      toast.warning("Cole os dados da planilha primeiro.");
      return;
    }
    carregar(
      () => parsearTextoColado(pasteText),
      "Nenhum paciente identificado. Verifique se você incluiu a linha de títulos das colunas.",
    );
  }

  const criarMut = useMutation({
    mutationFn: async () => {
      const selecionados = rows.filter((r) => r._check && r.nome?.trim());
      if (selecionados.length === 0) throw new Error("Selecione ao menos um paciente");
      return criar({ data: { pacientes: selecionados.map(({ _check, _expanded, ...r }) => r) } });
    },
    onSuccess: (res: any) => {
      toast.success(
        `${res.criados} pacientes criados${res.escolasCriadas ? ` · ${res.escolasCriadas} escolas` : ""}`,
      );
      if (res.avisos?.length) {
        toast.warning(
          `${res.avisos.length} aviso(s): confira modalidade/profissional não reconhecidos`,
          {
            description: res.avisos
              .slice(0, 4)
              .map((a: any) => `${a.nome}: ${a.aviso}`)
              .join(" · "),
          },
        );
      }
      if (res.erros?.length) toast.warning(`${res.erros.length} com erro`);
      setOpen(false);
      setRows([]);
      setFileName("");
      setPasteText("");
      qc.invalidateQueries({ queryKey: ["pacientes"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function clearField(i: number, key: keyof Row) {
    updateRow(i, { [key]: "" } as Partial<Row>);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar arquivo
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-brand" /> Importar pacientes (arquivo ou colar)
          </DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <Tabs defaultValue="arquivo" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="arquivo" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Enviar arquivo
              </TabsTrigger>
              <TabsTrigger value="colar" className="gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" /> Colar da planilha
              </TabsTrigger>
            </TabsList>

            <TabsContent value="arquivo">
              <div className="border-2 border-dashed rounded-lg p-10 text-center space-y-3">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <Label htmlFor="upload-file" className="cursor-pointer">
                    <span className="text-brand underline">Selecionar arquivo</span>
                    <Input
                      id="upload-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      disabled={parsing}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos suportados: .xlsx, .xls, .csv. Os dados são reconhecidos
                    automaticamente pelos cabeçalhos das colunas — inclusive a exportação direta do
                    SisClin (a linha de cabeçalho é detectada sozinha) — e exibidos em um preview
                    editável, sem uso de IA. Modalidade, profissional responsável e diagnóstico são
                    casados com os cadastros da sua clínica.
                  </p>
                </div>
                {parsing && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analisando {fileName}...
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Não tem uma planilha pronta?</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-brand"
                  onClick={() =>
                    baixarModeloPlanilhaPacientes().catch(() =>
                      toast.error("Não foi possível gerar o modelo"),
                    )
                  }
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Baixar modelo de planilha
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="colar" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Na sua planilha (Excel ou Google Sheets), selecione as linhas{" "}
                <strong>incluindo a linha de títulos das colunas</strong> (Nome, Nascimento,
                Responsável…), copie (Ctrl+C) e cole aqui (Ctrl+V). As colunas são reconhecidas
                automaticamente, do mesmo jeito que no arquivo.
              </p>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                disabled={parsing}
                rows={10}
                placeholder={
                  "Nome\tNascimento\tResponsável\tTelefone\tEscola\n" +
                  "Maria Silva\t10/03/2017\tJoana Silva\t(11) 90000-0000\tColégio Aurora\n" +
                  "João Souza\t22/08/2016\tPedro Souza\t(11) 91111-1111\tEscola Nova"
                }
                className="font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handlePaste}
                  disabled={parsing || !pasteText.trim()}
                  className="gradient-brand text-brand-foreground"
                >
                  {parsing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                  )}
                  Processar dados colados
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.every((r) => r._check)}
                      onCheckedChange={(v) =>
                        setRows((rr) => rr.map((r) => ({ ...r, _check: !!v })))
                      }
                    />
                  </TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Nome *</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Mais dados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const extra = countExtra(r);
                  return (
                    <Fragment key={i}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            checked={r._check}
                            onCheckedChange={(v) => updateRow(i, { _check: !!v })}
                          />
                        </TableCell>
                        <TableCell>
                          {extra > 0 && (
                            <button
                              type="button"
                              onClick={() => updateRow(i, { _expanded: !r._expanded })}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {r._expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={r.nome ?? ""}
                            onChange={(e) => updateRow(i, { nome: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-32"
                            type="date"
                            value={r.data_nascimento ?? ""}
                            onChange={(e) => updateRow(i, { data_nascimento: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={r.responsavel_nome ?? ""}
                            onChange={(e) => updateRow(i, { responsavel_nome: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={r.responsavel_telefone ?? ""}
                            onChange={(e) => updateRow(i, { responsavel_telefone: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={r.escola ?? ""}
                            onChange={(e) => updateRow(i, { escola: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-24"
                            value={r.serie_curso ?? ""}
                            onChange={(e) => updateRow(i, { serie_curso: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          {extra > 0 ? (
                            <Badge
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() => updateRow(i, { _expanded: !r._expanded })}
                            >
                              +{extra} campo{extra > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {r._expanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={9} className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {EXTRA_FIELDS.map((f) => {
                                const value = r[f.key] as string | number | null | undefined;
                                if (!value && value !== 0) return null;
                                return (
                                  <div key={String(f.key)} className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      {f.label}
                                    </Label>
                                    <div className="flex items-center gap-1">
                                      <Input
                                        className="h-8"
                                        type={f.type ?? "text"}
                                        value={value ?? ""}
                                        onChange={(e) =>
                                          updateRow(i, { [f.key]: e.target.value } as Partial<Row>)
                                        }
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                        title="Remover este dado"
                                        onClick={() => clearField(i, f.key)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setRows([]);
                setFileName("");
                setPasteText("");
              }}
            >
              Recomeçar
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          {rows.length > 0 && (
            <Button
              onClick={() => criarMut.mutate()}
              disabled={criarMut.isPending}
              className="gradient-brand text-brand-foreground"
            >
              {criarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e criar {rows.filter((r) => r._check).length} pacientes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
