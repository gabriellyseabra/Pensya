import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Departamento, Processo } from "./types";
import { STATUS_PROCESSO, progressoProcesso } from "./types";

interface Props {
  departamentos: Departamento[];
  processos: Processo[];
  equipe: { id: string; nome: string | null }[];
  onSelect: (p: Processo) => void;
}

export function ProcessosTabela({ departamentos, processos, equipe, onSelect }: Props) {
  const nomePorId = (id: string | null) => (id ? equipe.find((e) => e.id === id)?.nome ?? "—" : "—");
  const semDep = processos.filter((p) => !p.departamento_id && !p.parent_id);

  return (
    <div className="space-y-3">
      {departamentos.map((d) => (
        <Grupo
          key={d.id} nome={d.nome} cor={d.cor}
          processos={processos.filter((p) => p.departamento_id === d.id && !p.parent_id)}
          nomePorId={nomePorId} onSelect={onSelect}
        />
      ))}
      {semDep.length > 0 && (
        <Grupo nome="Sem departamento" cor="#94a3b8" processos={semDep} nomePorId={nomePorId} onSelect={onSelect} />
      )}
    </div>
  );
}

function Grupo({
  nome, cor, processos, nomePorId, onSelect,
}: {
  nome: string; cor: string; processos: Processo[];
  nomePorId: (id: string | null) => string; onSelect: (p: Processo) => void;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors">
        {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
        <span className="text-sm font-semibold">{nome}</span>
        <Badge variant="secondary" className="text-[10px]">{processos.length}</Badge>
      </button>
      {aberto && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum processo.</TableCell></TableRow>
            )}
            {processos.map((p) => {
              const st = STATUS_PROCESSO.find((s) => s.value === p.status);
              const prog = progressoProcesso(p.conteudo);
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => onSelect(p)}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {p.emoji && <span>{p.emoji}</span>}
                      {p.titulo}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.categoria ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.frequencia ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{nomePorId(p.responsavel_id)}</TableCell>
                  <TableCell>{st && <Badge className={cn("text-[10px]", st.cor)}>{st.label}</Badge>}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {prog.total > 0 ? `${prog.pct}%` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
