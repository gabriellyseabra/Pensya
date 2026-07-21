import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles, Plus, X } from "lucide-react";

export function AplicarBateriaModeloDialog({
  open, onOpenChange, avaliacaoId, jaPlanejados,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  avaliacaoId: string;
  jaPlanejados: string[]; // teste_ids já na bateria
}) {
  const qc = useQueryClient();
  const [bateriaId, setBateriaId] = useState<string>("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Testes avulsos escolhidos além do modelo (teste_ids)
  const [avulsos, setAvulsos] = useState<string[]>([]);

  // Catálogo completo para adicionar testes avulsos
  const { data: catalogo } = useQuery({
    enabled: open,
    queryKey: ["testes-catalogo"],
    queryFn: async () => (await supabase
      .from("testes_catalogo")
      .select("id, nome, dominio:dominios_cognitivos(nome)")
      .eq("ativo", true)
      .order("nome")).data ?? [],
  });

  const { data: modelos } = useQuery({
    enabled: open,
    queryKey: ["baterias-modelo-ativas"],
    queryFn: async () => (await supabase
      .from("baterias_modelo")
      .select("id, nome, demanda, faixa_etaria, descricao")
      .eq("ativo", true)
      .order("demanda")
      .order("nome")).data ?? [],
  });

  const { data: itens } = useQuery({
    enabled: open && !!bateriaId,
    queryKey: ["bateria-modelo-itens", bateriaId],
    queryFn: async () => (await supabase
      .from("baterias_modelo_itens")
      .select("id, teste_id, ordem, obrigatorio, observacoes, teste:testes_catalogo(nome, dominio:dominios_cognitivos(nome))")
      .eq("bateria_id", bateriaId)
      .order("ordem")).data ?? [],
  });

  useEffect(() => {
    if (!itens) return;
    const next: Record<string, boolean> = {};
    itens.forEach((i: any) => { next[i.id] = !jaPlanejados.includes(i.teste_id); });
    setChecked(next);
  }, [itens, jaPlanejados]);

  const aplicar = useMutation({
    mutationFn: async () => {
      const escolhidos = (itens ?? []).filter((i: any) => checked[i.id] && !jaPlanejados.includes(i.teste_id));
      // Evita duplicar avulsos que já estão no modelo escolhido ou já planejados
      const idsModelo = new Set(escolhidos.map((i: any) => i.teste_id));
      const avulsosLimpos = avulsos.filter((tid) => !jaPlanejados.includes(tid) && !idsModelo.has(tid));
      if (escolhidos.length === 0 && avulsosLimpos.length === 0) throw new Error("Selecione ao menos um teste");
      let ordem = jaPlanejados.length;
      const payload = [
        ...escolhidos.map((i: any) => ({
          avaliacao_id: avaliacaoId,
          teste_id: i.teste_id,
          status: "planejado",
          ordem: ordem++,
          observacoes: i.observacoes || null,
        })),
        ...avulsosLimpos.map((tid) => ({
          avaliacao_id: avaliacaoId,
          teste_id: tid,
          status: "planejado",
          ordem: ordem++,
          observacoes: null,
        })),
      ];
      const { error } = await supabase.from("bateria_itens").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} teste(s) adicionado(s) à bateria`);
      qc.invalidateQueries({ queryKey: ["bateria", avaliacaoId] });
      onOpenChange(false);
      setBateriaId(""); setChecked({}); setAvulsos([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const porDemanda = useMemo(() => {
    const m = new Map<string, any[]>();
    (modelos ?? []).forEach((m0: any) => {
      const d = m0.demanda || "Outras";
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(m0);
    });
    return Array.from(m.entries());
  }, [modelos]);

  // Avulsos ainda não planejados (para contagem/inserção)
  const avulsosNovos = useMemo(
    () => avulsos.filter((tid) => !jaPlanejados.includes(tid)),
    [avulsos, jaPlanejados],
  );
  const modeloCount = Object.entries(checked).filter(([id, v]) => {
    if (!v) return false;
    const it = (itens ?? []).find((i: any) => i.id === id);
    return it && !jaPlanejados.includes(it.teste_id) && !avulsosNovos.includes(it.teste_id);
  }).length;
  const selecionadoCount = modeloCount + avulsosNovos.length;

  const catalogoDisponivel = useMemo(
    () => (catalogo ?? []).filter((t: any) => !jaPlanejados.includes(t.id) && !avulsos.includes(t.id)),
    [catalogo, jaPlanejados, avulsos],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4" />Bateria modelo + testes avulsos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Demanda / modelo</Label>
            <Select value={bateriaId} onValueChange={setBateriaId}>
              <SelectTrigger><SelectValue placeholder="Escolher modelo de bateria" /></SelectTrigger>
              <SelectContent className="max-h-96">
                {porDemanda.map(([dem, lista]) => (
                  <div key={dem}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{dem}</div>
                    {lista.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}{m.faixa_etaria ? ` · ${m.faixa_etaria}` : ""}
                      </SelectItem>
                    ))}
                  </div>
                ))}
                {(!modelos || modelos.length === 0) && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma bateria cadastrada. Crie em Configurações → Baterias.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {bateriaId && (
            <div className="rounded-md border max-h-80 overflow-auto">
              {(itens ?? []).map((i: any) => {
                const ja = jaPlanejados.includes(i.teste_id);
                return (
                  <label
                    key={i.id}
                    className={`flex items-start gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${ja ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={!!checked[i.id] && !ja}
                      disabled={ja}
                      onCheckedChange={(v) => setChecked({ ...checked, [i.id]: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {i.teste?.nome}
                        {i.obrigatorio && <Badge variant="outline" className="text-[9px]">obrigatório</Badge>}
                        {ja && <Badge variant="outline" className="text-[9px]">já planejado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.teste?.dominio?.nome ?? "—"}
                        {i.observacoes ? ` · ${i.observacoes}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
              {(itens ?? []).length === 0 && (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">Esta bateria não tem itens cadastrados.</div>
              )}
            </div>
          )}

          {bateriaId && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />Marque/desmarque os testes do modelo que deseja aplicar para este paciente.
            </p>
          )}

          {/* Testes avulsos — somam-se ao modelo (ou podem ser usados sozinhos) */}
          <div className="space-y-2 border-t pt-3">
            <Label>Testes avulsos (opcional)</Label>
            <Select value="" onValueChange={(tid) => tid && setAvulsos((a) => [...a, tid])}>
              <SelectTrigger>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Plus className="w-3.5 h-3.5" />Adicionar teste do catálogo
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {catalogoDisponivel.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}{t.dominio?.nome ? ` — ${t.dominio.nome}` : ""}
                  </SelectItem>
                ))}
                {catalogoDisponivel.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">Todos os testes do catálogo já foram adicionados.</div>
                )}
              </SelectContent>
            </Select>
            {avulsos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {avulsos.map((tid) => {
                  const t: any = (catalogo ?? []).find((c: any) => c.id === tid);
                  return (
                    <Badge key={tid} variant="secondary" className="gap-1 pr-1">
                      {t?.nome ?? "Teste"}
                      <button type="button" onClick={() => setAvulsos((a) => a.filter((x) => x !== tid))} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => aplicar.mutate()} disabled={selecionadoCount === 0 || aplicar.isPending}>
            Confirmar ({selecionadoCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
