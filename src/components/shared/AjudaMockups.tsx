import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  Download,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ============ Ilustracoes (mockups) das telas do Pensya ============ */
/* Usadas na Central de Ajuda (tutoriais) e no tour guiado "Conheca o Pensya". */

export function MockupFrame({
  children,
  legenda,
}: {
  children: React.ReactNode;
  legenda?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/40 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 h-4 flex-1 rounded bg-background/70" />
      </div>
      <div className="bg-gradient-to-b from-muted/20 to-transparent p-4">{children}</div>
      {legenda && (
        <figcaption className="border-t border-border/50 bg-muted/20 px-4 py-2 text-center text-[11px] text-muted-foreground">
          {legenda}
        </figcaption>
      )}
    </figure>
  );
}

const barra = "h-2 rounded-full bg-muted-foreground/15";

/** Cabeçalho reutilizável de tela: ícone da marca + título. */
function MockHeader({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-6 w-6 place-items-center rounded-lg gradient-brand text-[10px] text-brand-foreground">
        P
      </div>
      <span className="text-sm font-medium">{titulo}</span>
    </div>
  );
}

export function Mockup({ id }: { id: string }) {
  // Tela genérica: moldura com título e conteúdo esquemático.
  if (id.startsWith("tela:")) {
    const titulo = id.slice(5);
    return (
      <MockupFrame legenda={`Tela “${titulo}” no Pensya`}>
        <MockHeader titulo={titulo} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
              <div className={cn(barra, "w-1/2")} />
              <div className="mt-2 h-4 w-3/4 rounded bg-brand/15" />
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
            >
              <div className="h-5 w-5 rounded-full bg-muted-foreground/15" />
              <div className={cn(barra, "flex-1")} />
              <div className={cn(barra, "w-10")} />
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "menu-lateral") {
    return (
      <MockupFrame legenda="Menu lateral — recolhido nos ícones; expande no hover">
        <div className="flex gap-3">
          <div className="flex w-11 shrink-0 flex-col items-center gap-2 rounded-2xl bg-rail p-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-xl",
                  i === 0 ? "bg-white/20" : "bg-white/5",
                )}
              >
                <div className="h-3 w-3 rounded bg-white/50" />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-16 rounded-xl bg-lilac/20" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg border border-border/50 bg-background/50" />
              ))}
            </div>
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "papeis") {
    const papeis = [
      { nome: "Admin", cor: "bg-brand/15 text-brand" },
      { nome: "Profissional", cor: "bg-lilac/20 text-lilac-foreground" },
      { nome: "Secretária", cor: "bg-muted text-muted-foreground" },
    ];
    return (
      <MockupFrame legenda="Cada papel enxerga um conjunto diferente de páginas">
        <div className="grid grid-cols-3 gap-2">
          {papeis.map((p) => (
            <div key={p.nome} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", p.cor)}>
                {p.nome}
              </span>
              <div className={cn(barra, "mt-2.5 w-full")} />
              <div className={cn(barra, "mt-1.5 w-2/3")} />
              <div className={cn(barra, "mt-1.5 w-3/4")} />
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "agenda") {
    return (
      <MockupFrame legenda="Agenda semanal — clique num horário para marcar um atendimento">
        <div className="grid grid-cols-5 gap-1 text-center text-[9px] text-muted-foreground">
          {["Seg", "Ter", "Qua", "Qui", "Sex"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-5 gap-1">
          {Array.from({ length: 15 }).map((_, i) => {
            const destaque = i === 6 || i === 8;
            return (
              <div
                key={i}
                className={cn(
                  "h-6 rounded",
                  destaque ? "gradient-brand" : "border border-border/40 bg-background/40",
                )}
              />
            );
          })}
        </div>
      </MockupFrame>
    );
  }

  if (id === "ficha-paciente") {
    return (
      <MockupFrame legenda="Ficha do paciente — abas de cadastro, avaliação, plano e sessões">
        <div className="h-10 rounded-t-lg gradient-lilac" />
        <div className="flex items-center gap-2 px-1">
          <div className="-mt-4 h-10 w-10 rounded-2xl border-2 border-card bg-muted" />
          <div className="pt-1">
            <div className={cn(barra, "w-24")} />
            <div className={cn(barra, "mt-1 w-16")} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Cadastro", "Avaliação", "Plano", "Sessões", "Frequência", "Perfil"].map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                i === 0 ? "bg-brand/15 font-medium text-brand" : "bg-muted text-muted-foreground",
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "prontuario") {
    return (
      <MockupFrame legenda="Registro de sessão — evolução, recursos e vínculo com as metas">
        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Sessão · 14/03</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn("h-2 w-2 rounded-full", i < 4 ? "bg-brand" : "bg-muted")}
                />
              ))}
            </div>
          </div>
          <div className={cn(barra, "mt-2.5 w-full")} />
          <div className={cn(barra, "mt-1.5 w-5/6")} />
          <div className={cn(barra, "mt-1.5 w-2/3")} />
          <div className="mt-2.5 flex gap-1">
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] text-brand">
              Meta: Leitura
            </span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] text-brand">
              Meta: Escrita
            </span>
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "plano") {
    return (
      <MockupFrame legenda="Plano terapêutico — metas funcionais com escala GAS">
        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="text-xs font-medium">Ler textos curtos com autonomia</div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[8px]">
            {["-2", "-1", "0", "+1", "+2"].map((n, i) => (
              <div
                key={n}
                className={cn(
                  "rounded py-1",
                  i === 2
                    ? "gradient-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {n}
              </div>
            ))}
          </div>
          <div className={cn(barra, "mt-2.5 w-3/4")} />
        </div>
      </MockupFrame>
    );
  }

  if (id === "avaliacao") {
    const linhas = [
      { t: "TDE II — Leitura", p: "P10" },
      { t: "Cubos de Corsi", p: "P50" },
      { t: "Atenção (cancelamento)", p: "P22" },
    ];
    return (
      <MockupFrame legenda="Avaliação — testes aplicados com percentil e classificação">
        <div className="overflow-hidden rounded-lg border border-border/50">
          <div className="grid grid-cols-[1fr_50px] border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Teste</span>
            <span className="text-right">Perc.</span>
          </div>
          {linhas.map((l) => (
            <div
              key={l.t}
              className="grid grid-cols-[1fr_50px] items-center border-b border-border/30 px-3 py-2 last:border-0"
            >
              <span className="truncate text-xs">{l.t}</span>
              <span className="text-right text-[11px] font-medium text-brand">{l.p}</span>
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "tarefas") {
    const t = [
      { c: "bg-red-400", w: "w-3/4" },
      { c: "bg-amber-400", w: "w-2/3" },
      { c: "bg-emerald-400", w: "w-5/6" },
    ];
    return (
      <MockupFrame legenda="Tarefas — por responsável, prioridade e prazo">
        <div className="space-y-2">
          {t.map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
            >
              <span className="h-3.5 w-3.5 rounded border border-border" />
              <span className={cn("h-2 w-2 rounded-full", row.c)} />
              <div className={cn(barra, row.w)} />
              <span className="ml-auto text-[9px] text-muted-foreground">prazo</span>
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "portal") {
    return (
      <MockupFrame legenda="Portal da família — com a identidade da clínica">
        <div className="mx-auto max-w-xs rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg gradient-brand" />
            <div className={cn(barra, "w-20")} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["Evolução", "Diário", "Relatórios", "Financeiro"].map((s) => (
              <div
                key={s}
                className="rounded-lg border border-border/50 bg-background/50 p-2 text-[10px] text-muted-foreground"
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "cadastros") {
    return (
      <MockupFrame legenda="Cadastro público — a família preenche, a recepção converte">
        <div className="mx-auto max-w-xs space-y-2 rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-brand/10 px-2 py-1 text-[10px] text-brand">
            <Link2 className="h-3 w-3" /> pensya.app/cadastro/…
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className={cn(barra, "w-1/3")} />
              <div className="mt-1 h-6 rounded border border-border/50 bg-background/50" />
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "financeiro") {
    return (
      <MockupFrame legenda="Financeiro — entradas, saídas e resumo do período">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/50 p-2.5 dark:bg-emerald-400/10">
            <span className="text-[10px] text-muted-foreground">Entradas</span>
            <div className="mt-1 h-4 w-2/3 rounded bg-emerald-400/40" />
          </div>
          <div className="rounded-lg border border-red-300/40 bg-red-50/50 p-2.5 dark:bg-red-400/10">
            <span className="text-[10px] text-muted-foreground">Saídas</span>
            <div className="mt-1 h-4 w-1/2 rounded bg-red-400/40" />
          </div>
        </div>
        <div className="mt-2 flex items-end gap-1">
          {[6, 10, 7, 12, 9, 14].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-brand/30" style={{ height: h * 3 }} />
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "equipe") {
    const membros = [
      { p: "Admin", cor: "bg-brand/15 text-brand" },
      { p: "Profissional", cor: "bg-lilac/20 text-lilac-foreground" },
      { p: "Secretária", cor: "bg-muted text-muted-foreground" },
    ];
    return (
      <MockupFrame legenda="Equipe — convites, papéis e vínculo com pacientes">
        <div className="space-y-2">
          {membros.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
            >
              <div className="h-6 w-6 rounded-full bg-muted-foreground/15" />
              <div className="flex-1">
                <div className={cn(barra, "w-1/2")} />
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", m.cor)}>
                {m.p}
              </span>
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "contratos") {
    return (
      <MockupFrame legenda="Contratos — modelo preenchido automaticamente e link de assinatura">
        <div className="mx-auto max-w-[220px] rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm">
          <FileSpreadsheet className="h-4 w-4 text-brand" />
          <div className={cn(barra, "mt-2 w-full")} />
          <div className={cn(barra, "mt-1.5 w-5/6")} />
          <div className={cn(barra, "mt-1.5 w-2/3")} />
          <div className="mt-3 rounded-md gradient-brand py-1 text-center text-[10px] text-brand-foreground">
            Enviar para assinatura
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "configuracoes") {
    const itens = ["Identidade", "Catálogo clínico", "Financeiro", "IA", "Modalidades", "Escolas"];
    return (
      <MockupFrame legenda="Configurações — dados base da clínica em um hub">
        <div className="grid grid-cols-3 gap-2">
          {itens.map((it) => (
            <div key={it} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
              <div className="h-5 w-5 rounded-lg bg-brand/15" />
              <div className="mt-2 text-[10px] text-muted-foreground">{it}</div>
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "lista-pacientes") {
    return (
      <MockupFrame legenda="Página Pacientes — botão “Importar arquivo” no topo">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-lg gradient-brand text-brand-foreground">
              <span className="text-[10px]">P</span>
            </div>
            <span className="text-sm font-medium">Pacientes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand ring-2 ring-brand/40">
              <Upload className="h-3 w-3" /> Importar arquivo
            </span>
            <span className="rounded-lg gradient-brand px-2 py-1 text-[11px] text-brand-foreground">
              Novo paciente
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-2">
              <div className="h-6 w-6 rounded-full bg-muted-foreground/15" />
              <div className={cn(barra, "mt-2 w-3/4")} />
              <div className={cn(barra, "mt-1.5 w-1/2")} />
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  if (id === "dialog-abas") {
    return (
      <MockupFrame legenda="Janela de importação — abas “Enviar arquivo” e “Colar da planilha”">
        <div className="mx-auto max-w-md rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-brand" /> Importar pacientes
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1 text-[11px]">
            <span className="flex items-center justify-center gap-1 rounded-md bg-background py-1 font-medium shadow-sm">
              <Upload className="h-3 w-3" /> Enviar arquivo
            </span>
            <span className="flex items-center justify-center gap-1 rounded-md py-1 text-muted-foreground">
              <ClipboardPaste className="h-3 w-3" /> Colar da planilha
            </span>
          </div>
          <div className="mt-3 grid place-items-center gap-1 rounded-lg border-2 border-dashed border-border/60 p-6 text-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-[11px] text-brand underline">Selecionar arquivo</span>
            <span className="text-[10px] text-muted-foreground">
              .xlsx, .xls, .csv — inclusive SisClin
            </span>
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "modelo") {
    return (
      <MockupFrame legenda="“Baixar modelo de planilha” — arquivo pronto com as colunas certas">
        <div className="mx-auto max-w-md rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="grid place-items-center gap-1 rounded-lg border-2 border-dashed border-border/60 p-5 text-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-[11px] text-brand underline">Selecionar arquivo</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Não tem uma planilha pronta?</span>
            <span className="flex items-center gap-1 font-medium text-brand ring-2 ring-brand/40 rounded-md px-1.5 py-0.5">
              <Download className="h-3 w-3" /> Baixar modelo de planilha
            </span>
          </div>
        </div>
      </MockupFrame>
    );
  }

  if (id === "preview-tabela") {
    const linhas = [
      { nome: "Alicia dos Santos", nasc: "27/01/2021" },
      { nome: "João da Costa", nasc: "26/09/2018" },
      { nome: "Rafael Romano", nasc: "30/01/2018" },
    ];
    return (
      <MockupFrame legenda="Preview editável — cada linha vira um paciente; “Mais dados” abre os campos extras">
        <div className="overflow-hidden rounded-lg border border-border/50">
          <div className="grid grid-cols-[20px_1fr_90px_90px] items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span />
            <span>Nome</span>
            <span>Nascimento</span>
            <span>Mais dados</span>
          </div>
          {linhas.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[20px_1fr_90px_90px] items-center gap-2 border-b border-border/30 px-3 py-2 last:border-0"
            >
              <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-brand text-[8px] text-brand-foreground">
                ✓
              </span>
              <span className="truncate text-xs font-medium">{l.nome}</span>
              <span className="text-[11px] text-muted-foreground">{l.nasc}</span>
              <span className="w-fit rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] text-brand">
                +7 campos
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <span className="rounded-lg gradient-brand px-3 py-1.5 text-[11px] text-brand-foreground">
            Confirmar e criar 3 pacientes
          </span>
        </div>
      </MockupFrame>
    );
  }

  if (id === "confirmar") {
    return (
      <MockupFrame legenda="Pronto! Os pacientes entram na lista, com escolas e diagnósticos criados automaticamente">
        <div className="mx-auto max-w-sm space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">5 pacientes criados · 2 escolas</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
            >
              <div className="h-6 w-6 rounded-full bg-muted-foreground/15" />
              <div className="flex-1">
                <div className={cn(barra, "w-2/3")} />
                <div className={cn(barra, "mt-1 w-1/3")} />
              </div>
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] text-brand">
                ativo
              </span>
            </div>
          ))}
        </div>
      </MockupFrame>
    );
  }

  return null;
}
