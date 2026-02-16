"use client";

import * as React from "react";
import Link from "next/link";
import {
  getInternalOrder,
  getInternalOrderItems,
  addInternalOrderItem,
  removeInternalOrderItem,
  confirmInternalOrder,
} from "@/actions/cd-loja";
import type { InternalOrder, InternalOrderItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orderId: string;
}

interface CatalogItem {
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

export function InternalOrderDetailView({ orderId }: Props) {
  const [order, setOrder] = React.useState<InternalOrder | null>(null);
  const [items, setItems] = React.useState<InternalOrderItem[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newItemId, setNewItemId] = React.useState("");
  const [newQuantity, setNewQuantity] = React.useState("");
  const [newUnitCost, setNewUnitCost] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orderRes, itemsRes] = await Promise.all([
      getInternalOrder(orderId),
      getInternalOrderItems(orderId),
    ]);

    if (orderRes.success && orderRes.data) {
      setOrder(orderRes.data);
    } else {
      setError(orderRes.error ?? "Erro ao carregar pedido.");
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }

    const supabase = createClient();
    const { data: catData } = await supabase
      .from("items")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (catData) setCatalogItems(catData as CatalogItem[]);

    setLoading(false);
  }, [orderId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const isDraft = order?.status === "draft";
  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    catalogItems.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [catalogItems]);

  async function handleAddItem() {
    if (!newItemId || !newQuantity || !newUnitCost) return;
    const qty = parseFloat(newQuantity);
    const cost = parseFloat(newUnitCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    setActionLoading(true);
    const result = await addInternalOrderItem(orderId, {
      itemId: newItemId,
      quantity: qty,
      unitCost: cost,
    });
    if (result.success) {
      setNewItemId("");
      setNewQuantity("");
      setNewUnitCost("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar item");
    }
    setActionLoading(false);
  }

  async function handleRemoveItem(itemId: string) {
    setActionLoading(true);
    const result = await removeInternalOrderItem(itemId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao remover item");
    }
    setActionLoading(false);
  }

  async function handleConfirm() {
    setActionLoading(true);
    setError(null);
    const result = await confirmInternalOrder(orderId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao confirmar pedido");
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-64 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        Pedido não encontrado.
      </div>
    );
  }

  const itemsTotal = items.reduce(
    (sum, it) => sum + Number(it.total_cost),
    0
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Fechar
          </button>
        </div>
      )}

      <Link href="/cd-loja">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Pedido Interno
            </h2>
            <div className="mt-1 flex items-center gap-3">
              <Badge
                variant={
                  statusConfig[order.status]?.variant ?? "default"
                }
              >
                {statusConfig[order.status]?.label ?? order.status}
              </Badge>
              <span className="text-sm text-slate-600">
                Data: {formatDate(order.order_date)}
              </span>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(Number(order.total_amount))}
          </p>
        </div>
        {order.notes && (
          <p className="mt-3 text-sm text-slate-600">{order.notes}</p>
        )}
      </div>

      {/* Confirmed banner */}
      {order.status === "confirmed" && (
        <div className="rounded-xl border-2 border-success/50 bg-success/5 p-6">
          <h3 className="text-lg font-semibold text-success">
            Pedido Confirmado
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Confirmado em{" "}
            {order.confirmed_at
              ? formatDate(order.confirmed_at)
              : "—"}
          </p>
        </div>
      )}

      {/* Cancelled banner */}
      {order.status === "cancelled" && (
        <div className="rounded-xl border-2 border-danger/50 bg-danger/5 p-6">
          <h3 className="text-lg font-semibold text-danger">
            Pedido Cancelado
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Cancelado em{" "}
            {order.cancelled_at
              ? formatDate(order.cancelled_at)
              : "—"}
          </p>
        </div>
      )}

      {/* Items section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Itens ({items.length})
        </h3>

        {isDraft && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-900">
              Adicionar Item
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Item
                </label>
                <select
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <option value="">Selecione...</option>
                  {catalogItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Quantidade"
                type="number"
                step="0.0001"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Custo Unit."
                type="number"
                step="0.01"
                min="0"
                value={newUnitCost}
                onChange={(e) => setNewUnitCost(e.target.value)}
                placeholder="0,00"
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={handleAddItem}
                  loading={actionLoading}
                  disabled={
                    !newItemId || !newQuantity || !newUnitCost
                  }
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Item
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Qtd
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Custo Unit.
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Total
                  </th>
                  {isDraft && (
                    <th className="px-3 py-2 text-center font-medium text-slate-600">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {itemMap[item.item_id] ?? item.item_id}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(item.quantity).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(Number(item.unit_cost))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(Number(item.total_cost))}
                    </td>
                    {isDraft && (
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                          title="Remover"
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td
                    colSpan={isDraft ? 3 : 3}
                    className="px-3 py-2 text-right text-slate-700"
                  >
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {formatCurrency(itemsTotal)}
                  </td>
                  {isDraft && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Actions section - only if draft */}
      {isDraft && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Confirmar Pedido
          </h3>
          <p className="text-sm text-slate-600">
            A confirmação gera: estoque OUT no CD + IN na loja destino +
            débito no banco virtual.
          </p>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={actionLoading}
          >
            Confirmar Pedido
          </Button>
        </div>
      )}
    </div>
  );
}
