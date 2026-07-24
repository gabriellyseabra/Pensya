import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, UserPlus, ListTodo, DollarSign, Megaphone } from "lucide-react";
import { QuickLancamentoDialog } from "@/components/financeiro/QuickLancamentoDialog";

/**
 * Botão flutuante global — visível em todas as páginas autenticadas.
 *
 * É arrastável: o usuário pode reposicioná-lo em qualquer canto da tela
 * (a posição fica salva no navegador) para não atrapalhar o conteúdo. O menu
 * de ações é um popover próprio (não Radix) para evitar conflito entre o
 * arrastar e o abrir. Só ficam ações que realmente executam algo.
 */

const POS_KEY = "global-fab-pos";
const SIZE = 56; // h-14 w-14
const MARGIN = 8;

type Pos = { x: number; y: number };

function carregarPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(POS_KEY);
    return raw ? (JSON.parse(raw) as Pos) : null;
  } catch {
    return null;
  }
}

export function GlobalFAB() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lancamentoOpen, setLancamentoOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(carregarPos);

  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);
  const posRef = useRef<Pos | null>(pos);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mantém a posição dentro da tela ao redimensionar a janela.
  useEffect(() => {
    function aoRedimensionar() {
      setPos((p) => {
        if (!p) return p;
        const np = {
          x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
          y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
        };
        posRef.current = np;
        return np;
      });
    }
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function aoApontar(e: PointerEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", aoApontar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoApontar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top };
    movedRef.current = false;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!movedRef.current && Math.hypot(dx, dy) < 6) return;
    movedRef.current = true;
    if (open) setOpen(false);
    const np = {
      x: Math.min(Math.max(MARGIN, d.ox + dx), window.innerWidth - SIZE - MARGIN),
      y: Math.min(Math.max(MARGIN, d.oy + dy), window.innerHeight - SIZE - MARGIN),
    };
    posRef.current = np;
    setPos(np);
  }

  function onPointerUp(e: React.PointerEvent) {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (movedRef.current) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* ignore */ }
      // Mantém "moved" até depois do click para não abrir o menu ao soltar.
      setTimeout(() => { movedRef.current = false; }, 0);
    }
    dragRef.current = null;
  }

  function go(to: string) {
    setOpen(false);
    navigate({ to } as any);
  }

  // Retângulo atual do botão (posição salva ou canto inferior direito padrão).
  function rectAtual() {
    if (pos) return { left: pos.x, top: pos.y, right: pos.x + SIZE, bottom: pos.y + SIZE };
    const left = window.innerWidth - 24 - SIZE;
    const top = window.innerHeight - 24 - SIZE;
    return { left, top, right: left + SIZE, bottom: top + SIZE };
  }

  const style: React.CSSProperties | undefined = pos
    ? { position: "fixed", left: pos.x, top: pos.y }
    : undefined;

  // Estilo do menu: abre para cima quando o botão está na metade de baixo.
  let menuStyle: React.CSSProperties = {};
  if (open && typeof window !== "undefined") {
    const r = rectAtual();
    const abrirParaCima = r.top > window.innerHeight / 2;
    menuStyle = {
      position: "fixed",
      right: Math.max(MARGIN, window.innerWidth - r.right),
      ...(abrirParaCima
        ? { bottom: window.innerHeight - r.top + 8 }
        : { top: r.bottom + 8 }),
    };
  }

  const itemCls =
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Ações rápidas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => { if (!movedRef.current) setOpen((o) => !o); }}
        style={style}
        className={`fixed ${pos ? "" : "bottom-6 right-6"} z-40 flex h-14 w-14 touch-none cursor-grab items-center justify-center rounded-full shadow-lg gradient-brand text-brand-foreground transition-transform hover:scale-105 active:cursor-grabbing`}
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={menuStyle}
          className="z-50 w-60 rounded-lg border border-border/40 glass-strong p-1 shadow-xl"
        >
          <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Criar</p>
          <button className={itemCls} onClick={() => go("/cadastros")}>
            <UserPlus className="h-4 w-4 text-brand" />Novo paciente
          </button>
          <button className={itemCls} onClick={() => go("/tarefas")}>
            <ListTodo className="h-4 w-4 text-brand" />Nova tarefa
          </button>
          <button className={itemCls} onClick={() => go("/marketing")}>
            <Megaphone className="h-4 w-4 text-brand" />Novo lead
          </button>
          <button className={itemCls} onClick={() => { setOpen(false); setLancamentoOpen(true); }}>
            <DollarSign className="h-4 w-4 text-brand" />Novo lançamento
          </button>
          <p className="px-2 pb-1 pt-2 text-[10px] text-muted-foreground/70">
            Dica: arraste o botão para reposicioná-lo.
          </p>
        </div>
      )}

      <QuickLancamentoDialog open={lancamentoOpen} onOpenChange={setLancamentoOpen} />
    </>
  );
}
