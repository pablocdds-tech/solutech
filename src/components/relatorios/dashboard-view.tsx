"use client";

import * as React from "react";
import Link from "next/link";
import { getDashboardSummary } from "@/actions/relatorios";
import type { DashboardSummary } from "@/actions/relatorios";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export function DashboardView() {
  const [data, setData] = React.useState<DashboardSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const result = await getDashboardSummary();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? "Erro ao carregar dashboard.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const totals = React.useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        sales_month: acc.sales_month + (row.sales_month ?? 0),
        ap_pending: acc.ap_pending + (row.ap_pending ?? 0),
        ar_pending: acc.ar_pending + (row.ar_pending ?? 0),
        purchases_month: acc.purchases_month + (row.purchases_month ?? 0),
        items_in_stock: acc.items_in_stock + (row.items_in_stock ?? 0),
        open_production_orders: acc.open_production_orders + (row.open_production_orders ?? 0),
        pending_checklists: acc.pending_checklists + (row.pending_checklists ?? 0),
        open_counts: acc.open_counts + (row.open_counts ?? 0),
      }),
      {
        sales_month: 0,
        ap_pending: 0,
        ar_pending: 0,
        purchases_month: 0,
        items_in_stock: 0,
        open_production_orders: 0,
        pending_checklists: 0,
        open_counts: 0,
      }
    );
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-10 w-10 animate-spin text-primary-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-slate-600">Carregando dashboard…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/relatorios">Relatórios</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/vendas">Vendas</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/compras">Compras</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro">Financeiro</Link>
        </Button>
      </div>

      {/* Consolidated totals */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Totais consolidados</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <div className="rounded-lg border border-slate-200 bg-blue-50 p-4">
            <p className="text-xs font-medium text-slate-600">Vendas do Mês</p>
            <p className="text-lg font-semibold text-blue-800">{formatCurrency(totals.sales_month)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-slate-600">AP Pendente</p>
            <p className="text-lg font-semibold text-amber-800">{formatCurrency(totals.ap_pending)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-green-50 p-4">
            <p className="text-xs font-medium text-slate-600">AR Pendente</p>
            <p className="text-lg font-semibold text-green-800">{formatCurrency(totals.ar_pending)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Compras do Mês</p>
            <p className="text-lg font-semibold text-slate-800">{formatCurrency(totals.purchases_month)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Itens em Estoque</p>
            <p className="text-lg font-semibold text-slate-800">{totals.items_in_stock}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">OPs Abertas</p>
            <p className="text-lg font-semibold text-slate-800">{totals.open_production_orders}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Checklists Pendentes</p>
            <p className="text-lg font-semibold text-slate-800">{totals.pending_checklists}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Contagens Abertas</p>
            <p className="text-lg font-semibold text-slate-800">{totals.open_counts}</p>
          </div>
        </div>
      </section>

      {/* Per-store cards */}
      {data.map((row) => (
        <section key={row.store_id}>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">{row.store_name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-lg border border-slate-200 bg-blue-50 p-4">
              <p className="text-xs font-medium text-slate-600">Vendas do Mês</p>
              <p className="text-lg font-semibold text-blue-800">{formatCurrency(row.sales_month ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-slate-600">AP Pendente</p>
              <p className="text-lg font-semibold text-amber-800">{formatCurrency(row.ap_pending ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-green-50 p-4">
              <p className="text-xs font-medium text-slate-600">AR Pendente</p>
              <p className="text-lg font-semibold text-green-800">{formatCurrency(row.ar_pending ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">Compras do Mês</p>
              <p className="text-lg font-semibold text-slate-800">{formatCurrency(row.purchases_month ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">Itens em Estoque</p>
              <p className="text-lg font-semibold text-slate-800">{row.items_in_stock ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">OPs Abertas</p>
              <p className="text-lg font-semibold text-slate-800">{row.open_production_orders ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">Checklists Pendentes</p>
              <p className="text-lg font-semibold text-slate-800">{row.pending_checklists ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-600">Contagens Abertas</p>
              <p className="text-lg font-semibold text-slate-800">{row.open_counts ?? 0}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
