import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck2, Printer, Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  gerarDeclaracaoHTML,
  imprimirDeclaracao,
  MODELO_DECLARACAO_PADRAO,
} from "@/lib/declaracao-documento";

/** Sub-aba "Declarações": gera declaração de comparecimento com modelo editável. */
export function DeclaracaoComparecimento({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [horaInicio, setHoraInicio] = useState("14:00");
  const [horaFim, setHoraFim] = useState("15:00");
  const [editando, setEditando] = useState(false);
  const [modelo, setModelo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ["paciente-nome", pacienteId],
    queryFn: async () => (await supabase.from("pacientes").select("nome").eq("id", pacienteId).single()).data,
  });

  // Últimos atendimentos, para preencher data/hora em 1 clique.
  const { data: atendimentos } = useQuery({
    queryKey: ["paciente-atendimentos-decl", pacienteId],
    queryFn: async () =>
      (await supabase
        .from("atendimentos")
        .select("id, inicio, fim, profissional:profissionais_consultorio(nome)")
        .eq("paciente_id", pacienteId)
        .order("inicio", { ascending: false })
        .limit(20)).data ?? [],
  });

  const { data: org } = useQuery({
    queryKey: ["org-declaracao-modelo"],
    queryFn: async () => {
      const res = await (supabase.from("organizacoes") as any).select("id, declaracao_modelo").limit(1).maybeSingle();
      return res.data as { id: string; declaracao_modelo: string | null } | null;
    },
  });

  const modeloAtual = modelo ?? org?.declaracao_modelo ?? MODELO_DECLARACAO_PADRAO;
  const [profissionalNome, setProfissionalNome] = useState<string>("");

  function preencherDeAtendimento(atId: string) {
    const at: any = (atendimentos ?? []).find((a: any) => a.id === atId);
    if (!at) return;
    if (at.inicio) {
      setData(at.inicio.slice(0, 10));
      setHoraInicio(format(parseISO(at.inicio), "HH:mm"));
    }
    if (at.fim) setHoraFim(format(parseISO(at.fim), "HH:mm"));
    setProfissionalNome(at.profissional?.nome ?? "");
  }

  const salvarModelo = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organização não encontrada");
      const { error } = await (supabase.from("organizacoes") as any).update({ declaracao_modelo: modeloAtual }).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-declaracao-modelo"] }); toast.success("Modelo salvo como padrão da clínica"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function gerar() {
    if (!paciente?.nome) { toast.error("Paciente não encontrado"); return; }
    setGerando(true);
    try {
      const { html } = await gerarDeclaracaoHTML({
        pacienteNome: paciente.nome,
        data,
        horaInicio,
        horaFim,
        profissionalNome: profissionalNome || null,
        modelo: modeloAtual,
      });
      imprimirDeclaracao(html);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar declaração");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-brand" />
          <div>
            <h3 className="font-medium">Declaração de comparecimento</h3>
            <p className="text-xs text-muted-foreground">Gera o documento com o logo e os dados da clínica. Abre para impressão/PDF.</p>
          </div>
        </div>

        {(atendimentos ?? []).length > 0 && (
          <div>
            <Label className="text-xs">Preencher a partir de um atendimento</Label>
            <Select onValueChange={preencherDeAtendimento}>
              <SelectTrigger><SelectValue placeholder="Escolher atendimento recente…" /></SelectTrigger>
              <SelectContent>
                {(atendimentos ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.inicio ? format(parseISO(a.inicio), "dd/MM/yyyy HH:mm") : "—"}{a.profissional?.nome ? ` · ${a.profissional.nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Das</Label>
            <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Às</Label>
            <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Profissional (opcional)</Label>
          <Input value={profissionalNome} onChange={(e) => setProfissionalNome(e.target.value)} placeholder="Nome do profissional" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Texto da declaração</Label>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditando((v) => !v)}>
              <Pencil className="mr-1 h-3 w-3" /> {editando ? "Ocultar" : "Editar modelo"}
            </Button>
          </div>
          {editando ? (
            <div className="space-y-2">
              <Textarea
                rows={6}
                value={modeloAtual}
                onChange={(e) => setModelo(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code>{"{{paciente.nome}}"}</code>, <code>{"{{data}}"}</code>, <code>{"{{hora_inicio}}"}</code>, <code>{"{{hora_fim}}"}</code>, <code>{"{{profissional}}"}</code>, <code>{"{{clinica.nome}}"}</code>.
              </p>
              <Button size="sm" variant="outline" onClick={() => salvarModelo.mutate()} disabled={salvarModelo.isPending}>
                {salvarModelo.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Salvar como padrão da clínica
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
              Modelo {org?.declaracao_modelo ? "personalizado da clínica" : "padrão"} — clique em “Editar modelo” para ajustar.
            </p>
          )}
        </div>

        <Button onClick={gerar} disabled={gerando} className="gradient-brand text-brand-foreground">
          {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Gerar declaração
        </Button>
      </CardContent>
    </Card>
  );
}
