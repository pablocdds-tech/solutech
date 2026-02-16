import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard principal — placeholder.
 * Será populado com cards e indicadores na FASE 11 (M7).
 */
export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão geral do sistema — selecione uma loja para começar.
        </p>
      </div>

      {/* Grid de cards placeholder */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Vendas Hoje", value: "—", color: "bg-primary-50" },
          { label: "Contas a Pagar", value: "—", color: "bg-amber-50" },
          { label: "Estoque Baixo", value: "—", color: "bg-red-50" },
          { label: "Banco Virtual CD", value: "—", color: "bg-emerald-50" },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl ${card.color} p-5 transition-shadow hover:shadow-md`}
          >
            <p className="text-sm font-medium text-slate-600">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
