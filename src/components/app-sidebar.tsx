import { useState, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Settings,
  UserCog,
  Link2,
  FileText,
  DollarSign,
  BarChart3,
  Megaphone,
  Bell,
  DoorOpen,
  LifeBuoy,
  LogOut,
  Menu,
  ChevronUp,
  ChevronDown,
  Upload,
  Clock,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useRoles } from "@/hooks/use-role";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

// Terapeuta com acesso restrito só enxerga estas seções (home/dashboard,
// agenda, pacientes, tarefas atribuídas a ela e o próprio financeiro — sem o
// financeiro da clínica nem a gestão).
const TERAPEUTA_URLS = new Set([
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/tarefas",
  "/meu-financeiro",
  "/central-de-ajuda",
]);
// Itens que só o terapeuta vê (admin/secretaria não veem "Meu financeiro").
const SO_TERAPEUTA_URLS = new Set(["/meu-financeiro"]);

function useVisibleGroups() {
  const { isTerapeutaRestrito } = useRoles();
  if (isTerapeutaRestrito) {
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => TERAPEUTA_URLS.has(i.url)) }))
      .filter((g) => g.items.length > 0);
  }
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !SO_TERAPEUTA_URLS.has(i.url)) }))
    .filter((g) => g.items.length > 0);
}

// Grupos preservados (separados por divisória no rail)
const groups: { label: string; items: Item[] }[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Agenda", url: "/agenda", icon: Calendar },
      { title: "Sublocação", url: "/sublocacao", icon: DoorOpen },
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
      { title: "Meu financeiro", url: "/meu-financeiro", icon: DollarSign },
      { title: "Alertas", url: "/alertas", icon: Bell },
    ],
  },
  {
    label: "Pacientes",
    items: [
      { title: "Pacientes", url: "/pacientes", icon: Users },
      { title: "Lista de espera", url: "/lista-espera", icon: Clock },
      { title: "Cadastros", url: "/cadastros", icon: Link2 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Insumos e testes", url: "/insumos", icon: Package },
      { title: "Importar", url: "/importar", icon: Upload },
      { title: "Contratos", url: "/contratos", icon: FileText },
      { title: "Indicadores", url: "/indicadores", icon: BarChart3 },
      { title: "Comercial", url: "/marketing", icon: Megaphone },
      // Processos e Produtos ficam ocultos por enquanto (funcionalidades
      // ainda não liberadas no Pensya).
      { title: "Equipe", url: "/equipe", icon: UserCog },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Configurações", url: "/configuracoes", icon: Settings },
      { title: "Central de ajuda", url: "/central-de-ajuda", icon: LifeBuoy },
    ],
  },
];

function useIsActive() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (url: string) => pathname === url || pathname.startsWith(url + "/");
}

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

// Detecta se a lista de navegação tem conteúdo além da área visível, para
// mostrar indicadores de rolagem (⌃/⌄) — assim ninguém deixa de descobrir
// páginas por não saber que precisa rolar.
function useScrollHints(deps: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [hints, setHints] = useState({ up: false, down: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setHints({
        up: el.scrollTop > 4,
        down: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [deps]);
  const scrollStep = (dir: number) => ref.current?.scrollBy({ top: dir * 220, behavior: "smooth" });
  return { ref, hints, scrollStep };
}

/** Rail vertical escuro flutuante — expande no hover para mostrar os rótulos. */
export function AppSidebar() {
  const isActive = useIsActive();
  const visibleGroups = useVisibleGroups();
  const { ref, hints, scrollStep } = useScrollHints(visibleGroups);
  return (
    <aside className="group sticky top-4 z-50 hidden h-[calc(100vh-2rem)] w-16 shrink-0 md:block">
      <nav className="absolute left-0 top-0 z-40 flex h-full w-16 flex-col gap-1 overflow-hidden rounded-[28px] bg-rail px-2 py-4 text-rail-foreground shadow-elegant transition-[width] duration-200 ease-out group-hover:w-60 group-hover:shadow-2xl">
        {hints.up && (
          <button
            onClick={() => scrollStep(-1)}
            title="Rolar para cima"
            className="mb-1 flex h-6 shrink-0 items-center justify-center rounded-lg text-rail-foreground/70 transition-colors hover:bg-white/10 hover:text-rail-active"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
        <div ref={ref} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">
          {visibleGroups.map((g, gi) => (
            <div key={g.label} className="flex flex-col gap-1">
              {gi > 0 && <span className="my-1 ml-2.5 h-px w-6 bg-white/10" />}
              {g.items.map((item) => (
                <RailButton key={item.url} item={item} active={isActive(item.url)} />
              ))}
            </div>
          ))}
        </div>
        {hints.down && (
          <button
            onClick={() => scrollStep(1)}
            title="Mais opções abaixo"
            className="mt-1 flex h-6 shrink-0 animate-bounce items-center justify-center rounded-lg text-rail-active transition-colors hover:bg-white/10"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={sair}
          className="mt-2 flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-rail-foreground transition-colors hover:bg-white/10 hover:text-rail-active"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Sair
          </span>
        </button>
      </nav>
    </aside>
  );
}

function RailButton({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      to={item.url}
      title={item.title}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-2xl px-3 transition-colors [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
        active
          ? "bg-rail-active-bg text-rail-active shadow-inner"
          : "text-rail-foreground hover:bg-white/10 hover:text-rail-active",
      )}
    >
      <item.icon />
      <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {item.title}
      </span>
    </Link>
  );
}

/** Gatilho + drawer da navegação no mobile. */
export function MobileNav() {
  const isActive = useIsActive();
  const visibleGroups = useVisibleGroups();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-rail p-0 text-rail-foreground">
        <div className="flex h-full flex-col p-4">
          <img
            src="/pensya-logo-horizontal-dark.svg"
            alt="Pensya"
            className="mb-4 h-8 w-auto object-contain"
          />
          <div className="flex-1 space-y-4 overflow-y-auto">
            {visibleGroups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 px-2 text-[10px] uppercase tracking-wider text-white/40">
                  {g.label}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <Link
                      key={item.url}
                      to={item.url}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors [&_svg]:h-4 [&_svg]:w-4",
                        isActive(item.url)
                          ? "bg-rail-active-bg text-rail-active"
                          : "hover:bg-white/10 hover:text-rail-active",
                      )}
                    >
                      <item.icon />
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={sair}
            className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10 hover:text-rail-active"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
