import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, FileDown, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { gerarRoteiroEstudos, type RoteiroEstudos as Roteiro } from "@/lib/ferramentas-ia.functions";
import { gerarDocumentoHTML, imprimirDocumento } from "@/lib/documento-avulso";

const PERFIS = ["TDAH", "Dislexia", "Discalculia", "TEA", "Altas habilidades", "Sem diagnóstico"];

const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function RoteiroEstudos({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gerarFn = useServerFn(gerarRoteiroEstudos);
  const [ano, setAno] = useState("");
  const [disciplinas, setDisciplinas] = useState("");
  const [tempo, setTempo] = useState("");
  const [perfil, setPerfil] = useState<string[]>([]);
  const [objetivos, setObjetivos] = useState("");
  const [nomeAluno, setNomeAluno] = useState("");
  const [res, setRes] = useState<Roteiro | null>(null);
  const [loading, setLoading] = useState(false);

  function togglePerfil(p: string) {
    setPerfil((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function gerar() {
    if (!disciplinas.trim()) { toast.error("Informe as disciplinas e dificuldades"); return; }
    setLoading(true);
    try {
      const r = await gerarFn({ data: { ano, disciplinas: disciplinas.trim(), tempo, perfil, objetivos } });
      setRes(r as Roteiro);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar o roteiro");
    } finally {
      setLoading(false);
    }
  }

  async function gerarPdf() {
    if (!res) return;
    const titulo = "Roteiro de Estudos" + (nomeAluno.trim() ? ` — ${nomeAluno.trim()}` : "");
    const partes: string[] = [];
    if (res.resumo) partes.push(`<p>${esc(res.resumo)}</p>`);
    if (res.cronograma.length) {
      partes.push(`<h2 style="font-size:16px;margin:20px 0 8px;">Cronograma semanal</h2>`);
      for (const d of res.cronograma) {
        const blocos = (d.blocos ?? [])
          .map((b) => `<li>${esc(b.atividade)} <span style="color:#6b7280;">(${b.minutos} min)</span></li>`)
          .join("");
        partes.push(`<p style="margin:10px 0 2px;"><strong>${esc(d.dia)}</strong></p><ul style="margin:0 0 6px 18px;">${blocos}</ul>`);
      }
    }
    if (res.estrategias.length) {
      partes.push(`<h2 style="font-size:16px;margin:20px 0 8px;">Estratégias por disciplina</h2>`);
      for (const s of res.estrategias) {
        const itens = (s.itens ?? []).map((i) => `<li>${esc(i)}</li>`).join("");
        partes.push(`<p style="margin:10px 0 2px;"><strong>${esc(s.disciplina)}</strong></p><ul style="margin:0 0 6px 18px;">${itens}</ul>`);
      }
    }
    if (res.familia.length) {
      partes.push(`<h2 style="font-size:16px;margin:20px 0 8px;">Como a família pode ajudar</h2>`);
      partes.push(`<ul style="margin:0 0 6px 18px;">${res.familia.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`);
    }
    const html = await gerarDocumentoHTML({ titulo, corpoHtml: partes.join("") });
    imprimirDocumento(html);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />Roteiro de estudos
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome do aluno (opcional — sai no PDF)</Label>
            <Input value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} placeholder="Ex.: João" />
          </div>
          <div>
            <Label className="text-xs">Ano / série</Label>
            <Input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="Ex.: 5º ano do fundamental" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Disciplinas e dificuldades</Label>
          <Textarea rows={2} value={disciplinas} onChange={(e) => setDisciplinas(e.target.value)}
            placeholder="Ex.: Matemática (frações), Português (interpretação de texto), dificuldade de manter o foco…" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Tempo disponível</Label>
            <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="Ex.: 40 min por dia, de seg a sex" />
          </div>
          <div>
            <Label className="text-xs">Objetivos / observações</Label>
            <Input value={objetivos} onChange={(e) => setObjetivos(e.target.value)} placeholder="Ex.: preparar para a prova de fim de bimestre" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Perfil do aluno</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PERFIS.map((p) => (
              <button key={p} type="button" onClick={() => togglePerfil(p)}
                className={`rounded-full border px-3 py-1 text-xs transition ${perfil.includes(p) ? "border-transparent bg-primary text-primary-foreground" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={gerar} disabled={loading} className="gradient-brand text-brand-foreground">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Gerar roteiro
          </Button>
        </div>

        {res && (
          <div className="space-y-4 rounded-lg border border-border/40 bg-muted/20 p-4">
            {res.resumo && <p className="text-sm leading-relaxed">{res.resumo}</p>}

            {res.cronograma.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Cronograma semanal</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {res.cronograma.map((d, i) => (
                    <div key={i} className="rounded-md border border-border/40 bg-background p-2.5">
                      <p className="text-xs font-semibold">{d.dia}</p>
                      <ul className="mt-1 space-y-0.5">
                        {(d.blocos ?? []).map((b, j) => (
                          <li key={j} className="text-xs text-muted-foreground">
                            • {b.atividade} <span className="text-[10px]">({b.minutos} min)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {res.estrategias.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Estratégias por disciplina</h3>
                <div className="space-y-2">
                  {res.estrategias.map((s, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold">{s.disciplina}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {(s.itens ?? []).map((it, j) => (
                          <li key={j} className="text-xs text-muted-foreground">• {it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {res.familia.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Como a família pode ajudar</h3>
                <ul className="space-y-0.5">
                  {res.familia.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={gerarPdf}>
                <FileDown className="mr-1.5 h-4 w-4" />Gerar PDF para a família
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Revise antes de entregar — a IA pode errar. Ajuste o roteiro ao contexto real do aluno.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
