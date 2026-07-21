import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, FileText, Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { importarProntuario } from "@/lib/importar-prontuario.functions";
import { usePerfilVivo } from "@/hooks/use-perfil-vivo";

type Extraido = {
  dados_pessoais?: Record<string, any>;
  responsaveis?: any[];
  pre_anamnese?: Record<string, any>;
  hipoteses?: string[];
  diagnosticos?: string[];
  perfil_vivo?: any;
  resumo?: string;
};

const CAMPOS_PAC = [
  "nome","data_nascimento","genero","documento","cpf","telefone","email","endereco",
  "escolaridade","serie_curso","contato_escola","queixa_principal","expectativas","observacoes"
];
const CAMPOS_PRE = ["gestacao","parto","saude","contexto_familiar","tratamentos_anteriores","outros_especialistas","exames_clinicos"];

function googleSheetsCsvUrl(url: string): string | null {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gidM = url.match(/[?#&]gid=(\d+)/);
  const gid = gidM ? gidM[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

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

async function planilhaParaTexto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const partes: string[] = [];
  for (const name of wb.SheetNames) {
    partes.push(`=== Aba: ${name} ===`);
    partes.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
  }
  return partes.join("\n");
}

export function ImportarProntuarioTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const importar = useServerFn(importarProntuario);
  const { merge: mergePerfil } = usePerfilVivo(pacienteId);

  const [loading, setLoading] = useState(false);
  const [extraido, setExtraido] = useState<Extraido | null>(null);
  const [aplicar, setAplicar] = useState<Record<string, boolean>>({});
  const [editado, setEditado] = useState<Extraido>({});
  const [arquivoMeta, setArquivoMeta] = useState<{ nome: string; tipo: string; tamanho: number } | null>(null);
  const [urlSheets, setUrlSheets] = useState("");

  function inicializarPreview(e: Extraido) {
    setExtraido(e);
    setEditado(JSON.parse(JSON.stringify(e)));
    const flags: Record<string, boolean> = {};
    CAMPOS_PAC.forEach(c => { if (e.dados_pessoais?.[c]) flags[`pac.${c}`] = true; });
    CAMPOS_PRE.forEach(c => { if (e.pre_anamnese?.[c]) flags[`pre.${c}`] = true; });
    (e.responsaveis ?? []).forEach((_, i) => { flags[`resp.${i}`] = true; });
    (e.hipoteses ?? []).forEach((_, i) => { flags[`hip.${i}`] = true; });
    (e.diagnosticos ?? []).forEach((_, i) => { flags[`diag.${i}`] = true; });
    flags["perfil_vivo"] = !!e.perfil_vivo;
    setAplicar(flags);
  }

  async function processarPdf(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("PDF máx 20MB"); return; }
    setLoading(true);
    setArquivoMeta({ nome: file.name, tipo: file.type, tamanho: file.size });
    try {
      const b64 = await fileToBase64(file);
      const path = `pacientes/${pacienteId}/importacoes/${Date.now()}-${file.name}`;
      await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type, upsert: false });
      await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId, titulo: `Importação: ${file.name}`, categoria: "Importação",
        storage_path: path, mime_type: file.type, tamanho_bytes: file.size,
      });
      const { extraido } = await importar({ data: { paciente_id: pacienteId, modo: "pdf", pdf_base64: b64, pdf_mime: file.type, filename: file.name } });
      inicializarPreview(extraido);
      toast.success("Documento lido — revise antes de aplicar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar");
    } finally { setLoading(false); }
  }

  async function processarPlanilha(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error("Planilha máx 10MB"); return; }
    setLoading(true);
    setArquivoMeta({ nome: file.name, tipo: file.type, tamanho: file.size });
    try {
      const texto = await planilhaParaTexto(file);
      const path = `pacientes/${pacienteId}/importacoes/${Date.now()}-${file.name}`;
      await supabase.storage.from("pacientes-docs").upload(path, file, { contentType: file.type, upsert: false });
      await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId, titulo: `Importação: ${file.name}`, categoria: "Importação",
        storage_path: path, mime_type: file.type, tamanho_bytes: file.size,
      });
      const { extraido } = await importar({ data: { paciente_id: pacienteId, modo: "planilha", texto, filename: file.name } });
      inicializarPreview(extraido);
      toast.success("Planilha lida — revise antes de aplicar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar");
    } finally { setLoading(false); }
  }

  async function processarUrlSheets() {
    const csv = googleSheetsCsvUrl(urlSheets.trim());
    if (!csv) { toast.error("URL do Google Planilhas inválida. Garanta que está pública."); return; }
    setLoading(true);
    try {
      const res = await fetch(csv);
      if (!res.ok) throw new Error("Não foi possível baixar (a planilha precisa estar pública — Compartilhar > Qualquer pessoa com o link)");
      const texto = await res.text();
      const { extraido } = await importar({ data: { paciente_id: pacienteId, modo: "planilha", texto, filename: "google-sheets.csv" } });
      inicializarPreview(extraido);
      toast.success("Google Planilhas lida — revise antes de aplicar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar");
    } finally { setLoading(false); }
  }

  async function aplicarMudancas() {
    if (!editado) return;
    setLoading(true);
    try {
      // 1) pacientes
      const pacPayload: Record<string, any> = {};
      CAMPOS_PAC.forEach(c => {
        if (aplicar[`pac.${c}`] && editado.dados_pessoais?.[c]) pacPayload[c] = editado.dados_pessoais[c];
      });
      if (Object.keys(pacPayload).length) {
        const { error } = await supabase.from("pacientes").update(pacPayload as any).eq("id", pacienteId);
        if (error) throw error;
      }

      // 2) pre_anamnese (upsert)
      const prePayload: Record<string, any> = { paciente_id: pacienteId };
      let preTem = false;
      CAMPOS_PRE.forEach(c => {
        if (aplicar[`pre.${c}`] && editado.pre_anamnese?.[c]) { prePayload[c] = editado.pre_anamnese[c]; preTem = true; }
      });
      if (preTem) {
        const { data: existente } = await supabase.from("paciente_pre_anamnese").select("id").eq("paciente_id", pacienteId).maybeSingle();
        if (existente?.id) {
          await supabase.from("paciente_pre_anamnese").update(prePayload as any).eq("id", existente.id);
        } else {
          await supabase.from("paciente_pre_anamnese").insert(prePayload as any);
        }
      }

      // 3) responsáveis (dedup por nome+parentesco)
      const respsNovos = (editado.responsaveis ?? []).filter((_, i) => aplicar[`resp.${i}`]);
      if (respsNovos.length) {
        const { data: existentes } = await supabase.from("responsaveis").select("nome, parentesco").eq("paciente_id", pacienteId);
        const chaveExist = new Set((existentes ?? []).map((r: any) => `${(r.nome ?? "").toLowerCase()}|${(r.parentesco ?? "").toLowerCase()}`));
        const inserir = respsNovos
          .filter(r => r.nome && !chaveExist.has(`${r.nome.toLowerCase()}|${(r.parentesco ?? "").toLowerCase()}`))
          .map(r => ({ paciente_id: pacienteId, nome: r.nome, parentesco: r.parentesco, profissao: r.profissao, telefone: r.telefone, email: r.email, idade: r.idade ? Number(r.idade) : null, estado_civil: r.estado_civil }));
        if (inserir.length) {
          const { error } = await supabase.from("responsaveis").insert(inserir);
          if (error) throw error;
        }
      }

      // 4) perfil_vivo (merge)
      if (aplicar["perfil_vivo"] && editado.perfil_vivo) {
        await mergePerfil.mutateAsync(editado.perfil_vivo);
      }

      // 5) Hipóteses → append em observacoes da paciente
      const hipotesesSel = (editado.hipoteses ?? []).filter((_, i) => aplicar[`hip.${i}`]);
      const diagsSel = (editado.diagnosticos ?? []).filter((_, i) => aplicar[`diag.${i}`]);
      if (hipotesesSel.length || diagsSel.length) {
        const { data: p } = await supabase.from("pacientes").select("observacoes, hipotese_diagnostica").eq("id", pacienteId).maybeSingle();
        const linhas: string[] = [];
        if (hipotesesSel.length) linhas.push(`Hipóteses identificadas: ${hipotesesSel.join("; ")}`);
        if (diagsSel.length) linhas.push(`Diagnósticos referidos: ${diagsSel.join("; ")}`);
        const obs = [p?.observacoes, ...linhas].filter(Boolean).join("\n");
        await supabase.from("pacientes").update({ observacoes: obs, hipotese_diagnostica: hipotesesSel.length ? true : p?.hipotese_diagnostica }).eq("id", pacienteId);
      }

      toast.success("Dados aplicados ao prontuário");
      qc.invalidateQueries({ queryKey: ["paciente", pacienteId] });
      qc.invalidateQueries({ queryKey: ["paciente-pre-anamnese", pacienteId] });
      qc.invalidateQueries({ queryKey: ["paciente-perfil-vivo", pacienteId] });
      setExtraido(null);
    } catch (e: any) {
      toast.error("Erro ao aplicar: " + (e?.message ?? e));
    } finally { setLoading(false); }
  }

  if (!extraido) {
    return (
      <div className="space-y-4">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Importar prontuário com IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envie um PDF, planilha (XLSX/CSV) ou link público do Google Planilhas. A IA lê o conteúdo, extrai os campos relevantes
              e mostra um <strong>preview editável</strong> antes de gravar no prontuário.
            </p>
            <Tabs defaultValue="pdf">
              <TabsList>
                <TabsTrigger value="pdf"><FileText className="w-4 h-4 mr-2" />PDF</TabsTrigger>
                <TabsTrigger value="planilha"><FileSpreadsheet className="w-4 h-4 mr-2" />Planilha</TabsTrigger>
                <TabsTrigger value="sheets">Google Planilhas (URL)</TabsTrigger>
              </TabsList>

              <TabsContent value="pdf" className="pt-4">
                <Label className="text-xs">Arquivo PDF (até 20MB)</Label>
                <Input type="file" accept="application/pdf" disabled={loading} onChange={(e) => { const f = e.target.files?.[0]; if (f) processarPdf(f); }} />
              </TabsContent>

              <TabsContent value="planilha" className="pt-4">
                <Label className="text-xs">Arquivo XLSX, XLS ou CSV (até 10MB)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv,text/csv" disabled={loading} onChange={(e) => { const f = e.target.files?.[0]; if (f) processarPlanilha(f); }} />
              </TabsContent>

              <TabsContent value="sheets" className="pt-4 space-y-2">
                <Label className="text-xs">URL pública do Google Planilhas</Label>
                <div className="flex gap-2">
                  <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={urlSheets} onChange={(e) => setUrlSheets(e.target.value)} disabled={loading} />
                  <Button onClick={processarUrlSheets} disabled={loading || !urlSheets.trim()}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    Importar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">A planilha precisa estar com Compartilhar &gt; "Qualquer pessoa com o link".</p>
              </TabsContent>
            </Tabs>

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Processando documento com IA…
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // PREVIEW
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Preview — revisar e aplicar</CardTitle>
              {arquivoMeta && <p className="text-xs text-muted-foreground mt-1">{arquivoMeta.nome}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExtraido(null)} disabled={loading}>Descartar</Button>
              <Button size="sm" onClick={aplicarMudancas} disabled={loading} className="gradient-brand text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Aplicar selecionados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editado.resumo && <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{editado.resumo}</p>}

          {/* Dados pessoais */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Dados pessoais</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {CAMPOS_PAC.map(c => {
                const v = editado.dados_pessoais?.[c];
                if (v == null || v === "") return null;
                return (
                  <div key={c} className="flex items-start gap-2 p-2 rounded border bg-card/50">
                    <Checkbox checked={!!aplicar[`pac.${c}`]} onCheckedChange={(v) => setAplicar({ ...aplicar, [`pac.${c}`]: !!v })} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <Label className="text-[11px] uppercase text-muted-foreground">{c.replaceAll("_", " ")}</Label>
                      <Input
                        value={editado.dados_pessoais?.[c] ?? ""}
                        onChange={(e) => setEditado({ ...editado, dados_pessoais: { ...editado.dados_pessoais, [c]: e.target.value } })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Responsáveis */}
          {(editado.responsaveis ?? []).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Responsáveis ({editado.responsaveis!.length})</h3>
              <div className="space-y-2">
                {editado.responsaveis!.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded border bg-card/50">
                    <Checkbox checked={!!aplicar[`resp.${i}`]} onCheckedChange={(v) => setAplicar({ ...aplicar, [`resp.${i}`]: !!v })} className="mt-1" />
                    <div className="flex-1 grid sm:grid-cols-2 gap-2">
                      <Input value={r.nome ?? ""} placeholder="Nome" onChange={(e) => { const arr = [...editado.responsaveis!]; arr[i] = { ...arr[i], nome: e.target.value }; setEditado({ ...editado, responsaveis: arr }); }} className="h-8 text-sm" />
                      <Input value={r.parentesco ?? ""} placeholder="Parentesco" onChange={(e) => { const arr = [...editado.responsaveis!]; arr[i] = { ...arr[i], parentesco: e.target.value }; setEditado({ ...editado, responsaveis: arr }); }} className="h-8 text-sm" />
                      <Input value={r.telefone ?? ""} placeholder="Telefone" onChange={(e) => { const arr = [...editado.responsaveis!]; arr[i] = { ...arr[i], telefone: e.target.value }; setEditado({ ...editado, responsaveis: arr }); }} className="h-8 text-sm" />
                      <Input value={r.profissao ?? ""} placeholder="Profissão" onChange={(e) => { const arr = [...editado.responsaveis!]; arr[i] = { ...arr[i], profissao: e.target.value }; setEditado({ ...editado, responsaveis: arr }); }} className="h-8 text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pré-anamnese */}
          {editado.pre_anamnese && Object.values(editado.pre_anamnese).some(Boolean) && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Pré-anamnese</h3>
              <div className="space-y-2">
                {CAMPOS_PRE.map(c => {
                  const v = editado.pre_anamnese?.[c];
                  if (!v) return null;
                  return (
                    <div key={c} className="flex items-start gap-2 p-2 rounded border bg-card/50">
                      <Checkbox checked={!!aplicar[`pre.${c}`]} onCheckedChange={(v) => setAplicar({ ...aplicar, [`pre.${c}`]: !!v })} className="mt-1" />
                      <div className="flex-1">
                        <Label className="text-[11px] uppercase text-muted-foreground">{c.replaceAll("_", " ")}</Label>
                        <Textarea
                          value={editado.pre_anamnese?.[c] ?? ""}
                          onChange={(e) => setEditado({ ...editado, pre_anamnese: { ...editado.pre_anamnese, [c]: e.target.value } })}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Hipóteses */}
          {(editado.hipoteses ?? []).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Hipóteses identificadas</h3>
              <div className="space-y-1">
                {editado.hipoteses!.map((h, i) => (
                  <label key={i} className="flex items-center gap-2 p-2 rounded border bg-card/50">
                    <Checkbox checked={!!aplicar[`hip.${i}`]} onCheckedChange={(v) => setAplicar({ ...aplicar, [`hip.${i}`]: !!v })} />
                    <span className="text-sm">{h}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Diagnósticos */}
          {(editado.diagnosticos ?? []).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Diagnósticos referidos</h3>
              <div className="flex flex-wrap gap-2">
                {editado.diagnosticos!.map((d, i) => (
                  <label key={i} className="flex items-center gap-2 px-2 py-1 rounded border bg-card/50">
                    <Checkbox checked={!!aplicar[`diag.${i}`]} onCheckedChange={(v) => setAplicar({ ...aplicar, [`diag.${i}`]: !!v })} />
                    <Badge variant="outline">{d}</Badge>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Perfil vivo */}
          {editado.perfil_vivo && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Perfil Clínico Vivo</h3>
              <label className="flex items-start gap-2 p-3 rounded border bg-card/50">
                <Checkbox checked={!!aplicar["perfil_vivo"]} onCheckedChange={(v) => setAplicar({ ...aplicar, perfil_vivo: !!v })} className="mt-1" />
                <div className="flex-1 text-xs text-muted-foreground space-y-1">
                  {Object.entries(editado.perfil_vivo).map(([k, v]) => {
                    if (!v || (Array.isArray(v) && v.length === 0)) return null;
                    return <div key={k}><span className="font-semibold uppercase text-[10px]">{k.replaceAll("_", " ")}:</span> {Array.isArray(v) ? v.map((x: any) => typeof x === "string" ? x : x.descricao).join(", ") : String(v)}</div>;
                  })}
                </div>
              </label>
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
