"use client";

import * as React from "react";
import Link from "next/link";
import { getVirtualLedgerBalances } from "@/actions/banco-virtual";
import type { VirtualLedgerBalance } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function VirtualBalanceView() {
  const [data, setData] = React.useState<VirtualLedgerBalance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const result = await getVirtualLedgerBalances();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? "Erro ao carregar banco virtual.");
      }
      setLoading(false);
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-40 rounded bg-slate-200" />
            <div className="mt-6 space-y-2">
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900">
          Nenhum lançamento virtual
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Os saldos aparecerão quando houver operações entre CD e lojas.
        </p>
      </div>
    );
  }

  const totalBalance = data.reduce((acc, d) => acc + Number(d.balance), 0);

  return (
    <div className="space-y-6">
      {/* Card de resumo total */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary-700">
              Saldo Virtual Total (todas as lojas)
            </p>
            <p className="mt-1 text-3xl font-bold text-primary-900">
              {formatCurrency(totalBalance)}
            </p>
            <p className="mt-1 text-xs text-primary-600">
              {totalBalance > 0
                ? "Lojas devem ao CD"
                : totalBalance < 0
                  ? "CD deve às lojas"
                  : "Zerado"}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg
              className="h-7 w-7 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Cards por loja */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map((store) => {
          const balance = Number(store.balance);
          const hasDebt = balance > 0;

          return (
            <div
              key={store.store_id}
              className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {store.store_name}
                  </h3>
                  <Badge variant={store.store_type === "cd" ? "info" : "default"}>
                    {store.store_type === "cd" ? "CD" : "Loja"}
                  </Badge>
                </div>
                <div className="text-right">
                  <p
                    className={`text-2xl font-bold ${
                      hasDebt ? "text-danger" : "text-success"
                    }`}
                  >
                    {formatCurrency(balance)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hasDebt ? "Deve ao CD" : balance < 0 ? "Crédito" : "Zerado"}
                  </p>
                </div>
              </div>

              {/* Detalhes */}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Débitos</span>
                  <span className="font-medium text-danger">
                    {formatCurrency(Number(store.total_debits))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Créditos</span>
                  <span className="font-medium text-success">
                    {formatCurrency(Number(store.total_credits))}
                  </span>
                </div>
                {Number(store.total_adjustments) !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Ajustes</span>
                    <span className="font-medium text-warning">
                      {formatCurrency(Number(store.total_adjustments))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Lançamentos</span>
                  <span className="font-medium text-slate-900">
                    {store.total_entries}
                  </span>
                </div>
                {store.last_entry_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Último lanç.</span>
                    <span className="text-slate-700">
                      {formatDateTime(store.last_entry_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Link para extrato */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Link
                  href={`/banco-virtual/extrato/${store.store_id}`}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  Ver extrato completo &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
