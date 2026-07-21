import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, parseISO } from "date-fns";
import { currency, type Etapa, type Lead } from "./types";

export function PipelineLista({
  etapas, leads, onSelect,
}: { etapas: Etapa[]; leads: Lead[]; onSelect: (lead: Lead) => void }) {
  const etapaPorId = new Map(etapas.map((e) => [e.id, e]));

  return (
    <Card className="glass">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Canal / origem</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Valor estimado</TableHead>
              <TableHead>Dias na etapa</TableHead>
              <TableHead>Próximo contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const etapa = etapaPorId.get(lead.etapa_id);
              const dias = differenceInDays(new Date(), parseISO(lead.etapa_atualizada_em));
              return (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => onSelect(lead)}>
                  <TableCell>
                    <p className="font-medium">{lead.nome}</p>
                    {lead.nome_paciente && <p className="text-xs text-muted-foreground">{lead.nome_paciente}</p>}
                  </TableCell>
                  <TableCell>
                    {etapa && <Badge style={{ backgroundColor: `${etapa.cor}22`, color: etapa.cor }}>{etapa.nome}</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <p>{lead.canal?.nome ?? "—"}</p>
                    {(lead.origem_detalhe || lead.indicador_nome || lead.utm_campaign) && (
                      <p className="text-xs truncate max-w-48">
                        {[lead.origem_detalhe, lead.indicador_nome && `Ind.: ${lead.indicador_nome}`, lead.utm_campaign && `Camp.: ${lead.utm_campaign}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.responsavel?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{lead.valor_estimado ? currency(lead.valor_estimado) : "—"}</TableCell>
                  <TableCell>{dias}d</TableCell>
                  <TableCell>{lead.proximo_contato_em ? format(parseISO(lead.proximo_contato_em), "dd/MM/yyyy") : "—"}</TableCell>
                </TableRow>
              );
            })}
            {leads.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum lead encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
