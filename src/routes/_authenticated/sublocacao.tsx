import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, DoorOpen, Users, FileText, CalendarClock, Building2, ArrowLeft, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  upsertSala, excluirSala, upsertSublocador, excluirSublocador,
  upsertContratoSublocacao, excluirContrato, registrarUsoSala, excluirUsoSala,
  upsertDisponibilidade, excluirDisponibilidade, criarDisponibilidadeRecorrente,
} from "@/lib/sublocacao.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Repeat } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import { PageHero } from "@/components/shared/PageHero";

export const Route = createFileRoute("/_authenticated/sublocacao")({
  component: SublocacaoPage,
});

function SublocacaoPage() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <Card className="glass p-8 text-center text-sm text-muted-foreground">
        Apenas administradores podem gerenciar a sublocação de salas.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        to="/agenda"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar para agenda
      </Link>
      <PageHero
        icon={Building2}
        eyebrow="Espaços"
        title="Sublocação de salas"
        description="Cadastre salas, sublocadores, contratos e registre o uso para geração automática de receita."
        variant="dark"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 text-white hover:bg-white/20"
            onClick={async () => {
              const url = `${window.location.origin}/salas`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link público copiado! Envie aos sublocadores.");
              } catch {
                toast.info(url);
              }
            }}
          >
            <LinkIcon className="mr-1.5 h-3.5 w-3.5" /> Copiar agenda pública
          </Button>
        }
      />

      <Tabs defaultValue="usos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usos"><CalendarClock className="h-4 w-4 mr-1.5" />Usos</TabsTrigger>
          <TabsTrigger value="disponibilidade"><Repeat className="h-4 w-4 mr-1.5" />Disponibilidade</TabsTrigger>
          <TabsTrigger value="contratos"><FileText className="h-4 w-4 mr-1.5" />Contratos</TabsTrigger>
          <TabsTrigger value="salas"><DoorOpen className="h-4 w-4 mr-1.5" />Salas</TabsTrigger>
          <TabsTrigger value="sublocadores"><Users className="h-4 w-4 mr-1.5" />Sublocadores</TabsTrigger>
        </TabsList>

        <TabsContent value="usos"><UsosTab /></TabsContent>
        <TabsContent value="disponibilidade"><DisponibilidadeTab /></TabsContent>
        <TabsContent value="contratos"><ContratosTab /></TabsContent>
        <TabsContent value="salas"><SalasTab /></TabsContent>
        <TabsContent value="sublocadores"><SublocadoresTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =============== SALAS ===============
function SalasTab() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSala);
  const excluir = useServerFn(excluirSala);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({ nome: "", cor: "#3b82f6", capacidade: "", observacoes: "" });

  const { data: salas = [] } = useQuery({
    queryKey: ["salas"],
    queryFn: async () => (await supabase.from("salas").select("*").order("nome")).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => upsert({
      data: {
        id: edit?.id,
        nome: form.nome,
        cor: form.cor,
        capacidade: form.capacidade ? Number(form.capacidade) : null,
        observacoes: form.observacoes || null,
      },
    }),
    onSuccess: () => {
      toast.success("Sala salva");
      setOpen(false); setEdit(null);
      setForm({ nome: "", cor: "#3b82f6", capacidade: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: ["salas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Sala removida"); qc.invalidateQueries({ queryKey: ["salas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Salas cadastradas</h3>
        <Button size="sm" onClick={() => { setEdit(null); setForm({ nome: "", cor: "#3b82f6", capacidade: "", observacoes: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova sala
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Sala</TableHead><TableHead>Capacidade</TableHead><TableHead>Observações</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
        <TableBody>
          {(salas as any[]).map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: s.cor }} />
                {s.nome}
              </TableCell>
              <TableCell>{s.capacidade ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.observacoes ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => { setEdit(s); setForm({ nome: s.nome, cor: s.cor ?? "#3b82f6", capacidade: s.capacidade?.toString() ?? "", observacoes: s.observacoes ?? "" }); setOpen(true); }}>Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover sala ${s.nome}?`)) remover.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {salas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Nenhuma sala cadastrada.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Nova"} sala</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cor</Label><Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
              <div><Label>Capacidade</Label><Input type="number" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.nome || salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============== SUBLOCADORES ===============
function SublocadoresTab() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSublocador);
  const excluir = useServerFn(excluirSublocador);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({ nome: "", documento: "", telefone: "", email: "", especialidade: "" });

  const { data: subs = [] } = useQuery({
    queryKey: ["sublocadores"],
    queryFn: async () => (await supabase.from("sublocadores").select("*").order("nome")).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => upsert({ data: { id: edit?.id, ...form } }),
    onSuccess: () => {
      toast.success("Sublocador salvo");
      setOpen(false); setEdit(null);
      setForm({ nome: "", documento: "", telefone: "", email: "", especialidade: "" });
      qc.invalidateQueries({ queryKey: ["sublocadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Sublocador removido"); qc.invalidateQueries({ queryKey: ["sublocadores"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Sublocadores</h3>
        <Button size="sm" onClick={() => { setEdit(null); setForm({ nome: "", documento: "", telefone: "", email: "", especialidade: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo sublocador
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Documento</TableHead><TableHead>Contato</TableHead><TableHead>Especialidade</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
        <TableBody>
          {(subs as any[]).map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.nome}</TableCell>
              <TableCell>{s.documento ?? "—"}</TableCell>
              <TableCell className="text-xs">{[s.telefone, s.email].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="text-xs">{s.especialidade ?? "—"}</TableCell>
              <TableCell className="text-right">
                {s.portal_token && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Copiar link do portal (reservar/trocar horários)"
                    onClick={async () => {
                      const url = `${window.location.origin}/salas/${s.portal_token}`;
                      try { await navigator.clipboard.writeText(url); toast.success(`Link de ${s.nome} copiado!`); }
                      catch { toast.info(url); }
                    }}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setEdit(s); setForm({ nome: s.nome, documento: s.documento ?? "", telefone: s.telefone ?? "", email: s.email ?? "", especialidade: s.especialidade ?? "" }); setOpen(true); }}>Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${s.nome}?`)) remover.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {subs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum sublocador.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} sublocador</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF/CNPJ</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Especialidade</Label><Input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.nome || salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============== CONTRATOS ===============
function ContratosTab() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertContratoSublocacao);
  const excluir = useServerFn(excluirContrato);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({
    sublocador_id: "", sala_id: "", modelo: "fixo_sessao",
    valor_base: "", percentual: "", valor_mensal: "", valor_extra: "",
    vigencia_inicio: "", vigencia_fim: "", observacoes: "",
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos-sublocacao"],
    queryFn: async () => (await supabase.from("sublocacao_contratos").select("*, sublocador:sublocadores(nome), sala:salas(nome, cor)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: salas = [] } = useQuery({
    queryKey: ["salas"], queryFn: async () => (await supabase.from("salas").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["sublocadores"], queryFn: async () => (await supabase.from("sublocadores").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => upsert({
      data: {
        id: edit?.id,
        sublocador_id: form.sublocador_id,
        sala_id: form.sala_id,
        modelo: form.modelo as any,
        valor_base: form.valor_base ? Number(form.valor_base) : null,
        percentual: form.percentual ? Number(form.percentual) : null,
        valor_mensal: form.valor_mensal ? Number(form.valor_mensal) : null,
        valor_extra: form.valor_extra ? Number(form.valor_extra) : null,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
        observacoes: form.observacoes || null,
      },
    }),
    onSuccess: () => {
      toast.success("Contrato salvo");
      setOpen(false); setEdit(null);
      qc.invalidateQueries({ queryKey: ["contratos-sublocacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Contrato removido"); qc.invalidateQueries({ queryKey: ["contratos-sublocacao"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function descricaoCobranca(c: any) {
    if (c.modelo === "fixo_sessao") return `R$ ${c.valor_base} por sessão`;
    if (c.modelo === "fixo_hora") return `R$ ${c.valor_base} por hora`;
    if (c.modelo === "percentual") return `${c.percentual}% sobre atendimento`;
    if (c.modelo === "mensal_extras") return `R$ ${c.valor_mensal}/mês + R$ ${c.valor_extra} extras`;
    return c.modelo;
  }

  return (
    <Card className="glass p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Contratos de sublocação</h3>
        <Button size="sm" onClick={() => { setEdit(null); setForm({ sublocador_id: "", sala_id: "", modelo: "fixo_sessao", valor_base: "", percentual: "", valor_mensal: "", valor_extra: "", vigencia_inicio: "", vigencia_fim: "", observacoes: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo contrato
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Sublocador</TableHead><TableHead>Sala</TableHead><TableHead>Cobrança</TableHead><TableHead>Vigência</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
        <TableBody>
          {(contratos as any[]).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.sublocador?.nome}</TableCell>
              <TableCell><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: c.sala?.cor }} />{c.sala?.nome}</TableCell>
              <TableCell className="text-xs">{descricaoCobranca(c)}</TableCell>
              <TableCell className="text-xs">{[c.vigencia_inicio, c.vigencia_fim].filter(Boolean).join(" → ") || "vigente"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => { setEdit(c); setForm({ sublocador_id: c.sublocador_id, sala_id: c.sala_id, modelo: c.modelo, valor_base: c.valor_base?.toString() ?? "", percentual: c.percentual?.toString() ?? "", valor_mensal: c.valor_mensal?.toString() ?? "", valor_extra: c.valor_extra?.toString() ?? "", vigencia_inicio: c.vigencia_inicio ?? "", vigencia_fim: c.vigencia_fim ?? "", observacoes: c.observacoes ?? "" }); setOpen(true); }}>Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover contrato?")) remover.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {contratos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum contrato cadastrado.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-w-xl">
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} contrato</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sublocador *</Label>
                <Select value={form.sublocador_id} onValueChange={(v) => setForm({ ...form, sublocador_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(subs as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sala *</Label>
                <Select value={form.sala_id} onValueChange={(v) => setForm({ ...form, sala_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(salas as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Modelo de cobrança *</Label>
              <Select value={form.modelo} onValueChange={(v) => setForm({ ...form, modelo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo_sessao">Valor fixo por sessão</SelectItem>
                  <SelectItem value="fixo_hora">Valor fixo por hora</SelectItem>
                  <SelectItem value="percentual">% sobre atendimento</SelectItem>
                  <SelectItem value="mensal_extras">Mensalidade + extras</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.modelo === "fixo_sessao" || form.modelo === "fixo_hora") && (
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} /></div>
            )}
            {form.modelo === "percentual" && (
              <div><Label>Percentual (%)</Label><Input type="number" step="0.1" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} /></div>
            )}
            {form.modelo === "mensal_extras" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" value={form.valor_mensal} onChange={(e) => setForm({ ...form, valor_mensal: e.target.value })} /></div>
                <div><Label>Sessão extra (R$)</Label><Input type="number" step="0.01" value={form.valor_extra} onChange={(e) => setForm({ ...form, valor_extra: e.target.value })} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início vigência</Label><Input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} /></div>
              <div><Label>Fim vigência</Label><Input type="date" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.sublocador_id || !form.sala_id || salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============== USOS ===============
function UsosTab() {
  const qc = useQueryClient();
  const registrar = useServerFn(registrarUsoSala);
  const excluir = useServerFn(excluirUsoSala);
  const [open, setOpen] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    contrato_id: "", data: today, inicio: `${today}T09:00`, fim: `${today}T10:00`,
    valor_atendimento: "", observacoes: "", gerar_lancamento: true,
  });

  const { data: usos = [] } = useQuery({
    queryKey: ["usos-sublocacao"],
    queryFn: async () => (await supabase
      .from("sublocacao_usos")
      .select("*, sala:salas(nome, cor), sublocador:sublocadores(nome), contrato:sublocacao_contratos(modelo)")
      .order("data", { ascending: false })
      .limit(100)).data ?? [],
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos-mini"],
    queryFn: async () => (await supabase
      .from("sublocacao_contratos")
      .select("id, modelo, sublocador:sublocadores(nome), sala:salas(nome)")
      .eq("ativo", true)).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => registrar({
      data: {
        contrato_id: form.contrato_id,
        data: form.data,
        inicio: new Date(form.inicio).toISOString(),
        fim: new Date(form.fim).toISOString(),
        valor_atendimento: form.valor_atendimento ? Number(form.valor_atendimento) : null,
        observacoes: form.observacoes || null,
        gerar_lancamento: form.gerar_lancamento,
      },
    }),
    onSuccess: () => {
      toast.success("Uso registrado · lançamento financeiro gerado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["usos-sublocacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Uso removido"); qc.invalidateQueries({ queryKey: ["usos-sublocacao"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (usos as any[]).reduce((s, u) => s + Number(u.valor_calculado ?? 0), 0);

  return (
    <Card className="glass p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-semibold">Usos registrados</h3>
          <p className="text-xs text-muted-foreground">Total: <strong>R$ {total.toFixed(2)}</strong> · cada uso gera automaticamente lançamento de receita.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={contratos.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Registrar uso
        </Button>
      </div>
      {contratos.length === 0 && (
        <p className="text-xs text-amber-600 mb-3 flex items-center gap-1"><Building2 className="h-3 w-3" /> Cadastre ao menos um contrato antes de registrar usos.</p>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Sala</TableHead><TableHead>Sublocador</TableHead><TableHead>Horário</TableHead><TableHead>Valor</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
        <TableBody>
          {(usos as any[]).map((u) => (
            <TableRow key={u.id}>
              <TableCell>{format(parseISO(u.data), "dd/MM/yyyy")}</TableCell>
              <TableCell><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: u.sala?.cor }} />{u.sala?.nome}</TableCell>
              <TableCell>{u.sublocador?.nome}</TableCell>
              <TableCell className="text-xs">{format(parseISO(u.inicio), "HH:mm")} - {format(parseISO(u.fim), "HH:mm")} ({u.duracao_min}min)</TableCell>
              <TableCell><Badge variant="secondary">R$ {Number(u.valor_calculado).toFixed(2)}</Badge></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover uso e seu lançamento?")) remover.mutate(u.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {usos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum uso registrado.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>Registrar uso de sala</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Contrato *</Label>
              <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione contrato" /></SelectTrigger>
                <SelectContent>
                  {(contratos as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.sublocador?.nome} - {c.sala?.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value, inicio: `${e.target.value}T${form.inicio.slice(11)}`, fim: `${e.target.value}T${form.fim.slice(11)}` })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="datetime-local" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} /></div>
            </div>
            <div>
              <Label>Valor cobrado do paciente (R$) <span className="text-xs text-muted-foreground">— usado em contratos por %</span></Label>
              <Input type="number" step="0.01" value={form.valor_atendimento} onChange={(e) => setForm({ ...form, valor_atendimento: e.target.value })} />
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.contrato_id || salvar.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============== DISPONIBILIDADE ===============
const DIAS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

function DisponibilidadeTab() {
  const qc = useQueryClient();
  const criarRec = useServerFn(criarDisponibilidadeRecorrente);
  const criarUm = useServerFn(upsertDisponibilidade);
  const excluir = useServerFn(excluirDisponibilidade);
  const [open, setOpen] = useState(false);
  const [filtroSala, setFiltroSala] = useState<string>("todas");
  const today = format(new Date(), "yyyy-MM-dd");
  const in30 = format(new Date(Date.now() + 30 * 86400_000), "yyyy-MM-dd");
  const [form, setForm] = useState({
    sala_id: "", tipo: "disponivel" as "disponivel" | "bloqueada",
    motivo: "", recorrente: true,
    data_inicio: today, data_fim: in30,
    hora_inicio: "08:00", hora_fim: "18:00",
    dias_semana: [1, 2, 3, 4, 5] as number[],
  });

  const { data: salas = [] } = useQuery({
    queryKey: ["salas"],
    queryFn: async () => (await supabase.from("salas").select("id, nome, cor").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["disponibilidade", filtroSala],
    queryFn: async () => {
      let q = supabase.from("sublocacao_disponibilidade")
        .select("*, sala:salas(nome, cor)")
        .gte("inicio", new Date(Date.now() - 7 * 86400_000).toISOString())
        .order("inicio").limit(300);
      if (filtroSala !== "todas") q = q.eq("sala_id", filtroSala);
      return (await q).data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (form.recorrente) {
        return criarRec({
          data: {
            sala_id: form.sala_id, tipo: form.tipo, motivo: form.motivo || null,
            data_inicio: form.data_inicio, data_fim: form.data_fim,
            hora_inicio: form.hora_inicio, hora_fim: form.hora_fim,
            dias_semana: form.dias_semana,
          },
        });
      }
      return criarUm({
        data: {
          sala_id: form.sala_id, tipo: form.tipo, motivo: form.motivo || null,
          inicio: new Date(`${form.data_inicio}T${form.hora_inicio}:00`).toISOString(),
          fim: new Date(`${form.data_inicio}T${form.hora_fim}:00`).toISOString(),
        },
      });
    },
    onSuccess: (r: any) => {
      toast.success(form.recorrente ? `${r.criados} horários criados` : "Horário criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["disponibilidade"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["disponibilidade"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDia(d: number) {
    setForm(f => ({ ...f, dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter(x => x !== d) : [...f.dias_semana, d] }));
  }

  return (
    <Card className="glass p-4">
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">Disponibilidade das salas</h3>
          <p className="text-xs text-muted-foreground">Marque horários disponíveis ou bloqueios. Use recorrência para repetir semanalmente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroSala} onValueChange={setFiltroSala}>
            <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as salas</SelectItem>
              {(salas as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)} disabled={salas.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Sala</TableHead><TableHead>Data</TableHead><TableHead>Horário</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
        <TableBody>
          {(itens as any[]).map(i => (
            <TableRow key={i.id}>
              <TableCell><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: i.sala?.cor }} />{i.sala?.nome}</TableCell>
              <TableCell className="text-xs">{format(parseISO(i.inicio), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-xs">{format(parseISO(i.inicio), "HH:mm")} - {format(parseISO(i.fim), "HH:mm")}</TableCell>
              <TableCell><Badge variant={i.tipo === "disponivel" ? "default" : "destructive"}>{i.tipo}</Badge></TableCell>
              <TableCell className="text-xs">{i.motivo ?? "—"}{i.recorrencia_json ? <Badge variant="outline" className="ml-1">recorrente</Badge> : null}</TableCell>
              <TableCell><Button variant="ghost" size="icon" onClick={() => remover.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
          {itens.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum horário cadastrado.</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-w-xl">
          <DialogHeader><DialogTitle>Nova disponibilidade</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sala *</Label>
                <Select value={form.sala_id} onValueChange={v => setForm({ ...form, sala_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(salas as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.recorrente} onCheckedChange={v => setForm({ ...form, recorrente: !!v })} />
              Repetir semanalmente (recorrência)
            </label>

            {form.recorrente ? (
              <>
                <div>
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {DIAS.map(d => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => toggleDia(d.v)}
                        className={`px-3 py-1 rounded-md text-xs border transition ${form.dias_semana.includes(d.v) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-muted"}`}
                      >{d.l}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>De</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
                  <div><Label>Até</Label><Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></div>
                </div>
              </>
            ) : (
              <div><Label>Data</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Hora início</Label><Input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} /></div>
              <div><Label>Hora fim</Label><Input type="time" value={form.hora_fim} onChange={e => setForm({ ...form, hora_fim: e.target.value })} /></div>
            </div>

            <div><Label>Motivo / Observação</Label><Input value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.sala_id || (form.recorrente && form.dias_semana.length === 0) || salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
