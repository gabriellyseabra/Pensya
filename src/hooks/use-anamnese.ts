import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { analisarAnamneseParcial, calcularRadarAnamnese, resumirSecaoAnamnese } from "@/lib/anamnese.functions";

export type AnamneseRow = {
  id: string;
  paciente_id: string;
  secoes_estruturadas: Record<string, Record<string, any>>;
  resumos_secao: Record<string, string>;
  insights_validados: Record<string, any>;
  radar_scores: Record<string, number>;
  campos_importados: Record<string, string[]>;
  modo_entrada: string | null;
  concluida_em: string | null;
};

const KEY = (id: string) => ["anamnese-inteligente", id] as const;

export function useAnamnese(pacienteId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(pacienteId),
    queryFn: async (): Promise<Partial<AnamneseRow>> => {
      const { data } = await supabase
        .from("paciente_pre_anamnese")
        .select("*")
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      return (data ?? {}) as any;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<AnamneseRow>) => {
      const current = query.data ?? {};
      const payload: any = {
        paciente_id: pacienteId,
        secoes_estruturadas: patch.secoes_estruturadas ?? current.secoes_estruturadas ?? {},
        resumos_secao: patch.resumos_secao ?? current.resumos_secao ?? {},
        insights_validados: patch.insights_validados ?? current.insights_validados ?? {},
        radar_scores: patch.radar_scores ?? current.radar_scores ?? {},
        campos_importados: patch.campos_importados ?? current.campos_importados ?? {},
        modo_entrada: patch.modo_entrada ?? current.modo_entrada ?? null,
        concluida_em: patch.concluida_em ?? current.concluida_em ?? null,
      };
      const { error } = await supabase
        .from("paciente_pre_anamnese")
        .upsert(payload, { onConflict: "paciente_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(pacienteId) }),
    onError: (e: any) => toast.error("Erro ao salvar anamnese: " + e.message),
  });

  return { anamnese: (query.data ?? {}) as Partial<AnamneseRow>, isLoading: query.isLoading, save };
}

/** Hook de insights em tempo real com debounce. */
export function useAnamneseInsights(pacienteId: string, secoes: Record<string, any>) {
  const analisar = useServerFn(analisarAnamneseParcial);
  const [insights, setInsights] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastHash, setLastHash] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hash = useMemo(() => {
    try {
      return JSON.stringify(secoes).length + ":" + Object.keys(secoes).length;
    } catch { return ""; }
  }, [secoes]);

  async function run(force = false) {
    if (!force && hash === lastHash) return;
    setLoading(true);
    try {
      const r = await analisar({ data: { paciente_id: pacienteId, secoes } });
      setInsights(r);
      setLastHash(hash);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar insights");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!hash || hash === lastHash) return;
    timer.current = setTimeout(() => { void run(); }, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  return { insights, loading, regenerate: () => run(true) };
}

export function useResumoSecao() {
  const resumir = useServerFn(resumirSecaoAnamnese);
  return useMutation({
    mutationFn: async (input: { secao_key: string; secao_titulo: string; dados: Record<string, any> }) => {
      return await resumir({ data: input });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRadarAnamnese() {
  const calc = useServerFn(calcularRadarAnamnese);
  return useMutation({
    mutationFn: async (input: { paciente_id: string; secoes: Record<string, any> }) => {
      return await calc({ data: input });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
