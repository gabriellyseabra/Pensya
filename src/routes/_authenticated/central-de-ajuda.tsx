import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LifeBuoy,
  Search,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Mail,
  Lightbulb,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  CheckCircle2,
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
import { Mockup } from "@/components/shared/AjudaMockups";
import { useRoles } from "@/hooks/use-role";
import { useTour } from "@/components/shared/TourGuiado";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_AJUDA,
  type ArtigoAjuda,
  type BlocoAjuda,
  type CategoriaAjuda,
} from "@/lib/central-ajuda-conteudo";

export const Route = createFileRoute("/_authenticated/central-de-ajuda")({
  validateSearch: (s: Record<string, unknown>): { categoria?: string; artigo?: string } => ({
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
    artigo: typeof s.artigo === "string" ? s.artigo : undefined,
  }),
  component: CentralAjudaPage,
});

/** Busca sem sensibilidade a acentos/maiúsculas. */
function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function textoDoArtigo(a: ArtigoAjuda) {
  const corpo = a.corpo.map((b) => (b.t === "passos" ? b.itens.join(" ") : b.texto)).join(" ");
  const tut = a.tutorial
    ? [
        ...(a.tutorial.antesDeComecar ?? []),
        ...a.tutorial.passos.flatMap((p) => [p.titulo, p.descricao ?? ""]),
      ].join(" ")
    : "";
  return corpo + " " + tut;
}

function CentralAjudaPage() {
  const { categoria, artigo } = Route.useSearch();
  const navigate = useNavigate();
  const { isTerapeutaRestrito } = useRoles();
  const [busca, setBusca] = useState("");

  // Terapeuta com acesso restrito só vê conteúdo das áreas que ela acessa —
  // mesmas regras das telas do sistema.
  const categorias = useMemo(() => {
    if (!isTerapeutaRestrito) return CATEGORIAS_AJUDA;
    return CATEGORIAS_AJUDA.filter((c) => !c.gestao)
      .map((c) => ({ ...c, artigos: c.artigos.filter((a) => !a.gestao) }))
      .filter((c) => c.artigos.length > 0);
  }, [isTerapeutaRestrito]);

  const categoriaAtiva = categoria ? categorias.find((c) => c.id === categoria) : undefined;

  // Artigo aberto (tutorial de página inteira) — procura na categoria ativa e,
  // se não achar, em todas (o mesmo tutorial vive em mais de uma categoria).
  const artigoAtivo = useMemo(() => {
    if (!artigo) return undefined;
    const ordem = categoriaAtiva ? [categoriaAtiva, ...categorias] : categorias;
    for (const c of ordem) {
      const a = c.artigos.find((x) => x.id === artigo);
      if (a) return { categoria: c, artigo: a };
    }
    return undefined;
  }, [artigo, categoriaAtiva, categorias]);

  const q = normalizar(busca.trim());
  const resultados = useMemo(() => {
    if (!q) return [];
    return categorias.flatMap((c) =>
      c.artigos
        .filter((a) => normalizar(a.titulo + " " + textoDoArtigo(a)).includes(q))
        .map((a) => ({ categoria: c, artigo: a })),
    );
  }, [q, categorias]);

  const irPara = (search: { categoria?: string; artigo?: string }) => {
    setBusca("");
    navigate({ to: "/central-de-ajuda", search });
  };
  const abrirCategoria = (id?: string) => irPara(id ? { categoria: id } : {});
  const abrirArtigo = (catId: string, artId: string) => irPara({ categoria: catId, artigo: artId });

  const mostrandoTutorial = !q && !!artigoAtivo?.artigo.tutorial;
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

      {!mostrandoTutorial && (
        <div className="relative mx-auto w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar entre ${totalArtigos} artigos — ex.: “agenda”, “importar”, “contrato”...`}
            className="glass h-12 rounded-2xl border-border/60 pl-11 text-base shadow-soft"
          />
        </div>
      )}

      {q ? (
        <ResultadosBusca
          resultados={resultados}
          onAbrirCategoria={abrirCategoria}
          onAbrirArtigo={abrirArtigo}
        />
      ) : mostrandoTutorial && artigoAtivo ? (
        <TutorialDetalhe
          categoria={artigoAtivo.categoria}
          artigo={artigoAtivo.artigo}
          onVoltar={() => abrirCategoria(artigoAtivo.categoria.id)}
        />
      ) : categoriaAtiva ? (
        <CategoriaDetalhe
          categorias={categorias}
          ativa={categoriaAtiva}
          onAbrirCategoria={abrirCategoria}
          onAbrirArtigo={abrirArtigo}
        />
      ) : (
        <GradeCategorias categorias={categorias} onAbrirCategoria={abrirCategoria} />
      )}

      {!mostrandoTutorial && !q && (
        <>
          <CardTutorial />
          <CardContato restrito={isTerapeutaRestrito} />
        </>
      )}
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
  onAbrirArtigo,
}: {
  categorias: CategoriaAjuda[];
  ativa: CategoriaAjuda;
  onAbrirCategoria: (id?: string) => void;
  onAbrirArtigo: (catId: string, artId: string) => void;
}) {
  const tutoriais = ativa.artigos.filter((a) => a.tutorial);
  const simples = ativa.artigos.filter((a) => !a.tutorial);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => onAbrirCategoria(undefined)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Todas as categorias
      </Button>

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
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

          {/* Tutoriais detalhados — cards que abrem a página inteira */}
          {tutoriais.map((a) => (
            <button
              key={a.id}
              onClick={() => onAbrirArtigo(ativa.id, a.id)}
              className="group block w-full text-left"
            >
              <Card className="glass flex items-center gap-4 p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-elegant">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground shadow-soft">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-brand/15 text-[10px] text-brand hover:bg-brand/15">
                      Tutorial
                    </Badge>
                    {a.gestao && !ativa.gestao && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] font-normal text-muted-foreground"
                      >
                        <ShieldCheck className="h-3 w-3" /> Gestão
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-medium">{a.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.tutorial?.passos.length} passos · guia detalhado com ilustrações
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
              </Card>
            </button>
          ))}

          {simples.length > 0 && (
            <Card className="glass px-5 py-1">
              <Accordion type="single" collapsible>
                {simples.map((a) => (
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
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Tutorial detalhado (página inteira, estilo guia) ============ */

function TutorialDetalhe({
  categoria,
  artigo,
  onVoltar,
}: {
  categoria: CategoriaAjuda;
  artigo: ArtigoAjuda;
  onVoltar: () => void;
}) {
  const t = artigo.tutorial!;
  const resumo = artigo.corpo.find((b) => b.t === "p") as { texto: string } | undefined;

  const irParaPasso = (i: number) => {
    document.getElementById(`passo-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={onVoltar} className="hover:text-foreground">
          {categoria.titulo}
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{artigo.titulo}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* "Neste tutorial" — navegação por passos (sticky) */}
        <nav className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <Card className="glass p-3">
              <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Neste tutorial
              </p>
              {t.antesDeComecar && t.antesDeComecar.length > 0 && (
                <button
                  onClick={() =>
                    document
                      .getElementById("antes")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Antes de começar
                </button>
              )}
              {t.passos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => irParaPasso(i)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <span className="mt-px font-semibold text-brand">{i + 1}.</span>
                  <span className="truncate">{p.titulo}</span>
                </button>
              ))}
            </Card>
            <TutorialPromoCard />
          </div>
        </nav>

        <article className="min-w-0 space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-brand/15 text-[10px] uppercase tracking-wider text-brand hover:bg-brand/15">
                {categoria.titulo}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                <ListChecks className="h-3 w-3" /> {t.passos.length} passos
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-display leading-tight sm:text-3xl">
              {artigo.titulo}
            </h1>
            {resumo && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{resumo.texto}</p>
            )}
          </header>

          {/* Antes de começar */}
          {t.antesDeComecar && t.antesDeComecar.length > 0 && (
            <Card id="antes" className="glass scroll-mt-4 p-5">
              <h2 className="font-medium">Antes de começar</h2>
              <ul className="mt-3 space-y-2">
                {t.antesDeComecar.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Passos */}
          {t.passos.map((p, i) => (
            <section key={i} id={`passo-${i}`} className="scroll-mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-brand text-sm font-semibold text-brand-foreground shadow-soft">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-lg font-display leading-tight">{p.titulo}</h2>
                </div>
              </div>

              <div className="space-y-3 sm:pl-11">
                {p.descricao && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
                )}

                {p.campos && p.campos.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <p className="border-b border-border/50 bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Campos desta seção
                    </p>
                    <div className="divide-y divide-border/40">
                      {p.campos.map((c, j) => (
                        <div
                          key={j}
                          className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-[160px_1fr] sm:gap-3"
                        >
                          <span className="text-sm font-medium">{c.campo}</span>
                          <span className="text-sm text-muted-foreground">{c.descricao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {p.mockup && <Mockup id={p.mockup} />}

                {p.dica && (
                  <div className="flex gap-2.5 rounded-xl border border-amber-300/40 bg-amber-50/60 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{p.dica}</p>
                  </div>
                )}
              </div>
            </section>
          ))}

          {/* O que fazer depois */}
          {t.oQueFazerDepois && t.oQueFazerDepois.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-display">O que fazer depois</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {t.oQueFazerDepois.map((p, i) => (
                  <Card key={i} className="glass p-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <p className="mt-2 text-sm font-medium">{p.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.descricao}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <FeedbackTutorial artigoId={artigo.id} />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Ainda com dúvida sobre este passo a passo?
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="mailto:contato@pensya.com.br">
                <Mail className="mr-2 h-4 w-4" /> Falar com o suporte
              </a>
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}

function TutorialPromoCard() {
  const tour = useTour();
  return (
    <Card className="relative overflow-hidden bg-rail p-4 text-rail-foreground">
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-rail-active" />
        <p className="text-sm font-semibold">Tour guiado</p>
      </div>
      <p className="mt-1.5 text-xs text-white/70">
        Conheça o Pensya passo a passo pela Sofia, a paciente modelo com a ficha completa.
      </p>
      <Button
        size="sm"
        className="mt-3 w-full bg-white/15 text-white hover:bg-white/25"
        onClick={tour.iniciar}
      >
        Abrir tour
      </Button>
    </Card>
  );
}

function FeedbackTutorial({ artigoId }: { artigoId: string }) {
  const key = `ajuda-feedback-${artigoId}`;
  const [voto, setVoto] = useState<"sim" | "nao" | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(key);
    return v === "sim" || v === "nao" ? v : null;
  });

  const votar = (v: "sim" | "nao") => {
    setVoto(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-2 text-center">
      {voto ? (
        <p className="text-sm text-muted-foreground">
          Obrigado pelo retorno!{" "}
          {voto === "sim" ? "Que bom que ajudou. 💜" : "Vamos melhorar este guia."}
        </p>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">Este tutorial foi útil?</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => votar("sim")}>
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Sim
            </Button>
            <Button variant="outline" size="sm" onClick={() => votar("nao")}>
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Não
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* Ilustrações (mockups) movidas para components/shared/AjudaMockups.tsx */

/* ---------------------------------------------------------------- */

function ResultadosBusca({
  resultados,
  onAbrirCategoria,
  onAbrirArtigo,
}: {
  resultados: { categoria: CategoriaAjuda; artigo: ArtigoAjuda }[];
  onAbrirCategoria: (id: string) => void;
  onAbrirArtigo: (catId: string, artId: string) => void;
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
                  <span className="flex items-center gap-2">
                    {artigo.titulo}
                    {artigo.tutorial && (
                      <Badge className="bg-brand/15 text-[9px] text-brand hover:bg-brand/15">
                        Tutorial
                      </Badge>
                    )}
                  </span>
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
                  onClick={() =>
                    artigo.tutorial
                      ? onAbrirArtigo(categoria.id, artigo.id)
                      : onAbrirCategoria(categoria.id)
                  }
                >
                  {artigo.tutorial
                    ? "Abrir tutorial completo"
                    : `Ver categoria ${categoria.titulo}`}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
  const tour = useTour();
  return (
    <Card className="glass p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-brand-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">Tour guiado</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Um tour passo a passo pelo sistema usando a Sofia, a paciente modelo com a ficha
              completa. Uma janela explica cada tela antes de você ir até ela.
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0" onClick={tour.iniciar}>
          Fazer o tour <ChevronRight className="ml-1 h-4 w-4" />
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
