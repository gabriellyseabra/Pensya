import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Sparkles, Mic, Square, Pencil, Trash2, Users, GraduationCap,
  UserCog, FileText, Loader2,
} from "lucide-react";
import { gerarPautaReuniao, sintetizarAtaReuniao } from "@/lib/reuniao.functions";

const TIPOS: { value: "pais" | "escola" | "equipe" | "outro"; label: string; icon: any }[] = [
  { value: "pais", label: "Pais / Responsáveis", icon: Users },
  { value: "escola", label: "Escola", icon: GraduationCap },
  { value: "equipe", label: "Equipe multidisciplinar", icon: UserCog },
  { value: "outro", label: "Outro", icon: FileText },
];

export function ReunioesTab({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: reunioes, isLoading } = useQuery({
    queryKey: ["reunioes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reunioes" as any)
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_reuniao", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  function abrirNova() { setEditing(null); setOpen(true); }
  function abrirEditar(r: any) { setEditing(r); setOpen(true); }

  async function excluir(id: string) {
    if (!confirm("Excluir esta reunião?")) return;
    const { error } = await supabase.from("reunioes" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reunião excluída");
    qc.invalidateQueries({ queryKey: ["reunioes", pacienteId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reuniões</h2>
          <p className="text-sm text-muted-foreground">
            Pais, escola e equipe — pauta e ata com apoio de IA.
          </p>
        </div>
        <Button onClick={abrirNova}><Plus className="mr-2 h-4 w-4" />Nova reunião</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && (reunioes ?? []).length === 0 && (
        <Card className="glass p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma reunião registrada. Clique em <strong>Nova reunião</strong> para começar.
          </p>
        </Card>
      )}

      <div className="grid gap-3">
        {(reunioes ?? []).map((r) => {
          const tipo = TIPOS.find((t) => t.value === r.tipo) ?? TIPOS[3];
          const Icon = tipo.icon;
          return (
            <Card key={r.id} className="glass">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <div className="font-medium">{tipo.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(r.data_reuniao), "dd 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR })}
                        {r.duracao_minutos ? ` · ${r.duracao_minutos} min` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={r.status === "realizada" ? "default" : "outline"}>{r.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {r.participantes && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Participantes:</strong> {r.participantes}
                  </p>
                )}
                {r.ata && (
                  <div className="text-sm whitespace-pre-wrap line-clamp-4 border-l-2 border-brand/40 pl-3">
                    {r.ata}
                  </div>
                )}
                {r.proxima_data && (
                  <p className="text-xs">
                    <strong>Próxima:</strong> {format(parseISO(r.proxima_data), "dd/MM/yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReuniaoDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        pacienteId={pacienteId}
        reuniao={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["reunioes", pacienteId] })}
      />
    </div>
  );
}

// =================== Dialog ===================
function ReuniaoDialog({
  open, onOpenChange, pacienteId, reuniao, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pacienteId: string;
  reuniao: any | null;
  onSaved: () => void;
}) {
  const gerarPauta = useServerFn(gerarPautaReuniao);
  const sintetizar = useServerFn(sintetizarAtaReuniao);

  const isEdit = !!reuniao;
  const [tipo, setTipo] = useState<"pais" | "escola" | "equipe" | "outro">(reuniao?.tipo ?? "pais");
  const [dataReuniao, setDataReuniao] = useState(
    reuniao?.data_reuniao
      ? format(parseISO(reuniao.data_reuniao), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [duracao, setDuracao] = useState<string>(reuniao?.duracao_minutos?.toString() ?? "");
  const [participantes, setParticipantes] = useState(reuniao?.participantes ?? "");
  const [pauta, setPauta] = useState(reuniao?.pauta ?? "");
  const [notas, setNotas] = useState(reuniao?.notas ?? "");
  const [ata, setAta] = useState(reuniao?.ata ?? "");
  const [decisoes, setDecisoes] = useState(reuniao?.decisoes ?? "");
  const [proximaData, setProximaData] = useState(reuniao?.proxima_data ?? "");
  const [status, setStatus] = useState(reuniao?.status ?? "agendada");
  const [contextoPauta, setContextoPauta] = useState("");
  const [loadingPauta, setLoadingPauta] = useState(false);
  const [loadingAta, setLoadingAta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [encaminhamentosIA, setEncaminhamentosIA] = useState<{ acao: string; responsavel?: string; prazo?: string }[]>([]);

  // Gravação de áudio
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  async function toggleRec() {
    if (recording) {
      recognitionRef.current?.stop();
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = "pt-BR";
        r.continuous = true;
        r.interimResults = true;
        let finalText = notas;
        r.onresult = (e: any) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += " " + t;
            else interim += t;
          }
          setNotas((finalText + " " + interim).trim());
        };
        r.onend = () => setRecording(false);
        recognitionRef.current = r;
        r.start();
        setRecording(true);
      } else {
        toast.error("Reconhecimento de fala indisponível neste navegador");
      }
    } catch (e: any) {
      toast.error("Erro ao iniciar gravação", { description: e.message });
    }
  }

  async function aplicarPautaIA() {
    setLoadingPauta(true);
    try {
      const r: any = await gerarPauta({ data: { paciente_id: pacienteId, tipo, contexto_adicional: contextoPauta || undefined } });
      const lines: string[] = [];
      lines.push(`OBJETIVO: ${r.objetivo_reuniao}`);
      lines.push("");
      lines.push("TÓPICOS:");
      (r.topicos ?? []).forEach((t: any, i: number) => {
        lines.push(`${i + 1}. ${t.titulo} (${t.tempo_min ?? "—"} min)`);
        if (t.descricao) lines.push(`   ${t.descricao}`);
      });
      if (r.perguntas_chave?.length) {
        lines.push("");
        lines.push("PERGUNTAS-CHAVE:");
        r.perguntas_chave.forEach((p: string) => lines.push(`- ${p}`));
      }
      if (r.pontos_progresso?.length) {
        lines.push("");
        lines.push("PONTOS DE PROGRESSO:");
        r.pontos_progresso.forEach((p: string) => lines.push(`- ${p}`));
      }
      if (r.pontos_atencao?.length) {
        lines.push("");
        lines.push("PONTOS DE ATENÇÃO:");
        r.pontos_atencao.forEach((p: string) => lines.push(`- ${p}`));
      }
      if (r.encaminhamentos_sugeridos?.length) {
        lines.push("");
        lines.push("ENCAMINHAMENTOS SUGERIDOS:");
        r.encaminhamentos_sugeridos.forEach((p: string) => lines.push(`- ${p}`));
      }
      setPauta(lines.join("\n"));
      toast.success("Pauta gerada");
    } catch (e: any) {
      toast.error("Falha ao gerar pauta", { description: e.message });
    } finally { setLoadingPauta(false); }
  }

  async function sintetizarAta() {
    if (notas.trim().length < 20) { toast.error("Adicione notas antes de sintetizar"); return; }
    setLoadingAta(true);
    try {
      const r: any = await sintetizar({ data: { paciente_id: pacienteId, tipo, notas, pauta: pauta || undefined, participantes: participantes || undefined } });
      setAta(r.ata ?? "");
      setDecisoes(r.decisoes ?? "");
      if (r.proxima_data_sugerida && r.proxima_data_sugerida !== "null") setProximaData(r.proxima_data_sugerida);
      if (r.encaminhamentos?.length) {
        setEncaminhamentosIA(r.encaminhamentos);
        const tarefasMsg = r.encaminhamentos.map((e: any) => `• ${e.acao} (resp: ${e.responsavel ?? "—"}, prazo: ${e.prazo ?? "—"})`).join("\n");
        setDecisoes((prev: string) => (prev ? prev + "\n\nENCAMINHAMENTOS:\n" : "ENCAMINHAMENTOS:\n") + tarefasMsg);
      }
      toast.success("Ata sintetizada — tarefas serão criadas ao salvar");
    } catch (e: any) {
      toast.error("Falha ao sintetizar", { description: e.message });
    } finally { setLoadingAta(false); }
  }

  async function salvar() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        paciente_id: pacienteId,
        tipo,
        data_reuniao: new Date(dataReuniao).toISOString(),
        duracao_minutos: duracao ? Number(duracao) : null,
        participantes: participantes || null,
        pauta: pauta || null,
        notas: notas || null,
        ata: ata || null,
        decisoes: decisoes || null,
        proxima_data: proximaData || null,
        status,
      };
      let reuniaoIdFinal = reuniao?.id;
      if (isEdit) {
        const { error } = await supabase.from("reunioes" as any).update(payload).eq("id", reuniao.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data: ins, error } = await supabase.from("reunioes" as any).insert(payload).select("id").single();
        if (error) throw error;
        reuniaoIdFinal = (ins as any)?.id;
      }

      // Auto-criar tarefas a partir dos encaminhamentos (apenas em criação)
      if (!isEdit && reuniaoIdFinal && encaminhamentosIA.length > 0) {
        const tarefasNovas = encaminhamentosIA.map((e) => ({
          paciente_id: pacienteId,
          reuniao_id: reuniaoIdFinal,
          titulo: e.acao,
          descricao: e.responsavel ? `Responsável: ${e.responsavel}` : null,
          prazo: /^\d{4}-\d{2}-\d{2}$/.test(e.prazo ?? "") ? e.prazo : null,
          prioridade: "media",
          status: "a_fazer",
          origem: "reuniao",
          criador_id: user?.id ?? null,
          created_by: user?.id,
        }));
        await supabase.from("tarefas").insert(tarefasNovas as any);
      }

      toast.success(isEdit ? "Reunião atualizada" : "Reunião registrada");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar reunião" : "Nova reunião"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data / hora</Label>
              <Input type="datetime-local" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Participantes</Label>
            <Input value={participantes} onChange={(e) => setParticipantes(e.target.value)} placeholder="Ex: Mãe, professora regente, coordenadora" />
          </div>

          <Tabs defaultValue="pauta">
            <TabsList>
              <TabsTrigger value="pauta">Pauta</TabsTrigger>
              <TabsTrigger value="ata">Notas e Ata</TabsTrigger>
              <TabsTrigger value="encaminhamentos">Decisões</TabsTrigger>
            </TabsList>

            <TabsContent value="pauta" className="space-y-3 pt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Contexto adicional para IA (opcional)"
                  value={contextoPauta}
                  onChange={(e) => setContextoPauta(e.target.value)}
                />
                <Button onClick={aplicarPautaIA} disabled={loadingPauta} variant="secondary">
                  {loadingPauta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Gerar com IA
                </Button>
              </div>
              <Textarea rows={12} value={pauta} onChange={(e) => setPauta(e.target.value)} placeholder="Pauta da reunião" />
            </TabsContent>

            <TabsContent value="ata" className="space-y-3 pt-3">
              <div className="flex items-center gap-2">
                <Button type="button" variant={recording ? "destructive" : "secondary"} onClick={toggleRec}>
                  {recording ? <Square className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                  {recording ? "Parar" : "Gravar"}
                </Button>
                <Button type="button" variant="secondary" onClick={sintetizarAta} disabled={loadingAta}>
                  {loadingAta ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Sintetizar ata
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notas brutas (você ou IA por voz)</Label>
                <Textarea rows={6} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ata final</Label>
                <Textarea rows={8} value={ata} onChange={(e) => setAta(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="encaminhamentos" className="space-y-3 pt-3">
              <div>
                <Label>Decisões e encaminhamentos</Label>
                <Textarea rows={8} value={decisoes} onChange={(e) => setDecisoes(e.target.value)} />
              </div>
              <div>
                <Label>Próxima reunião</Label>
                <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : isEdit ? "Atualizar" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
