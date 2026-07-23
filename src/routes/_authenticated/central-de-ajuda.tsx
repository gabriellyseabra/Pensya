import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LifeBuoy,
  Search,
  ArrowLeft,
  ChevronRight,
  Mail,
  Lightbulb,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHero } from "@/components/shared/PageHero";
import { useRoles } from "@/hooks/use-role";
import { useTutorialGuiado } from "@/lib/tutorial-guiado";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_AJUDA,
  type ArtigoAjuda,
  type BlocoAjuda,
  type CategoriaAjuda,
} from "@/lib/central-ajuda-conteudo";

export const Route = createFileRoute("/_authenticated/central-de-ajuda")({
  validateSearch: (s: Record<string, unknown>): { categoria?: string } => ({
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
  component: CentralAjudaPage,
});

/** Busca sem sensibilidade a acentos/maiúsculas. */
function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function textoDoArtigo(a: ArtigoAjuda) {
  return a.corpo.map((b) => (b.t === "passos" ? b.itens.join(" ") : b.texto)).join(" ");
}

function CentralAjudaPage() {
  const { categoria } = Route.useSearch();
  const navigate = useNavigate();
  const { isTerapeutaRestrito } = useRoles();
  const [busca, setBusca] = useState("");

  // Terapeuta com acesso restrito só vê conteúdo das áreas que ela acessa —
  // mesmas regras das telas do sistema.
  const categorias = useMemo(() => {
    if (!isTerapeutaRestrito) return CATEGORIAS_AJUDA;
    return CATEGORIAS_AJUDA.filter((c) => !c.gestao)
      .map((c) => ({
        ...c,
        artigos: c.artigos.filter((a) => !a.gestao),
      }))
      .filter((c) => c.artigos.length > 0);
  }, [isTerapeutaRestrito]);

  const categoriaAtiva = categoria ? categorias.find((c) => c.id === categoria) : undefined;

  const q = normalizar(busca.trim());
  const resultados = useMemo(() => {
    if (!q) return [];
    return categorias.flatMap((c) =>
      c.artigos
        .filter((a) => normalizar(a.titulo + " " + textoDoArtigo(a)).includes(q))
        .map((a) => ({ categoria: c, artigo: a })),
    );
  }, [q, categorias]);

  const abrirCategoria = (id?: string) => {
    setBusca("");
    navigate({ to: "/central-de-ajuda", search: id ? { categoria: id } : {} });
  };

  const totalArtigos = categorias.reduce((n, c) => n + c.artigos.length, 0);

  return (
    <div className="space-y-6">
      <PageHero
        icon={LifeBuoy}
        eyebrow="Suporte"
        title="Central de ajuda"
        description="Guias rápidos sobre cada área do Pensya, organizados para o dia a dia da sua equipe."
        variant="dark"
      />

      {/* Busca */}
      <div className="relative mx-auto w-full max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar entre ${totalArtigos} artigos — ex.: “agenda”, “convite”, “contrato”...`}
          className="glass h-12 rounded-2xl border-border/60 pl-11 text-base shadow-soft"
        />
      </div>

      {q ? (
        <ResultadosBusca resultados={resultados} onAbrirCategoria={abrirCategoria} />
      ) : categoriaAtiva ? (
        <CategoriaDetalhe
          categorias={categorias}
          ativa={categoriaAtiva}
          onAbrirCategoria={abrirCategoria}
        />
      ) : (
        <GradeCategorias categorias={categorias} onAbrirCategoria={abrirCategoria} />
      )}

      <CardTutorial />
      <CardContato restrito={isTerapeutaRestrito} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function GradeCategorias({
  categorias,
  onAbrirCategoria,
}: {
  categorias: CategoriaAjuda[];
  onAbrirCategoria: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categorias.map((c, i) => (
        <button
          key={c.id}
          onClick={() => onAbrirCategoria(c.id)}
          className="animate-fade-up group text-left"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <Card className="glass h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-elegant">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground shadow-soft">
                <c.icon className="h-5 w-5" />
              </div>
              {c.gestao && (
                <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> Gestão
                </Badge>
              )}
            </div>
            <h3 className="mt-3 font-medium leading-snug">{c.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.descricao}</p>
            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-brand">
              {c.artigos.length} {c.artigos.length === 1 ? "artigo" : "artigos"}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          </Card>
        </button>
      ))}
    </div>
  );
}

function CategoriaDetalhe({
  categorias,
  ativa,
  onAbrirCategoria,
}: {
  categorias: CategoriaAjuda[];
  ativa: CategoriaAjuda;
  onAbrirCategoria: (id?: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => onAbrirCategoria(undefined)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Todas as categorias
      </Button>

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        {/* Navegação lateral entre categorias */}
        <nav className="hidden md:block">
          <Card className="glass p-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => onAbrirCategoria(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
                  c.id === ativa.id
                    ? "bg-brand/10 font-medium text-brand"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <c.icon />
                <span className="truncate">{c.titulo}</span>
              </button>
            ))}
          </Card>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground shadow-soft">
              <ativa.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-display leading-tight">{ativa.titulo}</h2>
              <p className="text-sm text-muted-foreground">{ativa.descricao}</p>
            </div>
          </div>

          <Card className="glass px-5 py-1">
            <Accordion type="single" collapsible>
              {ativa.artigos.map((a) => (
                <AccordionItem key={a.id} value={a.id} className="border-border/50">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      {a.titulo}
                      {a.gestao && !ativa.gestao && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] font-normal text-muted-foreground"
                        >
                          <ShieldCheck className="h-3 w-3" /> Gestão
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CorpoArtigo corpo={a.corpo} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultadosBusca({
  resultados,
  onAbrirCategoria,
}: {
  resultados: { categoria: CategoriaAjuda; artigo: ArtigoAjuda }[];
  onAbrirCategoria: (id: string) => void;
}) {
  if (resultados.length === 0) {
    return (
      <Card className="glass mx-auto max-w-2xl p-8 text-center">
        <p className="font-medium">Nenhum artigo encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tente outra palavra — ou navegue pelas categorias abaixo do campo de busca.
        </p>
      </Card>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className="text-sm text-muted-foreground">
        {resultados.length} {resultados.length === 1 ? "artigo encontrado" : "artigos encontrados"}
      </p>
      <Card className="glass px-5 py-1">
        <Accordion type="single" collapsible>
          {resultados.map(({ categoria, artigo }) => (
            <AccordionItem
              key={`${categoria.id}-${artigo.id}`}
              value={`${categoria.id}-${artigo.id}`}
              className="border-border/50"
            >
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>{artigo.titulo}</span>
                  <span className="flex items-center gap-1 text-xs font-normal text-brand">
                    <categoria.icon className="h-3 w-3" /> {categoria.titulo}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <CorpoArtigo corpo={artigo.corpo} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-brand"
                  onClick={() => onAbrirCategoria(categoria.id)}
                >
                  Ver categoria {categoria.titulo} <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function CorpoArtigo({ corpo }: { corpo: BlocoAjuda[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {corpo.map((b, i) => {
        if (b.t === "passos") {
          return (
            <ol key={i} className="space-y-1.5">
              {b.itens.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                    {j + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (b.t === "dica") {
          return (
            <div key={i} className="flex gap-2.5 rounded-xl border border-brand/20 bg-brand/5 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>{b.texto}</p>
            </div>
          );
        }
        return <p key={i}>{b.texto}</p>;
      })}
    </div>
  );
}

function CardTutorial() {
  const navigate = useNavigate();
  const { reabrir } = useTutorialGuiado();
  return (
    <Card className="glass p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">Tutorial guiado</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Um tour passo a passo pelo sistema usando a Sofia, a paciente modelo com a ficha
              completa. Se você dispensou o tutorial, pode retomá-lo daqui.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => {
            reabrir();
            navigate({ to: "/dashboard" });
          }}
        >
          Retomar tutorial <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function CardContato({ restrito }: { restrito: boolean }) {
  return (
    <Card className="glass p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium">Ainda precisa de ajuda?</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {restrito
              ? "Dúvidas sobre permissões, vínculos de pacientes ou dados da clínica são resolvidas pela administradora da sua clínica. Para problemas no sistema, fale com o suporte do Pensya."
              : "Não encontrou o que procurava? Fale com o suporte do Pensya — respondemos o quanto antes."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild className="gradient-brand text-brand-foreground">
            <a href="mailto:contato@pensya.com.br">
              <Mail className="mr-2 h-4 w-4" /> Falar com o suporte
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
