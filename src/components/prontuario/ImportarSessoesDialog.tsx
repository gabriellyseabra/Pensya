import { Fragment, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileSpreadsheet, ChevronDown, ChevronRight, X, History } from "lucide-react";
import { toast } from "sonner";
import { importarSessoesEmLote, extrairSessoesPdfIA } from "@/lib/importar-sessoes.functions";
import { parsearPlanilhasSessoes, type SessaoImportRow } from "@/lib/importar-sessoes-parser";

type Row = SessaoImportRow & { _check?: boolean; _expanded?: boolean };

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

const TIPO_OPTIONS = [
  { value: "intervencao", label: "Intervenção" },
  { value: "avaliacao", label: "Avaliação" },
];

const NIVEIS_SUPORTE = [
  { value: "independente", label: "Independente" },
  { value: "verbal", label: "Suporte verbal" },
  { value: "gestual", label: "Suporte gestual" },
  { value: "fisico_parcial", label: "Físico parcial" },
  { value: "fisico_total", label: "Físico total" },
];

export function ImportarSessoesDialog({ pacienteId, onDone }: { pacienteId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [arquivos, setArquivos] = useState<string[]>([]);
  const qc = useQueryClient();

  const importar = useServerFn(importarSessoesEmLote);
  const extrairPdf = useServerFn(extrairSessoesPdfIA);

  async function handleUpload(files: FileList) {
    setParsing(true);
    try {
      const todos = Array.from(files);
      const pdfs = todos.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      const planilhas = todos.filter((f) => !f.name.toLowerCase().endsWith(".pdf"));

      const [daPlanilha, ...doPdf] = await Promise.all([
        planilhas.length ? parsearPlanilhasSessoes(planilhas) : Promise.resolve([]),
        ...pdfs.map(async (file) => {
          const pdf_base64 = await fileToBase64(file);
          const { sessoes } = await extrairPdf({ data: { pdf_base64, pdf_mime: file.type || "application/pdf" } });
          return sessoes.map((s) => ({ ...s, _arquivo: file.name }));
        }),
      ]);

      const lista = [...daPlanilha, ...doPdf.flat()].sort((a, b) => a.data_sessao.localeCompare(b.data_sessao));
      setArquivos(todos.map((f) => f.name));
      if (lista.length === 0) toast.warning("Nenhum registro de sessão identificado nos arquivos.");
      // Pré-seleciona os mesmos padrões do formulário de nova sessão quando o arquivo não traz o dado
      setRows(lista.map((r) => ({
        ...r,
        engajamento: r.engajamento ?? 3,
        autorregulacao: r.autorregulacao ?? 4,
        nivel_suporte: r.nivel_suporte ?? "verbal",
        _check: true,
        _expanded: false,
      })));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar arquivo(s)");
    } finally {
      setParsing(false);
    }
  }

  const importarMut = useMutation({
    mutationFn: async () => {
      const selecionadas = rows.filter((r) => r._check);
      if (selecionadas.length === 0) throw new Error("Selecione ao menos uma sessão");
      return importar({
        data: {
          paciente_id: pacienteId,
          sessoes: selecionadas.map(({ _check, _expanded, _arquivo, ...r }) => r),
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(`${res.criadas} sessões importadas`);
      if (res.erros?.length) toast.warning(`${res.erros.length} com erro`);
      setOpen(false);
      setRows([]);
      setArquivos([]);
      qc.invalidateQueries({ queryKey: ["prontuario-sessoes", pacienteId] });
      qc.invalidateQueries({ queryKey: ["frequencia", pacienteId] });
      qc.invalidateQueries({ queryKey: ["evolucao-sessoes", pacienteId] });
      qc.invalidateQueries({ queryKey: ["evolucao-frequencia", pacienteId] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History className="mr-2 h-4 w-4" /> Importar histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-brand" /> Importar sessões anteriores (Excel, CSV, PDF)
          </DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-10 text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <Label htmlFor="upload-sessoes" className="cursor-pointer">
                <span className="text-brand underline">Selecionar arquivo(s)</span>
                <Input
                  id="upload-sessoes"
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  disabled={parsing}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files);
                  }}
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos suportados: .xlsx, .xls, .csv (leitura direta das colunas) ou .pdf (lido por IA).
                Pode selecionar mais de um arquivo (ex: uma planilha por ano).
                Uma linha/registro = uma sessão. Em planilhas, colunas reconhecidas: data, tipo, evolução/observações,
                habilidades trabalhadas, engajamento, autorregulação, nível de suporte, recursos, duração.
              </p>
            </div>
            {parsing && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando arquivo(s)...
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-lg">
            {arquivos.length > 0 && (
              <div className="px-3 py-2 border-b text-xs text-muted-foreground flex flex-wrap gap-1">
                Arquivos: {arquivos.map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
              </div>
            )}
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.every((r) => r._check)}
                      onCheckedChange={(v) => setRows((rr) => rr.map((r) => ({ ...r, _check: !!v })))}
                    />
                  </TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Engajamento</TableHead>
                  <TableHead>Autorreg.</TableHead>
                  <TableHead>Suporte</TableHead>
                  <TableHead>Habilidades</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <Fragment key={i}>
                    <TableRow>
                      <TableCell><Checkbox checked={r._check} onCheckedChange={(v) => updateRow(i, { _check: !!v })} /></TableCell>
                      <TableCell>
                        <button type="button" onClick={() => updateRow(i, { _expanded: !r._expanded })} className="text-muted-foreground hover:text-foreground">
                          {r._expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell><Input className="h-8 w-32" type="date" value={r.data_sessao} onChange={(e) => updateRow(i, { data_sessao: e.target.value })} /></TableCell>
                      <TableCell>
                        <Select value={r.tipo} onValueChange={(v) => updateRow(i, { tipo: v as Row["tipo"] })}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={r.engajamento ? String(r.engajamento) : ""} onValueChange={(v) => updateRow(i, { engajamento: v ? Number(v) : null })}>
                          <SelectTrigger className="h-8 w-16 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={r.autorregulacao ? String(r.autorregulacao) : ""} onValueChange={(v) => updateRow(i, { autorregulacao: v ? Number(v) : null })}>
                          <SelectTrigger className="h-8 w-16 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={r.nivel_suporte ?? ""} onValueChange={(v) => updateRow(i, { nivel_suporte: v })}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {NIVEIS_SUPORTE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-56">
                        {r.habilidades_trabalhadas.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.habilidades_trabalhadas.slice(0, 3).map((h, hi) => (
                              <Badge key={hi} variant="outline" className="text-[10px]">{h.habilidade}</Badge>
                            ))}
                            {r.habilidades_trabalhadas.length > 3 && (
                              <Badge variant="secondary" className="text-[10px]">+{r.habilidades_trabalhadas.length - 3}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => updateRow(i, { _expanded: !r._expanded })}>
                          {r._expanded ? "ocultar" : "ver/editar"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {r._expanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={9} className="p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Evolução / observações</Label>
                              <Textarea rows={3} value={r.evolucao ?? ""} onChange={(e) => updateRow(i, { evolucao: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Habilidades trabalhadas (separadas por vírgula)</Label>
                              <Textarea
                                rows={3}
                                value={r.habilidades_trabalhadas.map((h) => h.habilidade + (h.sub_habilidade ? ` - ${h.sub_habilidade}` : "")).join(", ")}
                                onChange={(e) => {
                                  const texto = e.target.value;
                                  const lista = texto.split(",").map((t) => t.trim()).filter(Boolean).map((t) => {
                                    const m = t.split(" - ");
                                    return m.length >= 2
                                      ? { habilidade: m[0].trim(), sub_habilidade: m.slice(1).join(" - ").trim() }
                                      : { habilidade: t, sub_habilidade: "" };
                                  });
                                  updateRow(i, { habilidades_trabalhadas: lista });
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Recursos utilizados (vírgula)</Label>
                              <Input className="h-8" value={r.recursos_utilizados ?? ""} onChange={(e) => updateRow(i, { recursos_utilizados: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Duração (min)</Label>
                              <Input className="h-8 w-24" type="number" value={r.duracao_min ?? ""} onChange={(e) => updateRow(i, { duracao_min: e.target.value ? Number(e.target.value) : null })} />
                            </div>
                          </div>
                          <div className="flex justify-end mt-2">
                            <Button
                              type="button" variant="ghost" size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setRows((rr) => rr.filter((_, idx) => idx !== i))}
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Remover esta linha
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <Button variant="ghost" onClick={() => { setRows([]); setArquivos([]); }}>Recomeçar</Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          {rows.length > 0 && (
            <Button
              onClick={() => importarMut.mutate()}
              disabled={importarMut.isPending}
              className="gradient-brand text-brand-foreground"
            >
              {importarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e importar {rows.filter((r) => r._check).length} sessões
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
