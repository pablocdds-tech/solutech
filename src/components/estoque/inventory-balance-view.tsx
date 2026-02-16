"use client";

import * as React from "react";
import Link from "next/link";
import { getInventoryBalance } from "@/actions/estoque";
import type { InventoryBalance } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function InventoryBalanceView() {
  const [data, setData] = React.useState<InventoryBalance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const result = await getInventoryBalance();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar estoque.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.item_name.toLowerCase().includes(q) ||
        item.store_name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
    );
  }, [data, search]);

  const columns: Column<InventoryBalance & Record<string, unknown>>[] = [
    {
      key: "store_name",
      header: "Loja",
      render: (row) => (
        <span className="font-medium text-slate-900">{row.store_name}</span>
      ),
    },
    {
      key: "item_name",
      header: "Item",
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900">{row.item_name}</span>
          {row.sku && (
            <span className="ml-2 text-xs text-slate-500">({row.sku})</span>
          )}
        </div>
      ),
    },
    {
      key: "item_type",
      header: "Tipo",
      render: (row) => {
        const labels: Record<string, string> = {
          product: "Produto",
          ingredient: "Insumo",
          supply: "Material",
        };
        return <Badge>{labels[row.item_type] ?? row.item_type}</Badge>;
      },
    },
    {
      key: "balance",
      header: "Saldo",
      className: "text-right",
      render: (row) => {
        const isLow =
          row.min_stock !== null &&
          row.min_stock !== undefined &&
          row.balance < row.min_stock;
        const isHigh =
          row.max_stock !== null &&
          row.max_stock !== undefined &&
          row.balance > row.max_stock;

        return (
          <div className="text-right">
            <span
              className={
                isLow
                  ? "font-semibold text-danger"
                  : isHigh
                    ? "font-semibold text-warning"
                    : "font-medium text-slate-900"
              }
            >
              {Number(row.balance).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
            {row.unit_abbr && (
              <span className="ml-1 text-xs text-slate-500">
                {row.unit_abbr}
              </span>
            )}
            {isLow && (
              <Badge variant="danger" className="ml-2">
                Abaixo mín.
              </Badge>
            )}
            {isHigh && (
              <Badge variant="warning" className="ml-2">
                Acima máx.
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "avg_unit_cost",
      header: "Custo Médio",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {formatCurrency(Number(row.avg_unit_cost))}
        </span>
      ),
    },
    {
      key: "total_cost_value",
      header: "Valor Total",
      className: "text-right",
      render: (row) => (
        <span className="text-right font-medium text-slate-900">
          {formatCurrency(Number(row.total_cost_value))}
        </span>
      ),
    },
    {
      key: "last_move_at",
      header: "Último Mov.",
      render: (row) =>
        row.last_move_at ? (
          <span className="text-sm text-slate-600">
            {formatDateTime(row.last_move_at)}
          </span>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        ),
    },
  ];

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item, loja ou SKU..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
        <Link href="/estoque/movimentos">
          <Button variant="outline" size="sm">
            Ver Movimentos
          </Button>
        </Link>
      </div>

      {/* Resumo */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Itens em estoque</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Valor total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(
                data.reduce((acc, item) => acc + Number(item.total_cost_value), 0)
              )}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Itens abaixo do mín.</p>
            <p className="mt-1 text-2xl font-semibold text-danger">
              {data.filter(
                (item) =>
                  item.min_stock !== null && item.balance < item.min_stock
              ).length}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={
          filtered as (InventoryBalance & Record<string, unknown>)[]
        }
        loading={loading}
        emptyMessage="Nenhum item em estoque."
        getRowKey={(row) => `${row.store_id}-${row.item_id}`}
      />
    </div>
  );
}
