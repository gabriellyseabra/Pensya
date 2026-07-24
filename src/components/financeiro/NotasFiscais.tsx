import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaOrganizacao } from "@/lib/clinica-config";
import { gerarReciboPdf, type ReciboTipo } from "@/lib/recibo-documento";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Download, MessageCircle, FileSpreadsheet, Loader2, Copy, Ban, Trash2, FileText,
  CalendarPlus, FileDown,
} from "lucide-react";
import { toast } from "sonner";

/* ================================ tipos ================================ */

type DocFiscal = {
  id: string;
  tipo: string;
  status: string;
  paciente_id: string | null;
  tomador_nome: string | null;
  tomador_documento: string | null;
  competencia: string | null;
  data_documento: string;
  valor: number;
  descricao: string | null;
  numero: string | null;
  pdf_path: string | null;
  xml_path: string | null;
  visivel_portal: boolean;
  observacoes: string | null;
  paciente: {
    nome: string;
    telefone: string | null;
    responsaveis: { telefone: string | null; principal: boolean }[];
  } | null;
};

type PacienteSel = { id: string; nome: string; cpf: string | null };

const BUCKET = "pacientes-docs";

const TIPO_LABEL: Record<string, string> = {
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  recibo_saude: "Recibo de saúde",
};

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  emitida: { label: "Emitida", variant: "default" },
  gerado: { label: "Gerado", variant: "default" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

const BRL = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtCompetencia(c: string | null): string {
  if (!c) return "—";
  const m = c.match(/^(\d{4})-(\d{2})/);
  if (!m) return c;
  return `${m[2]}/${m[1]}`;
}

function randId() {
  return Math.random().toString(36).slice(2, 10);
}

/* ============================== componente ============================== */

export function NotasFiscais() {
  const qc = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroMes, setFiltroMes] = useState(""); // yyyy-MM
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [gerarMesOpen, setGerarMesOpen] = useState(false);
  const [emissaoDoc, setEmissaoDoc] = useState<DocFiscal | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  const { data: org } = useQuery({ queryKey: ["minha-organizacao"], queryFn: getMinhaOrganizacao });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentos-fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_fiscais")
        .select(
          "id, tipo, status, paciente_id, tomador_nome, tomador_documento, competencia, data_documento, valor, descricao, numero, pdf_path, xml_path, visivel_portal, observacoes, paciente:pacientes(nome, telefone, responsaveis(telefone, principal))",
        )
        .order("data_documento", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as DocFiscal[];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["sel-pacientes-fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
        .order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as PacienteSel[];
    },
  });

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return docs.filter((d) => {
      if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
      if (filtroMes) {
        const ref = (d.competencia ?? d.data_documento ?? "").slice(0, 7);
        if (ref !== filtroMes) return false;
      }
      if (b) {
        const nome = (d.paciente?.nome ?? d.tomador_nome ?? "").toLowerCase();
        if (!nome.includes(b)) return false;
      }
      return true;
    });
  }, [docs, filtroTipo, filtroStatus, filtroMes, busca]);

  const totalAEmitir = useMemo(
    () => docs.filter((d) => d.tipo === "nota_fiscal" && d.status === "pendente").reduce((s, d) => s + Number(d.valor), 0),
    [docs],
  );

  const issARecolher = useMemo(() => {
    const aliq = (org?.aliquota_iss ?? 0) / 100;
    const base = docs
      .filter((d) => {
        if (d.tipo !== "nota_fiscal" || d.status !== "emitida") return false;
        if (filtroMes) {
          const ref = (d.competencia ?? d.data_documento ?? "").slice(0, 7);
          if (ref !== filtroMes) return false;
        }
        return true;
      })
      .reduce((s, d) => s + Number(d.valor), 0);
    return base * aliq;
  }, [docs, filtroMes, org]);

  const toggleVisivel = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      const { error } = await supabase.from("documentos_fiscais").update({ visivel_portal: visivel }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documentos_fiscais").update({ status: "cancelada" }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Documento cancelado"); qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documentos_fiscais").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function baixar(doc: DocFiscal) {
    if (!doc.pdf_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.pdf_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link do arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function enviarWhatsApp(doc: DocFiscal) {
    if (!doc.pdf_path) return;
    const resp = doc.paciente?.responsaveis?.find((r) => r.principal) ?? doc.paciente?.responsaveis?.[0];
    const fone = (resp?.telefone ?? doc.paciente?.telefone ?? "").replace(/\D/g, "");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.pdf_path, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link do arquivo"); return; }
    const ref = doc.descricao?.trim() || fmtCompetencia(doc.competencia);
    const msg = `Olá! Segue o(a) ${TIPO_LABEL[doc.tipo] ?? "documento"} referente a ${ref} no valor de ${BRL(Number(doc.valor))}: ${data.signedUrl}`;
    if (fone) {
      window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(msg).then(
        () => toast.success("Sem telefone cadastrado — mensagem copiada!"),
        () => toast.info(msg),
      );
    }
  }

  async function gerarPdfRecibo(doc: DocFiscal) {
    setGerandoPdf(doc.id);
    try {
      const org = await getMinhaOrganizacao();
      const blob = await gerarReciboPdf({
        tipo: (doc.tipo === "recibo_saude" ? "recibo_saude" : "recibo") as ReciboTipo,
        pacienteNome: doc.paciente?.nome ?? null,
        tomadorNome: doc.tomador_nome ?? doc.paciente?.nome ?? "",
        tomadorDocumento: doc.tomador_documento ?? null,
        valor: Number(doc.valor),
        data: doc.data_documento,
        descricao: doc.descricao ?? null,
        org,
      });
      const path = `fiscais/${doc.paciente_id || "avulsa"}/${Date.now()}-${randId()}.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("documentos_fiscais").update({ pdf_path: path, status: "gerado" }).eq("id", doc.id);
      if (error) throw new Error(error.message);
      toast.success("PDF do recibo gerado");
      qc.invalidateQueries({ queryKey: ["documentos-fiscais"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    } finally {
      setGerandoPdf(null);
    }
  }

  function exportarCSV() {
    const cab = ["Tipo", "Paciente", "Tomador", "Competência", "Valor", "Status", "Número"];
    const linhas = filtrados.map((d) => [
      TIPO_LABEL[d.tipo] ?? d.tipo,
      d.paciente?.nome ?? "",
      d.tomador_nome ?? "",
      fmtCompetencia(d.competencia),
      Number(d.valor).toFixed(2),
      STATUS_META[d.status]?.label ?? d.status,
      d.numero ?? "",
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((l) => l.map(escape).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documentos-fiscais-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header + stat */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Card className="glass">
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/40 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a emitir (NF pendentes)</p>
                <p className="text-xl font-semibold leading-tight">{BRL(totalAEmitir)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow/40 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ISS a recolher (notas emitidas)</p>
                <p className="flex items-center gap-2 text-xl font-semibold leading-tight">
                  {BRL(issARecolher)}
                  <Badge variant="secondary" className="text-[10px]">pendente</Badge>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGerarMesOpen(true)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" />Gerar do mês
          </Button>
          <Button variant="outline" onClick={exportarCSV}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />Exportar CSV
          </Button>
          <Button onClick={() => setNovoOpen(true)} className="gradient-brand text-brand-foreground">
            <Plus className="mr-1.5 h-4 w-4" />Novo documento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="nota_fiscal">Nota fiscal</SelectItem>
            <SelectItem value="recibo">Recibo</SelectItem>
            <SelectItem value="recibo_saude">Recibo de saúde</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="gerado">Gerado</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-40" />
        <Input placeholder="Buscar por paciente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" />
      </div>

      {/* Tabela */}
      <Card className="glass">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Paciente / Tomador</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Nenhum documento fiscal.</TableCell></TableRow>
              )}
              {filtrados.map((d) => {
                const st = STATUS_META[d.status] ?? { label: d.status, variant: "outline" as const };
                return (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">{d.data_documento ? format(parseISO(d.data_documento), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{TIPO_LABEL[d.tipo] ?? d.tipo}</Badge></TableCell>
                    <TableCell>
                      <p className="text-sm">{d.paciente?.nome ?? d.tomador_nome ?? "—"}</p>
                      {d.tomador_nome && d.paciente?.nome && d.tomador_nome !== d.paciente.nome && (
                        <p className="text-xs text-muted-foreground">{d.tomador_nome}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtCompetencia(d.competencia)}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge>{d.numero ? <span className="ml-1 text-xs text-muted-foreground">nº {d.numero}</span> : null}</TableCell>
                    <TableCell className="text-right font-medium">{BRL(Number(d.valor))}</TableCell>
                    <TableCell>
                      {d.pdf_path ? (
                        <Switch
                          checked={d.visivel_portal}
                          onCheckedChange={(v) => toggleVisivel.mutate({ id: d.id, visivel: v })}
                          aria-label="Visível no portal"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {d.tipo === "nota_fiscal" && d.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => setEmissaoDoc(d)}>Emissão</Button>
                        )}
                        {(d.tipo === "recibo" || d.tipo === "recibo_saude") && !d.pdf_path && d.status !== "cancelada" && (
                          <Button size="sm" variant="outline" disabled={gerandoPdf === d.id} onClick={() => gerarPdfRecibo(d)}>
                            {gerandoPdf === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="mr-1 h-4 w-4" />Gerar PDF</>}
                          </Button>
                        )}
                        {d.pdf_path && (
                          <>
                            <Button size="icon" variant="ghost" title="Baixar" onClick={() => baixar(d)}><Download className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Enviar por WhatsApp" onClick={() => enviarWhatsApp(d)}><MessageCircle className="h-4 w-4" /></Button>
                          </>
                        )}
                        {d.status !== "cancelada" && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => { if (confirm("Cancelar este documento?")) cancelar.mutate(d.id); }}><Ban className="h-4 w-4" /></Button>
                        )}
                        <Button size="icon" variant="ghost" title="Excluir" onClick={() => { if (confirm("Excluir definitivamente?")) excluir.mutate(d.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NovoDocumentoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        pacientes={pacientes}
        discriminacaoPadrao={org?.discriminacao_padrao ?? ""}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }); setNovoOpen(false); }}
      />

      <GerarMesDialog
        open={gerarMesOpen}
        onOpenChange={setGerarMesOpen}
        discriminacaoPadrao={org?.discriminacao_padrao ?? ""}
        onDone={() => { qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }); setGerarMesOpen(false); }}
      />

      <DadosEmissaoDialog
        doc={emissaoDoc}
        org={org ?? null}
        onOpenChange={(o) => { if (!o) setEmissaoDoc(null); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["documentos-fiscais"] }); setEmissaoDoc(null); }}
      />
    </div>
  );
}

/* ======================== Gerar documentos do mês ======================== */

function GerarMesDialog({
  open, onOpenChange, discriminacaoPadrao, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  discriminacaoPadrao: string;
  onDone: () => void;
}) {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [gerando, setGerando] = useState(false);

  function handleOpenChange(o: boolean) {
    if (o) setCompetencia(format(new Date(), "yyyy-MM"));
    onOpenChange(o);
  }

  async function gerar() {
    const m = competencia.match(/^(\d{4})-(\d{2})$/);
    if (!m) { toast.error("Selecione uma competência válida"); return; }
    setGerando(true);
    try {
      const ano = Number(m[1]);
      const mes = Number(m[2]);
      const firstDay = `${m[1]}-${m[2]}-01`;
      const lastDayNum = new Date(ano, mes, 0).getDate();
      const lastDay = `${m[1]}-${m[2]}-${String(lastDayNum).padStart(2, "0")}`;
      const hoje = format(new Date(), "yyyy-MM-dd");

      const { data: pags, error } = await supabase
        .from("pagamentos")
        .select("id, paciente_id, valor, competencia, paciente:pacientes(id, nome, cpf, emite_nota)")
        .eq("status", "pago")
        .is("documento_fiscal_id", null)
        .gte("competencia", firstDay)
        .lte("competencia", lastDay);
      if (error) throw new Error(error.message);

      const rows = (pags ?? []) as any[];
      if (rows.length === 0) {
        toast.info("Nenhuma receita paga sem documento neste mês.");
        onDone();
        return;
      }

      // Agrupa por paciente
      const grupos = new Map<string, { paciente: any; ids: string[]; total: number }>();
      for (const r of rows) {
        const pid = r.paciente_id as string;
        const g = grupos.get(pid) ?? { paciente: r.paciente, ids: [], total: 0 };
        g.ids.push(r.id);
        g.total += Number(r.valor);
        grupos.set(pid, g);
      }

      let notas = 0;
      let recibos = 0;
      const descricaoPadrao = discriminacaoPadrao?.trim() || "Serviços de acompanhamento psicopedagógico";

      for (const g of grupos.values()) {
        if (g.total <= 0 || !g.paciente) continue;
        const tipo = g.paciente.emite_nota ? "nota_fiscal" : "recibo";
        const { data: novo, error: insErr } = await supabase
          .from("documentos_fiscais")
          .insert({
            tipo,
            paciente_id: g.paciente.id,
            tomador_nome: g.paciente.nome,
            tomador_documento: g.paciente.cpf ?? null,
            competencia: firstDay,
            data_documento: hoje,
            valor: g.total,
            descricao: descricaoPadrao,
            status: "pendente",
            visivel_portal: true,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);

        const { error: updErr } = await supabase
          .from("pagamentos")
          .update({ documento_fiscal_id: novo.id })
          .in("id", g.ids);
        if (updErr) throw new Error(updErr.message);

        if (tipo === "nota_fiscal") notas++;
        else recibos++;
      }

      const total = notas + recibos;
      if (total === 0) {
        toast.info("Nenhuma receita paga sem documento neste mês.");
      } else {
        toast.success(`${total} documentos gerados (${notas} notas, ${recibos} recibos)`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar documentos");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-strong max-w-sm">
        <DialogHeader><DialogTitle>Gerar documentos do mês</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Competência</Label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Cria um documento por paciente somando as receitas pagas da competência que ainda não têm documento.
            Pacientes que emitem nota geram uma NF pendente; os demais, um recibo (gere o PDF depois na lista).
          </p>
        </div>
        <DialogFooter>
          <Button onClick={gerar} disabled={gerando} className="gradient-brand text-brand-foreground">
            {gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar documentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Novo documento ============================ */

function NovoDocumentoDialog({
  open, onOpenChange, pacientes, discriminacaoPadrao, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pacientes: PacienteSel[];
  discriminacaoPadrao: string;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<string>("nota_fiscal");
  const [semTomador, setSemTomador] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [tomadorNome, setTomadorNome] = useState("");
  const [tomadorDoc, setTomadorDoc] = useState("");
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [dataDoc, setDataDoc] = useState(format(new Date(), "yyyy-MM-dd"));
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState(discriminacaoPadrao);
  const [saving, setSaving] = useState(false);

  // Reseta ao abrir
  function handleOpenChange(o: boolean) {
    if (o) {
      setTipo("nota_fiscal");
      setSemTomador(false);
      setPacienteId("");
      setTomadorNome("");
      setTomadorDoc("");
      setCompetencia(format(new Date(), "yyyy-MM"));
      setDataDoc(format(new Date(), "yyyy-MM-dd"));
      setValor("");
      setDescricao(discriminacaoPadrao);
    }
    onOpenChange(o);
  }

  function selecionarPaciente(id: string) {
    setPacienteId(id);
    const p = pacientes.find((x) => x.id === id);
    if (p) {
      setTomadorNome(p.nome);
      if (p.cpf) setTomadorDoc(p.cpf);
    }
  }

  async function salvar() {
    if (!tomadorNome.trim()) { toast.error("Informe o tomador"); return; }
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) { toast.error("Informe um valor válido"); return; }
    setSaving(true);
    try {
      const competenciaDate = competencia ? `${competencia}-01` : null;
      const base = {
        tipo,
        paciente_id: semTomador ? null : (pacienteId || null),
        tomador_nome: tomadorNome.trim(),
        tomador_documento: tomadorDoc.trim() || null,
        competencia: competenciaDate,
        data_documento: dataDoc,
        valor: valorNum,
        descricao: descricao.trim() || null,
      };

      if (tipo === "recibo" || tipo === "recibo_saude") {
        const org = await getMinhaOrganizacao();
        const paciente = pacientes.find((p) => p.id === pacienteId);
        const blob = await gerarReciboPdf({
          tipo: tipo as ReciboTipo,
          pacienteNome: paciente?.nome ?? null,
          tomadorNome: tomadorNome.trim(),
          tomadorDocumento: tomadorDoc.trim() || null,
          valor: valorNum,
          data: dataDoc,
          descricao: descricao.trim() || null,
          org,
        });
        const path = `fiscais/${pacienteId || "avulsa"}/${Date.now()}-${randId()}.pdf`;
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (up.error) throw new Error(up.error.message);
        const { error } = await supabase.from("documentos_fiscais").insert({
          ...base,
          status: "gerado",
          pdf_path: path,
          visivel_portal: true,
        });
        if (error) throw new Error(error.message);
        toast.success("Recibo gerado");
      } else {
        const { error } = await supabase.from("documentos_fiscais").insert({ ...base, status: "pendente" });
        if (error) throw new Error(error.message);
        toast.success("Documento registrado");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const ehRecibo = tipo === "recibo" || tipo === "recibo_saude";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo documento fiscal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nota_fiscal">Nota fiscal</SelectItem>
                <SelectItem value="recibo">Recibo</SelectItem>
                <SelectItem value="recibo_saude">Recibo de saúde</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={semTomador}
              onCheckedChange={(v) => {
                const on = v === true;
                setSemTomador(on);
                if (on) {
                  setPacienteId("");
                  setTomadorNome("Consumidor não identificado");
                  setTomadorDoc("");
                } else {
                  setTomadorNome("");
                }
              }}
            />
            Sem tomador identificado (nota com valor total)
          </label>
          {!semTomador && (
            <div>
              <Label>Paciente / Tomador</Label>
              <Select value={pacienteId || "__none"} onValueChange={(v) => selecionarPaciente(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Avulso (sem paciente)</SelectItem>
                  {pacientes.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do tomador</Label>
              <Input value={tomadorNome} onChange={(e) => setTomadorNome(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <Label>CPF/CNPJ do tomador</Label>
              <Input value={tomadorDoc} onChange={(e) => setTomadorDoc(e.target.value)} placeholder="Documento" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição do serviço</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          {ehRecibo && (
            <p className="text-xs text-muted-foreground">Ao salvar, o PDF do recibo é gerado e fica disponível para download e envio.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ehRecibo ? "Gerar recibo" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================= Dados para emissão (NF) ========================= */

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm truncate">{value || "—"}</p>
      </div>
      {value && (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copiado"))}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function DadosEmissaoDialog({
  doc, org, onOpenChange, onSaved,
}: {
  doc: DocFiscal | null;
  org: Awaited<ReturnType<typeof getMinhaOrganizacao>> | null;
  onOpenChange: (b: boolean) => void;
  onSaved: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicia quando muda o documento alvo
  const docId = doc?.id ?? "";
  useEffect(() => {
    setNumero(doc?.numero ?? "");
    setDataEmissao(doc?.data_documento ?? format(new Date(), "yyyy-MM-dd"));
    setPdfFile(null);
    setXmlFile(null);
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function registrar() {
    if (!doc) return;
    setSaving(true);
    try {
      const update: Record<string, unknown> = {
        status: "emitida",
        numero: numero.trim() || null,
        data_documento: dataEmissao,
      };
      if (pdfFile) {
        const path = `fiscais/${doc.paciente_id || "avulsa"}/${Date.now()}-${randId()}.pdf`;
        const up = await supabase.storage.from(BUCKET).upload(path, pdfFile, { contentType: "application/pdf", upsert: false });
        if (up.error) throw new Error(up.error.message);
        update.pdf_path = path;
      }
      if (xmlFile) {
        const path = `fiscais/${doc.paciente_id || "avulsa"}/${Date.now()}-${randId()}.xml`;
        const up = await supabase.storage.from(BUCKET).upload(path, xmlFile, { contentType: "text/xml", upsert: false });
        if (up.error) throw new Error(up.error.message);
        update.xml_path = path;
      }
      const { error } = await supabase.from("documentos_fiscais").update(update).eq("id", doc.id);
      if (error) throw new Error(error.message);
      toast.success("Emissão registrada");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar emissão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dados para emissão da NF</DialogTitle></DialogHeader>
        {doc && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Prestador</p>
              <CopyRow label="Razão social" value={org?.razao_social ?? org?.nome ?? ""} />
              <CopyRow label="CNPJ" value={org?.cnpj ?? ""} />
              <CopyRow label="Inscrição municipal" value={org?.inscricao_municipal ?? ""} />
              <CopyRow label="Código do serviço" value={org?.codigo_servico_municipal ?? ""} />
              <CopyRow label="Alíquota ISS" value={org?.aliquota_iss != null ? `${org.aliquota_iss}%` : ""} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tomador</p>
              <CopyRow label="Nome" value={doc.tomador_nome ?? doc.paciente?.nome ?? ""} />
              <CopyRow label="CPF/CNPJ" value={doc.tomador_documento ?? ""} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Serviço</p>
              <CopyRow label="Discriminação" value={doc.descricao ?? ""} />
              <CopyRow label="Valor" value={BRL(Number(doc.valor))} />
              <CopyRow
                label={`ISS (${org?.aliquota_iss ?? 0}%)`}
                value={BRL(Number(doc.valor) * ((org?.aliquota_iss ?? 0) / 100))}
              />
            </div>

            <div className="rounded-lg border border-border/40 p-3 space-y-2">
              <p className="text-sm font-medium">Registrar emissão</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Número da NF</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº" />
                </div>
                <div>
                  <Label>Data de emissão</Label>
                  <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>PDF da nota</Label>
                <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
              </div>
              <div>
                <Label>XML (opcional)</Label>
                <Input type="file" accept="text/xml,application/xml,.xml" onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={registrar} disabled={saving} className="gradient-brand text-brand-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar emissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
