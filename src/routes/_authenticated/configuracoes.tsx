import { createFileRoute, Outlet } from "@tanstack/react-router";

// Rota-pai de Configurações: atua apenas como layout, renderizando a rota-filha
// ativa (index = página de abas; /configuracoes/recursos, /baterias, etc.).
// A página de abas em si vive em `configuracoes.index.tsx`.
export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesLayout,
});

function ConfiguracoesLayout() {
  return <Outlet />;
}
