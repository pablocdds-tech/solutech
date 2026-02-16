"use client";

import * as React from "react";
import { getReportCashFlow } from "@/actions/relatorios";
import type { CashFlowRow } from "@/actions/relatorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface StoreOption {
  id: string;
  name: string;
}

export function CashFlowView() {
  const [data, setData] = React.useState<CashFlowRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [storeId, setStoreId] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { storeId?: string; dateFrom?: string; dateTo?: string } = {};
    if (storeId) opts.storeId = storeId;
    opts.dateFrom = dateFrom;
    opts.dateTo = dateTo;
    const result = await getReportCashFlow(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao gerar fluxo de caixa.");
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Fluxo derivado de bank_transactions.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="min-w-[180px]">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Loja</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="h-10 w-full rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Input
            label="De"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Input
            label="Até"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button onClick={loadData} loading={loading}>
          Gerar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger">
          {error}
        </div>
      )}

      {!error && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-700">Categoria</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Descrição</th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isSaldo = row.category?.toLowerCase().includes("saldo") ?? false;
                const isPositive = row.amount >= 0;
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 ${
                      isSaldo ? "bg-primary-50 font-bold" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-800">{row.category}</td>
                    <td className="px-4 py-3 text-slate-800">{row.description}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        isPositive ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && !loading && data.length === 0 && (
        <p className="text-center text-slate-500">Nenhum dado encontrado.</p>
      )}
    </div>
  );
}
