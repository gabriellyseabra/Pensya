import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, DoorOpen, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Agenda pública de salas para profissionais que sublocam.
 * Sem login: mostra apenas janelas livres/ocupadas, nunca nomes.
 */
export const Route = createFileRoute("/salas")({
  ssr: false,
  component: SalasPublicas,
});

type Sala = { id: string; nome: string; cor: string | null; capacidade: number | null };
type Janela = { sala_id: string; inicio: string; fim: string; tipo: string };
type Ocupacao = { sala_id: string; inicio: string; fim: string };
type Agenda = { salas: Sala[]; janelas: Janela[]; ocupacoes: Ocupacao[] };

type Slot = { inicio: Date; fim: Date; status: "livre" | "ocupado" };

/** Subtrai intervalos ocupados/bloqueados das janelas disponíveis do dia. */
function slotsDoDia(dia: Date, salaId: string, agenda: Agenda): Slot[] {
  const d0 = new Date(dia); d0.setHours(0, 0, 0, 0);
  const d1 = addDays(d0, 1);
  const clamp = (x: Date) => new Date(Math.min(Math.max(x.getTime(), d0.getTime()), d1.getTime()));

  const disponiveis = agenda.janelas
    .filter((j) => j.sala_id === salaId && j.tipo === "disponivel")
    .map((j) => ({ inicio: clamp(new Date(j.inicio)), fim: clamp(new Date(j.fim)) }))
    .filter((j) => j.fim > j.inicio);

  const indisponiveis = [
    ...agenda.janelas.filter((j) => j.sala_id === salaId && j.tipo === "bloqueada"),
    ...agenda.ocupacoes.filter((o) => o.sala_id === salaId),
  ]
    .map((j) => ({ inicio: clamp(new Date(j.inicio)), fim: clamp(new Date(j.fim)) }))
    .filter((j) => j.fim > j.inicio)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const slots: Slot[] = [];
  for (const disp of disponiveis.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    let cursor = disp.inicio;
    for (const ind of indisponiveis) {
      if (ind.fim <= cursor || ind.inicio >= disp.fim) continue;
      if (ind.inicio > cursor) slots.push({ inicio: cursor, fim: ind.inicio, status: "livre" });
      slots.push({ inicio: new Date(Math.max(ind.inicio.getTime(), cursor.getTime())), fim: new Date(Math.min(ind.fim.getTime(), disp.fim.getTime())), status: "ocupado" });
      cursor = new Date(Math.min(ind.fim.getTime(), disp.fim.getTime()));
    }
    if (cursor < disp.fim) slots.push({ inicio: cursor, fim: disp.fim, status: "livre" });
  }
  // Ocupações fora de janela "disponível" também aparecem, para contexto
  for (const ind of indisponiveis) {
    const coberta = slots.some((s) => s.status === "ocupado" && s.inicio <= ind.inicio && s.fim >= ind.fim);
    if (!coberta && disponiveis.length === 0) slots.push({ ...ind, status: "ocupado" });
  }
  return slots.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

function SalasPublicas() {
  const [semana, setSemana] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const dias = Array.from({ length: 6 }, (_, i) => addDays(semana, i)); // seg–sáb

  const { data: agenda, isLoading } = useQuery({
    queryKey: ["salas-publicas", format(semana, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("salas_agenda_publica", {
        _de: format(semana, "yyyy-MM-dd"),
        _ate: format(addDays(semana, 6), "yyyy-MM-dd"),
      });
      if (error) throw new Error(error.message);
      return data as unknown as Agenda;
    },
  });

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-20 border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/logo-nave.png" alt="Nave" className="h-9 w-9 object-contain" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nave Desenvolvimento</p>
            <p className="font-display text-base font-semibold">Disponibilidade das salas</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSemana(addDays(semana, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">
              {format(dias[0], "dd/MM")} – {format(dias[5], "dd/MM")}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setSemana(addDays(semana, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <div className="glass flex items-start gap-2 rounded-2xl border border-border/60 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p>
            Horários <span className="font-medium text-foreground">livres</span> podem ser reservados
            diretamente com a administração da clínica. Esta página mostra apenas a disponibilidade —
            nenhum dado de paciente ou profissional é exibido.
          </p>
        </div>

        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}

        {agenda?.salas.map((sala) => (
          <section key={sala.id} className="glass rounded-2xl border border-border/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <DoorOpen className="h-4 w-4" style={{ color: sala.cor ?? undefined }} />
              {sala.nome}
              {sala.capacidade ? (
                <span className="text-xs font-normal text-muted-foreground">até {sala.capacidade} pessoas</span>
              ) : null}
            </h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {dias.map((dia) => {
                const slots = slotsDoDia(dia, sala.id, agenda);
                return (
                  <div key={dia.toISOString()} className="rounded-xl bg-secondary/50 p-2">
                    <p className="mb-1.5 text-center text-xs font-medium capitalize">
                      {format(dia, "EEE dd/MM", { locale: ptBR })}
                    </p>
                    <div className="space-y-1">
                      {slots.length === 0 && (
                        <p className="py-2 text-center text-[11px] text-muted-foreground">sem horários</p>
                      )}
                      {slots.map((s, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-lg px-2 py-1 text-center text-[11px] font-medium tabular-nums",
                            s.status === "livre"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground line-through",
                          )}
                        >
                          {format(s.inicio, "HH:mm")}–{format(s.fim, "HH:mm")}
                          {s.status === "ocupado" ? " ocupado" : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {agenda && agenda.salas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma sala cadastrada.</p>
        )}
      </main>
    </div>
  );
}
