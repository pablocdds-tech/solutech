"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listInternalOrders,
  createInternalOrder,
  type InternalOrderWithStoreNames,
} from "@/actions/cd-loja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

interface StoreOption {
  id: string;
  name: string;
  type: string;
}

export function InternalOrdersView() {
  const router = useRouter();
  const [data, setData] = React.useState<InternalOrderWithStoreNames[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stores, setStores] = React.useState<StoreOption[]>([]);

  const [newSourceStoreId, setNewSourceStoreId] = React.useState("");
  const [newDestStoreId, setNewDestStoreId] = React.useState("");
  const [newOrderDate, setNewOrderDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [newNotes, setNewNotes] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listInternalOrders(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar pedidos internos.");
    }
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadStores() {
      const supabase = createClient();
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name, type")
        .eq("is_active", true)
        .order("name");
      if (storesData) setStores(storesData as StoreOption[]);
    }
    loadStores();
  }, []);

  const cdStores = stores.filter((s) => s.type === "cd");
  const lojaStores = stores.filter((s) => s.type === "store");

  async function handleCreate() {
    if (!newSourceStoreId || !newDestStoreId) return;
    setActionLoading(true);
    setError(null);
    const result = await createInternalOrder({
      sourceStoreId: newSourceStoreId,
      destinationStoreId: newDestStoreId,
      orderDate: newOrderDate,
      notes: newNotes || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewSourceStoreId("");
      setNewDestStoreId("");
      setNewOrderDate(new Date().toISOString().split("T")[0]);
      setNewNotes("");
      router.push(`/cd-loja/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar pedido.");
    }
    setActionLoading(false);
  }

  const draftsCount = data.filter((r) => r.status === "draft").length;
  const confirmedCount = data.filter((r) => r.status === "confirmed").length;
  const totalConfirmado = data
    .filter((r) => r.status === "confirmed")
    .reduce((acc, r) => acc + Number(r.total_amount), 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "draft", "confirmed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "Todos" : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cd-loja/liquidar">
            <Button variant="outline" size="sm">
              Liquidar Banco Virtual
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Fechar" : "Novo Pedido"}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Novo Pedido CD → Loja
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Origem (CD)
              </label>
              <select
                value={newSourceStoreId}
                onChange={(e) => setNewSourceStoreId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione o CD</option>
                {cdStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Destino (Loja)
              </label>
              <select
                value={newDestStoreId}
                onChange={(e) => setNewDestStoreId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione a loja</option>
                {lojaStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Data do Pedido"
              type="date"
              value={newOrderDate}
              onChange={(e) => setNewOrderDate(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Observações"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Opcional"
                rows={1}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={actionLoading}
              disabled={!newSourceStoreId || !newDestStoreId}
            >
              Criar Pedido
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Rascunhos</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {draftsCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Confirmados</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">
              {confirmedCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total confirmado</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(totalConfirmado)}
            </p>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">Nenhum pedido encontrado.</p>
            <p className="mt-1 text-xs text-slate-400">
              Clique em &quot;Novo Pedido&quot; para criar o primeiro.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-700">
                  Data
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-700">
                  Origem
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-700">
                  Destino
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-700">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-medium text-slate-700">
                  Itens
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-700">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => {
                const cfg = statusConfig[order.status] ?? {
                  label: order.status,
                  variant: "default" as const,
                };
                return (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/cd-loja/${order.id}`)}
                    className="border-b border-slate-100 hover:bg-primary-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {order.source_store_name}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {order.destination_store_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {order.items_count}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(Number(order.total_amount))}
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
