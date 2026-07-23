import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NivelConfig } from "@/lib/configuracoes-catalogo";

export type HubEntry = {
  key: string;
  label: string;
  grupo: string;
  descricao: string;
  nivel: NivelConfig;
  /** Rota própria (Link). Sem href, chama onOpen(key). */
  href?: string;
};

function EntryCard({ e, onOpen }: { e: HubEntry; onOpen: (key: string) => void }) {
  const inner = (
    <Card className="glass h-full cursor-pointer p-3.5 transition hover:shadow-elegant hover:ring-1 hover:ring-brand/30">
      <p className="text-sm font-medium leading-tight">{e.label}</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{e.descricao}</p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
        Abrir <ArrowRight className="h-3 w-3" />
      </span>
    </Card>
  );
  return e.href ? (
    <Link to={e.href}>{inner}</Link>
  ) : (
    <button type="button" className="text-left" onClick={() => onOpen(e.key)}>{inner}</button>
  );
}

/**
 * Página de entrada das Configurações: busca + essenciais em destaque +
 * avançadas agrupadas e recolhidas. Cada card explica o que é e quando usar.
 */
export function ConfiguracoesHub({ entries, onOpen }: { entries: HubEntry[]; onOpen: (key: string) => void }) {
  const [busca, setBusca] = useState("");
  const [verAvancadas, setVerAvancadas] = useState(false);

  const q = busca.trim().toLowerCase();
  const filtradas = q
    ? entries.filter((e) => (e.label + " " + e.descricao + " " + e.grupo).toLowerCase().includes(q))
    : null;

  const essenciais = entries.filter((e) => e.nivel === "essencial");
  const avancadas = entries.filter((e) => e.nivel === "avancado");
  const grupos = [...new Set(avancadas.map((e) => e.grupo))];

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar configuração… (ex.: valores, salas, categorias)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtradas ? (
        filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada encontrado para “{busca}”.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((e) => <EntryCard key={e.key} e={e} onOpen={onOpen} />)}
          </div>
        )
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Essencial</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {essenciais.map((e) => <EntryCard key={e.key} e={e} onOpen={onOpen} />)}
            </div>
          </section>

          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setVerAvancadas((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
            >
              Configurações avançadas
              <ChevronDown className={cn("h-4 w-4 transition-transform", verAvancadas && "rotate-180")} />
            </button>
            {verAvancadas && grupos.map((g) => (
              <div key={g} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{g}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {avancadas.filter((e) => e.grupo === g).map((e) => <EntryCard key={e.key} e={e} onOpen={onOpen} />)}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
