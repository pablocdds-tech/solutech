"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  listSales,
  createSale,
} from "@/actions/vendas";
import type { Sale } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface StoreOption {
  id: string;
  name: string;
}

interface SalesChannelOption {
  id: string;
  name: string;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function SalesView() {
  const router = useRouter();
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [salesChannels, setSalesChannels] = React.useState<SalesChannelOption[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newStoreId, setNewStoreId] = React.useState("");
  const [newSalesChannelId, setNewSalesChannelId] = React.useState("");
  const [newSaleDate, setNewSaleDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [newDiscount, setNewDiscount] = React.useState("0");
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");

  const loadSales = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listSales(opts);
    if (result.success && result.data) {
      setSales(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar vendas.");
    }
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    loadSales();
  }, [loadSales]);

  React.useEffect(() => {
    async function loadRefData() {
      const supabase = createClient();
      const [storesRes, channelsRes] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("sales_channels")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);
      if (storesRes.data) setStores(storesRes.data as StoreOption[]);
      if (channelsRes.data)
        setSalesChannels(channelsRes.data as SalesChannelOption[]);
    }
    loadRefData();
  }, []);

  const totalSales = sales.length;
  const draftsCount = sales.filter((s) => s.status === "draft").length;
  const confirmedCount = sales.filter((s) => s.status === "confirmed").length;
  const totalConfirmado = sales
    .filter((s) => s.status === "confirmed")
    .reduce((acc, s) => acc + Number(s.total_amount), 0);

  const storeMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    stores.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [stores]);

  const channelMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    salesChannels.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [salesChannels]);

  function resolveStore(id: string) {
    return storeMap[id] || id.slice(0, 8);
  }

  function resolveChannel(id: string | null) {
    if (!id) return "—";
    return channelMap[id] || id.slice(0, 8);
  }

  async function handleCreate() {
    if (!newStoreId) return;
    setActionLoading(true);
    setError(null);
    const discount = parseFloat(newDiscount);
    const result = await createSale({
      storeId: newStoreId,
      saleDate: newSaleDate,
      salesChannelId: newSalesChannelId || undefined,
      discount: isNaN(discount) ? 0 : discount,
      customerName: newCustomerName || undefined,
      notes: newNotes || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewStoreId("");
      setNewSalesChannelId("");
      setNewSaleDate(new Date().toISOString().split("T")[0]);
      setNewDiscount("0");
      setNewCustomerName("");
      setNewNotes("");
      router.push(`/vendas/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar venda.");
    }
    setActionLoading(false);
  }

  if (error && !showCreateForm) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total vendas</p>
          <p className="text-xl font-semibold text-slate-900">{totalSales}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Rascunhos</p>
          <p className="text-xl font-semibold text-slate-900">{draftsCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Confirmadas</p>
          <p className="text-xl font-semibold text-slate-900">{confirmedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Valor total confirmado</p>
          <p className="text-xl font-semibold text-slate-900">
            {formatCurrency(totalConfirmado)}
          </p>
        </div>
      </div>

      {/* Filters and Nova Venda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all", label: "Todos" },
              { key: "draft", label: "Rascunho" },
              { key: "confirmed", label: "Confirmado" },
              { key: "cancelled", label: "Cancelado" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === key
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm((v) => !v)}
        >
          Nova Venda
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Nova venda
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Loja
              </label>
              <select
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Canal de venda (opcional)
              </label>
              <select
                value={newSalesChannelId}
                onChange={(e) => setNewSalesChannelId(e.target.value)}
                className="flex h-10 w-full rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">—</option>
                {salesChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                label="Data da venda"
                type="date"
                value={newSaleDate}
                onChange={(e) => setNewSaleDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Desconto"
                type="number"
                min={0}
                step={0.01}
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Cliente (opcional)"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Observações (opcional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notas da venda"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={actionLoading}
              disabled={!newStoreId}
            >
              Criar Venda
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Sales table (manual layout) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Carregando...
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhuma venda encontrada.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-700">Data</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Loja</th>
                <th className="px-4 py-3 font-medium text-slate-700">Canal</th>
                <th className="px-4 py-3 font-medium text-slate-700 text-right">
                  Valor
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">Cliente</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const cfg =
                  statusConfig[sale.status] ?? {
                    label: sale.status,
                    variant: "default" as const,
                  };
                return (
                  <tr
                    key={sale.id}
                    onClick={() => router.push(`/vendas/${sale.id}`)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(sale.sale_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {resolveStore(sale.store_id)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {resolveChannel(sale.sales_channel_id)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(Number(sale.total_amount))}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {sale.customer_name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
