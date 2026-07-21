import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { parseOFX } from "@/lib/ofx-parser";
import {
  sugerirReceita, sugerirDespesa,
  type IdentificadorRef, type PacienteRef, type ResponsavelRef, type FornecedorRef, type PlanoContaRef, type SublocadorRef,
} from "@/lib/extrato-matching";

export function ImportarExtrato({ onImportado }: { onImportado?: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [contaId, setContaId] = useState<string>("");
  const [processando, setProcessando] = useState(false);
  const [resumo, setResumo] = useState<{ novas: number; duplicadas: number; total: number } | null>(null);

  const { data: contas } = useQuery({
    queryKey: ["extrato-contas"],
    queryFn: async () => (await supabase.from("contas_financeiras").select("id, nome").eq("ativo", true).order("ordem")).data ?? [],
  });

  async function processarArquivo(file: File) {
    if (!contaId) { toast.error("Selecione a conta bancária antes de importar"); return; }
    setProcessando(true);
    setResumo(null);
    try {
      const texto = await file.text();
      const { transacoes, periodoInicio, periodoFim } = parseOFX(texto);
      if (transacoes.length === 0) {
        toast.error("Nenhuma transação encontrada nesse arquivo OFX");
        return;
      }

      const [pacientesRes, responsaveisRes, fornecedoresRes, planoContasRes, sublocadoresRes, identificadoresRes, existentesRes] = await Promise.all([
        supabase.from("pacientes").select("id, nome"),
        supabase.from("responsaveis").select("nome, paciente_id"),
        supabase.from("fornecedores").select("id, nome, plano_conta_id").eq("ativo", true),
        supabase.from("plano_contas").select("id, nome, tipo").eq("ativo", true),
        supabase.from("sublocadores").select("id, nome"),
        supabase.from("extrato_identificadores").select("padrao, natureza, paciente_id, plano_conta_id, fornecedor_id, tipo_servico_id"),
        supabase.from("extrato_transacoes").select("fitid").eq("conta_financeira_id", contaId),
      ]);

      const pacientes = (pacientesRes.data ?? []) as PacienteRef[];
      const responsaveis = (responsaveisRes.data ?? []) as ResponsavelRef[];
      const fornecedores = (fornecedoresRes.data ?? []) as FornecedorRef[];
      const planoContas = (planoContasRes.data ?? []) as PlanoContaRef[];
      const sublocadores = (sublocadoresRes.data ?? []) as SublocadorRef[];
      const identificadores = (identificadoresRes.data ?? []) as IdentificadorRef[];
      const fitidsExistentes = new Set((existentesRes.data ?? []).map((r) => r.fitid));

      const novas = transacoes.filter((t) => !fitidsExistentes.has(t.fitid));
      const duplicadas = transacoes.length - novas.length;

      if (novas.length === 0) {
        toast.info(`Todas as ${transacoes.length} transações já haviam sido importadas`);
        setResumo({ novas: 0, duplicadas, total: transacoes.length });
        return;
      }

      const { data: lote, error: loteError } = await supabase
        .from("extrato_lotes")
        .insert({
          conta_financeira_id: contaId,
          nome_arquivo: file.name,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          total_linhas: transacoes.length,
          total_novas: novas.length,
          total_duplicadas: duplicadas,
        })
        .select("id")
        .single();
      if (loteError) throw loteError;

      const linhas = novas.map((t) => {
        const natureza: "receita" | "despesa" = t.valor > 0 ? "receita" : "despesa";
        const sugestao = natureza === "receita"
          ? sugerirReceita(t.descricao, { identificadores, responsaveis, pacientes, sublocadores, planoContas })
          : sugerirDespesa(t.descricao, { identificadores, fornecedores, planoContas });
        return {
          lote_id: lote.id,
          conta_financeira_id: contaId,
          fitid: t.fitid,
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          natureza,
          status: "pendente" as const,
          sugestao_origem: sugestao.origem,
          paciente_id: sugestao.pacienteId,
          plano_conta_id: sugestao.planoContaId,
          fornecedor_id: sugestao.fornecedorId,
          tipo_servico_id: sugestao.tipoServicoId,
        };
      });

      for (let i = 0; i < linhas.length; i += 200) {
        const { error } = await supabase.from("extrato_transacoes").insert(linhas.slice(i, i + 200));
        if (error) throw error;
      }

      setResumo({ novas: novas.length, duplicadas, total: transacoes.length });
      toast.success(`${novas.length} transação(ões) nova(s) importada(s) para revisão`);
      qc.invalidateQueries({ queryKey: ["extrato-transacoes"] });
      qc.invalidateQueries({ queryKey: ["extrato-lotes"] });
      onImportado?.();
    } catch (e: any) {
      toast.error("Erro ao importar: " + (e?.message ?? e));
    } finally {
      setProcessando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="glass">
      <CardContent className="pt-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <Label className="text-xs">Conta bancária do extrato</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {(contas ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Arquivo OFX do banco</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx"
              disabled={processando}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processarArquivo(f); }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
          </div>
        </div>

        {processando && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Lendo e classificando transações...
          </div>
        )}

        {resumo && !processando && (
          <div className="flex items-center gap-2 text-sm rounded-lg border p-3 bg-secondary/40">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>
              {resumo.total} transação(ões) lida(s) do arquivo — <strong>{resumo.novas} nova(s)</strong> enviada(s) para revisão
              {resumo.duplicadas > 0 && <> · {resumo.duplicadas} já importada(s) anteriormente</>}.
            </span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Upload className="w-3 h-3" />
          Nada é lançado automaticamente: as transações ficam em revisão na aba "Revisar e aprovar" até você confirmar cada uma.
        </p>
      </CardContent>
    </Card>
  );
}
