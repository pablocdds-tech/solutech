"use client";

import * as React from "react";
import Link from "next/link";
import {
  getInternalOrder,
  getInternalOrderItems,
  addInternalOrderItem,
  removeInternalOrderItem,
  updateInternalOrderItem,
  confirmInternalOrder,
  cancelInternalOrder,
  getItemPriceForStore,
  type InternalOrderWithStoreNames,
  type InternalOrderItemWithName,
} from "@/actions/cd-loja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orderId: string;
}

interface CatalogItem {
  id: string;
  name: string;
  type: string;
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
  const [order, setOrder] = React.useState<InternalOrderWithStoreNames | null>(null);
  const [items, setItems] = React.useState<InternalOrderItemWithName[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Add item form
  const [newItemId, setNewItemId] = React.useState("");
  const [newQuantity, setNewQuantity] = React.useState("1");
  const [newUnitPrice, setNewUnitPrice] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");
  const [priceLoading, setPriceLoading] = React.useState(false);

  // Edit qty inline
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [editQty, setEditQty] = React.useState("");

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
      setError(orderRes.error ?? "Pedido não encontrado.");
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }

    const supabase = createClient();
    const { data: catData } = await supabase
      .from("items")
      .select("id, name, type")
      .eq("is_active", true)
      .order("name");
    if (catData) setCatalogItems(catData as CatalogItem[]);

    setLoading(false);
  }, [orderId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const isDraft = order?.status === "draft";

  // Buscar preço ao selecionar item
  const handleItemSelect = React.useCallback(
    async (itemId: string) => {
      setNewItemId(itemId);
      if (!itemId || !order) {
        setNewUnitPrice("");
        return;
      }

      setPriceLoading(true);
      const res = await getItemPriceForStore(itemId, order.destination_store_id);
      if (res.success && res.data) {
        const price = res.data.costPrice ?? res.data.price;
        setNewUnitPrice(price > 0 ? price.toString() : "");
      }
      setPriceLoading(false);
    },
    [order]
  );

  async function handleAddItem() {
    if (!newItemId || !newQuantity || !newUnitPrice) return;
    const qty = parseFloat(newQuantity);
    const price = parseFloat(newUnitPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) return;

    setActionLoading(true);
    setError(null);
    const result = await addInternalOrderItem(orderId, {
      itemId: newItemId,
      quantity: qty,
      unitCost: price,
      notes: newNotes || undefined,
    });
    if (result.success) {
      setNewItemId("");
      setNewQuantity("1");
      setNewUnitPrice("");
      setNewNotes("");
      setSuccess("Item adicionado");
      setTimeout(() => setSuccess(null), 2000);
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar item");
    }
    setActionLoading(false);
  }

  async function handleRemoveItem(itemId: string) {
    setActionLoading(true);
    setError(null);
    const result = await removeInternalOrderItem(itemId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao remover item");
    }
    setActionLoading(false);
  }

  async function handleSaveQty(itemId: string) {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) return;
    setActionLoading(true);
    const result = await updateInternalOrderItem(itemId, { quantity: qty });
    if (result.success) {
      setEditingItemId(null);
      await loadData();
    } else {
      setError(result.error ?? "Erro ao atualizar");
    }
    setActionLoading(false);
  }

  async function handleConfirm() {
    if (items.length === 0) {
      setError("Adicione pelo menos 1 item antes de confirmar");
      return;
    }
    setActionLoading(true);
    setError(null);
    const result = await confirmInternalOrder(orderId);
    if (result.success) {
      setSuccess("Pedido confirmado! Estoque transferido + débito virtual gerado.");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao confirmar pedido");
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    setActionLoading(true);
    setError(null);
    const result = await cancelInternalOrder(orderId);
    if (result.success) {
      setSuccess("Pedido cancelado.");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao cancelar");
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
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Pedido não encontrado. {error}
        </div>
        <Link href="/cd-loja">
          <Button variant="outline" size="sm">&larr; Voltar</Button>
        </Link>
      </div>
    );
  }

  const itemsTotal = items.reduce((sum, it) => sum + Number(it.total_cost), 0);

  // Itens já adicionados (para evitar duplicatas no select)
  const addedItemIds = new Set(items.map((i) => i.item_id));
  const availableItems = catalogItems.filter((c) => !addedItemIds.has(c.id));

  const newLineTotal =
    (parseFloat(newQuantity) || 0) * (parseFloat(newUnitPrice) || 0);

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <Link href="/cd-loja">
        <Button variant="outline" size="sm">
          &larr; Voltar para lista
        </Button>
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                Pedido Interno
              </h2>
              <Badge variant={statusConfig[order.status]?.variant ?? "default"}>
                {statusConfig[order.status]?.label ?? order.status}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div>
                <span className="text-slate-500">Origem:</span>{" "}
                <span className="font-medium text-slate-900">
                  {order.source_store_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Destino:</span>{" "}
                <span className="font-medium text-slate-900">
                  {order.destination_store_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Data:</span>{" "}
                <span className="text-slate-700">
                  {formatDate(order.order_date)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Itens:</span>{" "}
                <span className="text-slate-700">{items.length}</span>
              </div>
            </div>
            {order.notes && (
              <p className="mt-2 text-sm text-slate-600 italic">
                {order.notes}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(itemsTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {order.status === "confirmed" && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5">
          <h3 className="text-base font-semibold text-green-800">
            Pedido Confirmado
          </h3>
          <p className="mt-1 text-sm text-green-700">
            Estoque transferido do CD para a loja. Débito virtual gerado.
            {order.confirmed_at && ` Confirmado em ${formatDate(order.confirmed_at)}`}
          </p>
        </div>
      )}
      {order.status === "cancelled" && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <h3 className="text-base font-semibold text-red-800">
            Pedido Cancelado
          </h3>
          {order.cancelled_at && (
            <p className="mt-1 text-sm text-red-700">
              Cancelado em {formatDate(order.cancelled_at)}
            </p>
          )}
        </div>
      )}

      {/* Add item form (only if draft) */}
      {isDraft && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Adicionar Item
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Item
              </label>
              <select
                value={newItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione um item...</option>
                {availableItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Quantidade
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Preço Unit. (R$)
                {priceLoading && (
                  <span className="ml-1 text-primary-500">buscando...</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                placeholder={priceLoading ? "..." : "0,00"}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Subtotal
              </label>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                {formatCurrency(newLineTotal)}
              </div>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddItem}
                disabled={actionLoading || !newItemId || !newQuantity || !newUnitPrice}
                className="w-full"
              >
                Adicionar
              </Button>
            </div>
          </div>
          {newNotes !== undefined && (
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Observação do item (opcional)"
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-600"
            />
          )}
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Itens do Pedido ({items.length})
          </h3>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">Nenhum item adicionado.</p>
            {isDraft && (
              <p className="mt-1 text-xs text-slate-400">
                Use o formulário acima para adicionar itens ao pedido.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">
                  Item
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">
                  Qtd
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">
                  Preço Unit.
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">
                  Subtotal
                </th>
                {isDraft && (
                  <th className="text-center px-4 py-2.5 font-medium text-slate-600 w-28">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-900">
                      {item.item_name}
                    </span>
                    {item.notes && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editingItemId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="h-7 w-20 rounded border border-slate-300 px-2 text-right text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveQty(item.id);
                            if (e.key === "Escape") setEditingItemId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveQty(item.id)}
                          className="text-green-600 text-xs hover:underline"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <span
                        className={isDraft ? "cursor-pointer hover:text-primary-600 hover:underline" : ""}
                        onClick={() => {
                          if (isDraft) {
                            setEditingItemId(item.id);
                            setEditQty(String(item.quantity));
                          }
                        }}
                        title={isDraft ? "Clique para editar" : undefined}
                      >
                        {Number(item.quantity).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {formatCurrency(Number(item.unit_cost))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    {formatCurrency(Number(item.total_cost))}
                  </td>
                  {isDraft && (
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
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
                  className="px-4 py-3 text-right text-slate-700"
                >
                  TOTAL:
                </td>
                <td className="px-4 py-3 text-right text-lg text-slate-900">
                  {formatCurrency(itemsTotal)}
                </td>
                {isDraft && <td />}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Actions */}
      {isDraft && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Ações do Pedido
          </h3>
          <p className="text-sm text-slate-600">
            A confirmação é <strong>atômica e irreversível</strong>: gera estoque OUT no CD,
            IN na loja destino, e débito no banco virtual.
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={actionLoading || items.length === 0}
            >
              {actionLoading ? "Processando..." : "Confirmar Pedido"}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Cancelar Pedido
            </Button>
          </div>
          {items.length === 0 && (
            <p className="text-xs text-amber-600">
              Adicione pelo menos 1 item para poder confirmar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
