"use client";

import * as React from "react";
import { computeCmv } from "@/actions/producao";
import type { CmvResult } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface StoreOption {
  id: string;
  name: string;
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return { from, to };
}

export function CmvView() {
  const { from: defaultFrom, to: defaultTo } = getMonthRange();
  const [data, setData] = React.useState<CmvResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [storeId, setStoreId] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState(defaultFrom);
  const [dateTo, setDateTo] = React.useState(defaultTo);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { storeId?: string; dateFrom?: string; dateTo?: string } = {};
    if (storeId) opts.storeId = storeId;
    opts.dateFrom = dateFrom;
    opts.dateTo = dateTo;
    const result = await computeCmv(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao calcular CMV.");
    }
    setLoading(false);
  }, [storeId, dateFrom, dateTo]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadStores() {
      const supabase = createClient();
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (storesData) setStores(storesData as StoreOption[]);
    }
    loadStores();
  }, []);

  const totalCmv = data.reduce((sum, r) => sum + Number(r.cmv_total), 0);
  const totalLoss = data.reduce((sum, r) => sum + Number(r.loss_total), 0);
  const itemsCount = data.length;

  const columns: Column<CmvResult & Record<string, unknown>>[] = [
    {
      key: "store_id",
      header: "Loja",
      render: (row) => (
        <span className="font-mono text-sm text-slate-700">
          {String(row.store_id).slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "item_id",
      header: "Item",
      render: (row) => (
        <span className="font-mono text-sm text-slate-700">
          {String(row.item_id).slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "cmv_total",
      header: "CMV Total",
      className: "text-right",
      render: (row) => (
        <span className="text-right font-medium text-slate-900">
          {formatCurrency(Number(row.cmv_total))}
        </span>
      ),
    },
    {
      key: "qty_out",
      header: "Qtd Saída",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {Number(row.qty_out).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "loss_total",
      header: "Perdas",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {formatCurrency(Number(row.loss_total))}
        </span>
      ),
    },
    {
      key: "total_cost",
      header: "Custo Total",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {formatCurrency(Number(row.total_cost))}
        </span>
      ),
    },
  ];

  if (error && data.length === 0) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        CMV é derivado de inventory_moves. Nunca digitado manualmente.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Filtros</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Loja
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <option value="">Todas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Data Início"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="Data Fim"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div className="flex items-end">
            <Button variant="primary" size="sm" onClick={loadData}>
              Calcular
            </Button>
          </div>
        </div>
      </div>

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total CMV</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(totalCmv)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total Perdas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(totalLoss)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Itens analisados</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {itemsCount}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data as (CmvResult & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhum resultado para o período."
        getRowKey={(row) => `${row.store_id}-${row.item_id}`}
      />
    </div>
  );
}
