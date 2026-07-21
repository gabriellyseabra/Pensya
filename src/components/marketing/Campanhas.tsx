import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Megaphone, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { currency, type Campanha } from "./types";

const STATUS_LABEL: Record<string, string> = { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" };
const STATUS_TONE: Record<string, string> = {
  planejada: "bg-muted text-muted-foreground",
  ativa: "bg-emerald-100 text-emerald-700",
  pausada: "bg-brand-yellow/30 text-foreground",
  encerrada: "bg-secondary text-foreground",
};
const NENHUM = "__nenhum__";

export function Campanhas() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [detalhe, setDetalhe] = useState<(Campanha & { canal?: { nome: string } | null }) | null>(null);

  const { data: campanhas } = useQuery({
    queryKey: ["campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanhas").select("*, canal:canais_marketing(id, nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leadsResumo } = useQuery({
    queryKey: ["leads-por-campanha"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, campanha_id");
      return data ?? [];
    },
  });

  const { data: pacientesAquisicao } = useQuery({
    queryKey: ["pacientes-por-campanha-origem"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, campanha_origem_id")
        .not("campanha_origem_id", "is", null);
      return data ?? [];
    },
  });

  const metricas = useMemo(() => {
    const map = new Map<string, { total: number; convertidos: number }>();
    for (const l of leadsResumo ?? []) {
      if (!l.campanha_id) continue;
      const cur = map.get(l.campanha_id) ?? { total: 0, convertidos: 0 };
      cur.total += 1;
      map.set(l.campanha_id, cur);
    }
    for (const p of pacientesAquisicao ?? []) {
      if (!p.campanha_origem_id) continue;
      const cur = map.get(p.campanha_origem_id) ?? { total: 0, convertidos: 0 };
      cur.convertidos += 1;
      map.set(p.campanha_origem_id, cur);
    }
    return map;
  }, [leadsResumo, pacientesAquisicao]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gradient-brand text-white" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Nova campanha
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campanhas?.map((c: any, i: number) => {
          const m = metricas.get(c.id) ?? { total: 0, convertidos: 0 };
          const taxaConv = m.total > 0 ? (m.convertidos / m.total) * 100 : 0;
          const cac = m.convertidos > 0 && c.custo_realizado ? c.custo_realizado / m.convertidos : null;
          const pctOrcamento = c.orcamento ? Math.min(100, ((c.custo_realizado ?? 0) / c.orcamento) * 100) : null;
          return (
            <Card
              key={c.id}
              className="glass card-lift animate-fade-up cursor-pointer"
              style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
              onClick={() => setDetalhe(c)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate">{c.nome}</CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); setEditing(c); setFormOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  {c.canal && <Badge variant="outline">{c.canal.nome}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {(c.data_inicio || c.data_fim) && (
                  <p className="text-xs text-muted-foreground">
                    {c.data_inicio ? format(parseISO(c.data_inicio), "dd/MM/yyyy") : "?"} — {c.data_fim ? format(parseISO(c.data_fim), "dd/MM/yyyy") : "em andamento"}
                  </p>
                )}
                {pctOrcamento !== null && (
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{currency(c.custo_realizado)} de {currency(c.orcamento)}</span>
                      <span>{pctOrcamento.toFixed(0)}%</span>
                    </div>
                    <Progress value={pctOrcamento} className="h-1.5" />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <Metrica label="Leads" value={String(m.total)} />
                  <Metrica label="Convertidos" value={String(m.convertidos)} />
                  <Metrica label="Conversão" value={`${taxaConv.toFixed(0)}%`} />
                </div>
                {cac !== null && <p className="text-xs text-muted-foreground">CAC: {currency(cac)} por paciente convertido</p>}
                {c.meta_leads && <p className="text-xs text-muted-foreground">Meta: {m.total}/{c.meta_leads} leads</p>}
              </CardContent>
            </Card>
          );
        })}
        {campanhas?.length === 0 && (
          <Card className="glass p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Nenhuma campanha cadastrada ainda.
          </Card>
        )}
      </div>

      <CampanhaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["campanhas"] })}
      />

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="glass-strong max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Leads de {detalhe?.nome}</DialogTitle></DialogHeader>
          {detalhe && <LeadsDaCampanha campanhaId={detalhe.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metrica({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function LeadsDaCampanha({ campanhaId }: { campanhaId: string }) {
  const { data: leads } = useQuery({
    queryKey: ["leads-campanha", campanhaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, paciente_id_criado, etapa:pipeline_etapas(nome, cor)")
        .eq("campanha_id", campanhaId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Etapa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads?.map((l) => (
          <TableRow key={l.id}>
            <TableCell>{l.nome}</TableCell>
            <TableCell className="text-muted-foreground">{l.telefone ?? "—"}</TableCell>
            <TableCell>
              {l.etapa && <Badge style={{ backgroundColor: `${l.etapa.cor}22`, color: l.etapa.cor }}>{l.etapa.nome}</Badge>}
              {l.paciente_id_criado && <Badge className="ml-1 bg-emerald-100 text-emerald-700">Convertido</Badge>}
            </TableCell>
          </TableRow>
        ))}
        {leads?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Nenhum lead vinculado.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function CampanhaFormDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Campanha | null; onSaved: () => void }) {
  const [form, setForm] = useState(() => vazio(editing));

  useMemo(() => { if (open) setForm(vazio(editing)); }, [open, editing]);

  const { data: canais } = useQuery({
    queryKey: ["canais-marketing-mini"],
    queryFn: async () => (await supabase.from("canais_marketing").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        canal_id: form.canal_id || null,
        status: form.status,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        orcamento: form.orcamento ? Number(form.orcamento) : null,
        custo_realizado: form.custo_realizado ? Number(form.custo_realizado) : null,
        meta_leads: form.meta_leads ? Number(form.meta_leads) : null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("campanhas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("campanhas").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Campanha atualizada" : "Campanha criada"); onOpenChange(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select value={form.canal_id || NENHUM} onValueChange={(v) => setForm({ ...form, canal_id: v === NENHUM ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>—</SelectItem>
                  {canais?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Orçamento (R$)</Label>
              <Input type="number" step="0.01" value={form.orcamento} onChange={(e) => setForm({ ...form, orcamento: e.target.value })} />
            </div>
            <div>
              <Label>Custo realizado (R$)</Label>
              <Input type="number" step="0.01" value={form.custo_realizado} onChange={(e) => setForm({ ...form, custo_realizado: e.target.value })} />
            </div>
            <div>
              <Label>Meta de leads</Label>
              <Input type="number" value={form.meta_leads} onChange={(e) => setForm({ ...form, meta_leads: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="gradient-brand text-white" disabled={!form.nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
            {editing ? "Salvar" : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function vazio(editing: Campanha | null) {
  return {
    nome: editing?.nome ?? "",
    canal_id: editing?.canal_id ?? "",
    status: editing?.status ?? "planejada",
    data_inicio: editing?.data_inicio ?? "",
    data_fim: editing?.data_fim ?? "",
    orcamento: editing?.orcamento != null ? String(editing.orcamento) : "",
    custo_realizado: editing?.custo_realizado != null ? String(editing.custo_realizado) : "",
    meta_leads: editing?.meta_leads != null ? String(editing.meta_leads) : "",
    observacoes: editing?.observacoes ?? "",
  };
}
