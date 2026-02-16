import { DashboardNav } from "./dashboard-nav";

/**
 * Layout do dashboard — shell principal do ERP.
 * Futuramente terá: sidebar, header com seletor de loja,
 * inbox/alertas e busca global.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — será implementada como componente */}
      <aside className="hidden w-64 bg-sidebar text-sidebar-text lg:block">
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-bold text-white">Vitaliano ERP</span>
        </div>
        <DashboardNav />
      </aside>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col">
        {/* Header — será implementado como componente */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-slate-900 lg:hidden">
              Vitaliano ERP
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Seletor de loja, notificações, perfil — futuro */}
            <div className="h-8 w-8 rounded-full bg-primary-100" />
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
