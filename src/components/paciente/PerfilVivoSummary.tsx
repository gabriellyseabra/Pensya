import { useState } from "react";
import { usePerfilVivo } from "@/hooks/use-perfil-vivo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart, AlertTriangle, ThumbsUp, ThumbsDown, Sparkles, Target,
  ChevronDown, ChevronUp,
} from "lucide-react";

/**
 * Resumo somente-leitura do Perfil Clínico Vivo — usado no ResumoTab
 * como cartões de leitura rápida. Pode ser minimizado pelo usuário.
 */
export function PerfilVivoSummary({ pacienteId }: { pacienteId: string }) {
  const { perfil, isLoading } = usePerfilVivo(pacienteId);
  const [open, setOpen] = useState(true);
  if (isLoading) return null;

  const empty =
    !perfil.reforcadores?.length &&
    !perfil.barreiras?.length &&
    !perfil.estrategias_funcionam?.length &&
    !perfil.hipoteses_ativas?.length &&
    !perfil.interesses?.length;

  return (
    <Card className="glass border-brand/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand" />Perfil Clínico Vivo</span>
          <Button size="sm" variant="ghost" onClick={() => setOpen(v => !v)} className="h-7 px-2 text-xs">
            {open ? <><ChevronUp className="w-3 h-3 mr-1" />Minimizar</> : <><ChevronDown className="w-3 h-3 mr-1" />Expandir</>}
          </Button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          {empty ? (
            <p className="text-sm text-muted-foreground">
              Perfil Clínico Vivo ainda não preenchido — preencha na aba <em>Perfil Clínico Vivo</em>.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Mini icon={<Heart className="w-4 h-4 text-emerald-600" />} title="Reforçadores" items={(perfil.reforcadores ?? []).map((r) => r.descricao)} />
              <Mini icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Barreiras" items={(perfil.barreiras ?? []).map((b) => b.descricao)} />
              <Mini icon={<Sparkles className="w-4 h-4 text-violet-600" />} title="Interesses" items={perfil.interesses ?? []} />
              <Mini icon={<ThumbsUp className="w-4 h-4 text-emerald-600" />} title="O que funciona" items={perfil.estrategias_funcionam ?? []} />
              <Mini icon={<ThumbsDown className="w-4 h-4 text-rose-600" />} title="O que não funciona" items={perfil.estrategias_nao_funcionam ?? []} />
              <Mini icon={<Target className="w-4 h-4 text-brand" />} title="Hipóteses ativas" items={perfil.hipoteses_ativas ?? []} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Mini({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <p className="text-xs font-medium flex items-center gap-2 mb-2">{icon}{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.slice(0, 8).map((v, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{v}</Badge>
          ))}
          {items.length > 8 && <Badge variant="outline" className="text-xs">+{items.length - 8}</Badge>}
        </div>
      )}
    </div>
  );
}
