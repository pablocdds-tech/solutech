"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/actions/auth";

interface UserData {
  fullName: string;
  email: string;
  role: string;
  stores: { id: string; name: string; type: string }[];
}

interface Props {
  user: UserData;
  onToggleSidebar?: () => void;
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  financial: "Financeiro",
  purchasing: "Compras",
  stock_production: "Estoque/Produção",
  store_manager: "Gerente de Loja",
  cashier: "Operador de Caixa",
  counter: "Contador",
  checklist_executor: "Executor Checklist",
  maintenance: "Manutenção",
};

export function DashboardHeader({ user, onToggleSidebar }: Props) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="text-lg font-semibold text-slate-900 lg:hidden">
          Vitaliano ERP
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Store info (se tiver lojas) */}
        {user.stores.length > 0 && (
          <div className="hidden text-right text-xs text-slate-500 sm:block">
            <div className="font-medium text-slate-700">
              {user.stores.length === 1
                ? user.stores[0].name
                : `${user.stores.length} lojas`}
            </div>
          </div>
        )}

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium text-slate-700">{user.fullName}</div>
              <div className="text-xs text-slate-500">{roleLabels[user.role] ?? user.role}</div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>

                {user.stores.length > 1 && (
                  <div className="border-b border-slate-100 px-4 py-2">
                    <p className="mb-1 text-xs font-medium text-slate-400">Lojas</p>
                    {user.stores.map((store) => (
                      <p key={store.id} className="text-sm text-slate-600">
                        {store.name}
                        {store.type === "cd" && (
                          <span className="ml-1 text-xs text-blue-500">(CD)</span>
                        )}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {loggingOut ? "Saindo..." : "Sair"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
