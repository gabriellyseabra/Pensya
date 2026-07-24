import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, GraduationCap, CalendarClock } from "lucide-react";
import { usePortal, primeiroNome } from "@/components/portal/portal-context";
import { portalDocumentos, type PortalDocumento } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/portal/documentos")({
  component: PortalDocumentos,
});

function PortalDocumentos() {
  const { paciente } = usePortal();
  const pid = paciente.paciente_id;

  const { data: docs, isLoading } = useQuery({
    queryKey: ["portal-documentos", pid],
    queryFn: () => portalDocumentos(pid),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Materiais e roteiros</h1>
        <p className="text-sm text-muted-foreground">
          Documentos que a equipe compartilhou para acompanhar {primeiroNome(paciente.nome)} em casa.
        </p>
      </div>

      {!isLoading && (docs ?? []).length === 0 && (
        <Card className="glass"><CardContent className="pt-6 text-sm text-muted-foreground">
          Nenhum material compartilhado ainda. Quando a equipe publicar um roteiro de estudos ou orientação,
          ele aparecerá aqui.
        </CardContent></Card>
      )}

      {(docs ?? []).map((d) => <DocumentoCard key={d.id} doc={d} />)}
    </div>
  );
}

function DocumentoCard({ doc }: { doc: PortalDocumento }) {
  const Icon = doc.tipo === "roteiro_estudos" ? GraduationCap : FileText;
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-brand" /> {doc.titulo}
        </CardTitle>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </CardHeader>
      <CardContent>
        {doc.tipo === "roteiro_estudos" ? <Roteiro c={doc.conteudo} /> : <Generico c={doc.conteudo} />}
      </CardContent>
    </Card>
  );
}

function Roteiro({ c }: { c: any }) {
  const cronograma = Array.isArray(c?.cronograma) ? c.cronograma : [];
  const estrategias = Array.isArray(c?.estrategias) ? c.estrategias : [];
  const familia = Array.isArray(c?.familia) ? c.familia : [];
  return (
    <div className="space-y-4">
      {(c?.ano || (Array.isArray(c?.perfil) && c.perfil.length > 0)) && (
        <div className="flex flex-wrap gap-1.5">
          {c?.ano && <Badge variant="secondary" className="font-normal">{c.ano}</Badge>}
          {Array.isArray(c?.perfil) && c.perfil.map((p: string) => (
            <Badge key={p} variant="outline" className="font-normal">{p}</Badge>
          ))}
        </div>
      )}

      {c?.resumo && <p className="text-sm leading-relaxed">{c.resumo}</p>}

      {cronograma.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Cronograma da semana</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {cronograma.map((d: any, i: number) => (
              <div key={i} className="rounded-xl bg-secondary/60 p-3">
                <p className="text-xs font-semibold capitalize">{d.dia}</p>
                <ul className="mt-1 space-y-0.5">
                  {(d.blocos ?? []).map((b: any, j: number) => (
                    <li key={j} className="text-xs text-muted-foreground">
                      • {b.atividade} <span className="text-[10px]">({b.minutos} min)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {estrategias.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Estratégias por disciplina</h3>
          <div className="space-y-2">
            {estrategias.map((s: any, i: number) => (
              <div key={i}>
                <p className="text-xs font-semibold">{s.disciplina}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {(s.itens ?? []).map((it: string, j: number) => (
                    <li key={j} className="text-xs text-muted-foreground">• {it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {familia.length > 0 && (
        <div className="rounded-xl bg-accent/60 p-3">
          <h3 className="mb-1 text-sm font-semibold text-accent-foreground">Como a família pode ajudar</h3>
          <ul className="space-y-0.5">
            {familia.map((f: string, i: number) => (
              <li key={i} className="text-xs">• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Generico({ c }: { c: any }) {
  if (c?.html) return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: String(c.html) }} />;
  if (c?.texto) return <p className="whitespace-pre-wrap text-sm">{String(c.texto)}</p>;
  return <p className="text-sm text-muted-foreground">Material sem pré-visualização.</p>;
}
