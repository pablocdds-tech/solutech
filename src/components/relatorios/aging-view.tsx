"use client";

import * as React from "react";
import { getReportAgingAp, getReportAgingAr } from "@/actions/relatorios";
import type { AgingRow } from "@/actions/relatorios";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface StoreOption {
  id: string;
  name: string;
}

function getBucketStyle(bucket: string): string {
  const b = (bucket ?? "").toLowerCase();
  if (b.includes("vencer") || b.includes("a vencer")) return "bg-green-100 text-green-800";
  if (b.includes("1-30") || b.includes("1 a 30")) return "bg-yellow-100 text-yellow-800";
  if (b.includes("31-60") || b.includes("31 a 60")) return "bg-orange-100 text-orange-800";
  if (b.includes("61-90") || b.includes("61 a 90")) return "bg-red-100 text-red-800";
  if (b.includes("+90") || b.includes("90")) return "bg-red-900/20 text-red-900";
  return "bg-slate-100 text-slate-800";
}

function AgingTable({ rows, title }: { rows: AgingRow[]; title: string }) {
  const total = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const totalCount = rows.reduce((s, r) => s + (r.count ?? 0), 0);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[300px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-700">Faixa</th>
              <th className="px-4 py-3 text-right font-medium text-slate-700">Qtd</th>
              <th className="px-4 py-3 text-right font-medium text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getBucketStyle(
                      row.aging_bucket ?? ""
                    )}`}
                  >
                    {row.aging_bucket}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{row.count}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatCurrency(row.total_amount ?? 0)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-3 text-slate-800">Total</td>
              <td className="px-4 py-3 text-right text-slate-800">{totalCount}</td>
              <td className="px-4 py-3 text-right text-slate-800">
                {formatCurrency(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AgingView() {
  const [apData, setApData] = React.useState<AgingRow[]>([]);
  const [arData, setArData] = React.useState<AgingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [storeId, setStoreId] = React.useState<string>("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [apRes, arRes] = await Promise.all([
      getReportAgingAp(storeId || undefined),
      getReportAgingAr(storeId || undefined),
    ]);
    if (apRes.success && apRes.data) setApData(apRes.data);
    else setError(apRes.error ?? "Erro ao carregar aging AP.");
    if (arRes.success && arRes.data) setArData(arRes.data);
    else setError(arRes.error ?? "Erro ao carregar aging AR.");
    setLoading(false);
  }, [storeId]);

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
        <Button onClick={loadData} loading={loading}>
          Gerar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger">
          {error}
        </div>
      )}

      {!error && (
        <div className="grid gap-8 lg:grid-cols-2">
          <AgingTable rows={apData} title="Contas a Pagar" />
          <AgingTable rows={arData} title="Contas a Receber" />
        </div>
      )}
    </div>
  );
}
