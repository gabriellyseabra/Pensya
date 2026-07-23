import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Landmark, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CLINICA_LOGO_BUCKET, clinicaLogoUrl, getMinhaOrganizacao } from "@/lib/clinica-config";
import { BANCOS_PRESET, corDoBanco } from "./bancos";

type Conta = {
  id: string;
  nome: string;
  tipo: string | null;
  banco: string | null;
  banco_cor: string | null;
  logo_path: string | null;
  saldo_inicial: number | null;
  ativo: boolean;
  ordem: number | null;
};

const TIPOS_CONTA = [
  { value: "caixa", label: "Caixa (dinheiro)" },
  { value: "banco", label: "Conta bancária" },
  { value: "carteira_digital", label: "Carteira digital" },
  { value: "cofre", label: "Cofre / reserva" },
  { value: "outro", label: "Outro" },
];

export function ContasFinanceirasConfig() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Conta | null>(null);
  const [open, setOpen] = useState(false);
  const queryKey = ["config", "contas_financeiras_full"];

  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("id, nome, tipo, banco, banco_cor, logo_path, saldo_inicial, ativo, ordem")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_financeiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Contas e bancos</h3>
          <p className="text-xs text-muted-foreground">Caixa, contas bancárias e carteiras — para onde o dinheiro entra e sai.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gradient-brand text-brand-foreground">
          <Plus className="mr-2 h-4 w-4" />Nova conta
        </Button>
      </div>

      <div className="space-y-1">
        {rows?.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhuma conta cadastrada.</p>}
        {rows?.map((c) => {
          const logo = clinicaLogoUrl(c.logo_path);
          const cor = c.banco_cor || corDoBanco(c.banco) || "#64748b";
          return (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {logo ? (
                  <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white" style={{ background: cor }}>
                    <Landmark className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.nome}</p>
                  <span className="text-xs text-muted-foreground">
                    {c.banco ? `${c.banco} · ` : ""}{TIPOS_CONTA.find((t) => t.value === c.tipo)?.label ?? c.tipo ?? "—"}
                  </span>
                </div>
                {!c.ativo && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <ContaForm
            editing={editing}
            onSaved={() => { qc.invalidateQueries({ queryKey }); setOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContaForm({ editing, onSaved }: { editing: Conta | null; onSaved: () => void }) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [tipo, setTipo] = useState(editing?.tipo ?? "banco");
  const [banco, setBanco] = useState(editing?.banco ?? "");
  const [cor, setCor] = useState(editing?.banco_cor ?? corDoBanco(editing?.banco) ?? "#0038A8");
  const [saldo, setSaldo] = useState(editing?.saldo_inicial != null ? String(editing.saldo_inicial) : "");
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(clinicaLogoUrl(editing?.logo_path ?? null));
  const [saving, setSaving] = useState(false);

  function escolherBanco(nomeBanco: string) {
    setBanco(nomeBanco);
    const c = corDoBanco(nomeBanco);
    if (c) setCor(c);
    // Sugere nome da conta se ainda vazio.
    if (!nome) setNome(nomeBanco);
  }

  function escolherLogo(f?: File | null) {
    if (!f) return;
    setLogoFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function salvar() {
    setSaving(true);
    try {
      let logo_path = editing?.logo_path ?? null;
      if (logoFile) {
        const org = await getMinhaOrganizacao();
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${org?.id ?? "org"}/banco-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(CLINICA_LOGO_BUCKET).upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        logo_path = path;
      }
      const payload = {
        nome: nome || "Conta",
        tipo,
        banco: banco || null,
        banco_cor: cor || null,
        logo_path,
        saldo_inicial: saldo ? Number(saldo) : 0,
        ativo,
      };
      if (editing?.id) {
        const { error } = await supabase.from("contas_financeiras").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_financeiras").insert(payload);
        if (error) throw error;
      }
      toast.success("Conta salva");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Banco</Label>
        <Select value={BANCOS_PRESET.some((b) => b.nome === banco) ? banco : "__custom"} onValueChange={(v) => v === "__custom" ? setBanco("") : escolherBanco(v)}>
          <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_PRESET.map((b) => (
              <SelectItem key={b.nome} value={b.nome}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: b.cor }} />
                  {b.nome}
                </span>
              </SelectItem>
            ))}
            <SelectItem value="__custom">Outro (digitar)</SelectItem>
          </SelectContent>
        </Select>
        {!BANCOS_PRESET.some((b) => b.nome === banco) && (
          <Input className="mt-2" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Nome do banco" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nome da conta</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Bradesco PJ" />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_CONTA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cor</Label>
          <div className="flex items-center gap-2">
            <Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-14 p-1" />
            <span className="text-xs text-muted-foreground">Badge da conta</span>
          </div>
        </div>
        <div>
          <Label>Saldo inicial (R$)</Label>
          <Input type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" />
        </div>
      </div>

      <div>
        <Label>Logo do banco (opcional)</Label>
        <div className="flex items-center gap-3">
          {preview ? (
            <img src={preview} alt="" className="h-10 w-10 rounded-md object-contain border" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-md border text-white" style={{ background: cor }}>
              <Landmark className="h-4 w-4" />
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={(e) => escolherLogo(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Conta ativa
      </label>

      <DialogFooter>
        <Button onClick={salvar} disabled={saving} className="gradient-brand text-brand-foreground">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}
