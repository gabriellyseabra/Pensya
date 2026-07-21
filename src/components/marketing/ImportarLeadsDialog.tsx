import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, Save } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { invalidarMarketing } from "@/lib/marketing-cache";

type Linha = {
  aplicar: boolean;
  nome: string;
  telefone: string;
  email: string;
  canal: string;
  campanha: string;
  origem_detalhe: string;
  indicador_nome: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  observacoes: string;
  erro?: string;
};

function normalizarHeader(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function indice(header: string[], padrao: RegExp) {
  return header.findIndex((h) => padrao.test(h));
}

function valorLinha(r: unknown[], pos?: number) {
  if (pos === undefined || pos < 0) return "";
  return String(r[pos] ?? "").trim();
}

function processarMatriz(matriz: unknown[][]): Linha[] {
  if (!matriz.length) return [];
  const header = matriz[0].map(normalizarHeader);
  const idx = {
    nome: indice(header, /^(nome|nome completo|contato|cliente|responsavel|lead)$/),
    tel: indice(header, /tel|whats|celular|fone|telefone/),
    email: indice(header, /email|e-mail/),
    canal: indice(header, /^(canal|origem|fonte|utm_source|source)$/),
    campanha: indice(header, /^(campanha|campaign|utm_campaign|utm campanha)$/),
    origem_detalhe: indice(
      header,
      /^(origem detalhe|origem_detalhe|detalhe origem|detalhe da origem|escola|parceiro|parceria|quem indicou|indicacao|indicacao por|indicado por)$/,
    ),
    indicador_nome: indice(
      header,
      /^(indicador|indicador nome|indicador_nome|quem indicou|indicado por|indicacao|indicação|nome indicador|nome de quem indicou)$/,
    ),
    utm_source: indice(header, /^(utm_source|utm source)$/),
    utm_medium: indice(header, /^(utm_medium|utm medium)$/),
    utm_campaign: indice(header, /^(utm_campaign|utm campaign)$/),
    observacoes: indice(
      header,
      /observacao|observacoes|observação|observações|obs|nota|comentario|comentario/,
    ),
  };
  const temHeader = idx.nome >= 0;
  const body = temHeader ? matriz.slice(1) : matriz;
  const map = temHeader
    ? idx
    : {
        nome: 0,
        tel: 1,
        email: 2,
        canal: 3,
        campanha: 4,
        origem_detalhe: 5,
        indicador_nome: 6,
        utm_source: -1,
        utm_medium: -1,
        utm_campaign: -1,
        observacoes: 7,
      };

  return body
    .filter((r) => r.some((c: unknown) => c !== null && c !== undefined && String(c).trim() !== ""))
    .map((r) => {
      const nome = valorLinha(r, map.nome);
      const campanha = valorLinha(r, map.campanha) || valorLinha(r, map.utm_campaign);
      const canal = valorLinha(r, map.canal) || valorLinha(r, map.utm_source);
      return {
        aplicar: !!nome,
        nome,
        telefone: valorLinha(r, map.tel),
        email: valorLinha(r, map.email),
        canal,
        campanha,
        origem_detalhe: valorLinha(r, map.origem_detalhe),
        indicador_nome: valorLinha(r, map.indicador_nome),
        utm_source: valorLinha(r, map.utm_source) || canal,
        utm_medium: valorLinha(r, map.utm_medium),
        utm_campaign: valorLinha(r, map.utm_campaign) || campanha,
        observacoes: valorLinha(r, map.observacoes),
        erro: nome ? undefined : "nome vazio",
      };
    });
}

export function ImportarLeadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);

  function aplicar(matriz: unknown[][]) {
    const out = processarMatriz(matriz);
    setLinhas(out);
    toast.success(`${out.length} linha(s) detectadas — revise antes de importar`);
  }

  function processarTexto() {
    aplicar(
      texto
        .trim()
        .split(/\r?\n/)
        .map((l) => l.split(/\t|;|,/)),
    );
  }

  async function processarArquivo(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    aplicar(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }));
  }

  async function salvar() {
    const sel = linhas.filter((l) => l.aplicar && !l.erro);
    if (!sel.length) {
      toast.error("Nada selecionado");
      return;
    }
    setSaving(true);
    try {
      const { data: etapaInicial } = await supabase
        .from("pipeline_etapas")
        .select("id")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!etapaInicial) throw new Error("Nenhuma etapa de funil configurada");

      const { data: canaisExistentes } = await supabase.from("canais_marketing").select("id, nome");
      const canalPorNome = new Map(
        (canaisExistentes ?? []).map((c) => [c.nome.toLowerCase(), c.id]),
      );
      const nomesFaltando = [
        ...new Set(sel.map((l) => l.canal).filter((c) => c && !canalPorNome.has(c.toLowerCase()))),
      ];
      if (nomesFaltando.length) {
        const { data: novos } = await supabase
          .from("canais_marketing")
          .insert(nomesFaltando.map((nome) => ({ nome })))
          .select("id, nome");
        (novos ?? []).forEach((c) => canalPorNome.set(c.nome.toLowerCase(), c.id));
      }

      const { data: campanhasExistentes } = await supabase.from("campanhas").select("id, nome");
      const campanhaPorNome = new Map(
        (campanhasExistentes ?? []).map((c) => [c.nome.toLowerCase(), c.id]),
      );
      const campanhasFaltando = [
        ...new Set(
          sel.map((l) => l.campanha).filter((c) => c && !campanhaPorNome.has(c.toLowerCase())),
        ),
      ];
      if (campanhasFaltando.length) {
        const { data: novas } = await supabase
          .from("campanhas")
          .insert(
            campanhasFaltando.map((nome) => {
              const primeiraLinha = sel.find(
                (l) => l.campanha.toLowerCase() === nome.toLowerCase(),
              );
              return {
                nome,
                canal_id: primeiraLinha?.canal
                  ? (canalPorNome.get(primeiraLinha.canal.toLowerCase()) ?? null)
                  : null,
                status: "ativa",
              };
            }),
          )
          .select("id, nome");
        (novas ?? []).forEach((c) => campanhaPorNome.set(c.nome.toLowerCase(), c.id));
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const inserts = sel.map((l) => ({
        nome: l.nome,
        telefone: l.telefone || null,
        email: l.email || null,
        canal_id: l.canal ? (canalPorNome.get(l.canal.toLowerCase()) ?? null) : null,
        campanha_id: l.campanha ? (campanhaPorNome.get(l.campanha.toLowerCase()) ?? null) : null,
        origem_detalhe: l.origem_detalhe || null,
        indicador_nome: l.indicador_nome || null,
        utm_source: l.utm_source || null,
        utm_medium: l.utm_medium || null,
        utm_campaign: l.utm_campaign || null,
        observacoes: l.observacoes || null,
        etapa_id: etapaInicial.id,
        created_by: user?.id ?? null,
      }));
      for (let i = 0; i < inserts.length; i += 200) {
        const { error } = await supabase.from("leads").insert(inserts.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`${inserts.length} lead(s) importado(s)`);
      setLinhas([]);
      setTexto("");
      invalidarMarketing(qc);
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar leads em massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Upload XLSX/CSV</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processarArquivo(f);
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Colunas detectadas: nome, telefone, email, canal/origem, campanha/utm_campaign,
                indicação/quem indicou, escola/parceiro e observação.
              </p>
            </div>
            <div>
              <Label className="text-xs">Ou cole (TSV/CSV)</Label>
              <Textarea
                rows={4}
                placeholder="nome;telefone;email;canal;campanha;origem_detalhe;indicador_nome;observacoes"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-1"
                onClick={processarTexto}
                disabled={!texto.trim()}
              >
                <Upload className="w-3 h-3 mr-1" />
                Processar texto
              </Button>
            </div>
          </div>

          {linhas.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {linhas.filter((l) => l.aplicar && !l.erro).length} de {linhas.length} prontos
                  para importar
                </div>
                <Button onClick={salvar} disabled={saving} className="gradient-brand text-white">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Importar selecionados
                </Button>
              </div>
              <div className="overflow-x-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Origem detalhe</TableHead>
                      <TableHead>Indicador</TableHead>
                      <TableHead>UTM source</TableHead>
                      <TableHead>UTM medium</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={i} className={l.erro ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={l.aplicar}
                            disabled={!!l.erro}
                            onCheckedChange={(v) => {
                              const n = [...linhas];
                              n[i].aplicar = !!v;
                              setLinhas(n);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{l.nome}</TableCell>
                        <TableCell className="text-xs">{l.telefone}</TableCell>
                        <TableCell className="text-xs">{l.email}</TableCell>
                        <TableCell className="text-xs">{l.canal}</TableCell>
                        <TableCell className="text-xs">{l.campanha}</TableCell>
                        <TableCell className="text-xs">{l.origem_detalhe}</TableCell>
                        <TableCell className="text-xs">{l.indicador_nome}</TableCell>
                        <TableCell className="text-xs">{l.utm_source}</TableCell>
                        <TableCell className="text-xs">{l.utm_medium}</TableCell>
                        <TableCell className="text-xs">{l.observacoes}</TableCell>
                        <TableCell className="text-xs text-destructive">{l.erro}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
