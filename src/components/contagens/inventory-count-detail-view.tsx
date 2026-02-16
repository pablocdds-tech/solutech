"use client";

import * as React from "react";
import Link from "next/link";
import {
  getInventoryCount,
  getCountItems,
  addCountItem,
  updateCountItem,
  approveInventoryCount,
} from "@/actions/contagens";
import type { InventoryCount, InventoryCountItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  open: { label: "Aberta", variant: "info" },
  counting: { label: "Em contagem", variant: "warning" },
  review: { label: "Em revisão", variant: "default" },
  approved: { label: "Aprovada", variant: "success" },
  cancelled: { label: "Cancelada", variant: "danger" },
};

interface Props {
  countId: string;
}

interface ItemOption {
  id: string;
  name: string;
}

export function InventoryCountDetailView({ countId }: Props) {
  const [count, setCount] = React.useState<InventoryCount | null>(null);
  const [items, setItems] = React.useState<InventoryCountItem[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<ItemOption[]>([]);
  const [storeName, setStoreName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newItemId, setNewItemId] = React.useState("");
  const [newExpectedQty, setNewExpectedQty] = React.useState("");
  const [countedQtyMap, setCountedQtyMap] = React.useState<
    Record<string, string>
  >({});

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [countRes, itemsRes] = await Promise.all([
      getInventoryCount(countId),
      getCountItems(countId),
    ]);

    if (countRes.success && countRes.data) {
      setCount(countRes.data);
      const supabase = createClient();
      const { data: storeData } = await supabase
        .from("stores")
        .select("name")
        .eq("id", countRes.data.store_id)
        .single();
      if (storeData) setStoreName((storeData as { name: string }).name);
    } else {
      setError(countRes.error ?? "Erro ao carregar contagem.");
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
      const map: Record<string, string> = {};
      itemsRes.data.forEach((i) => {
        map[i.id] = String(i.counted_quantity ?? "");
      });
      setCountedQtyMap(map);
    }

    const supabase = createClient();
    const { data: catData } = await supabase
      .from("items")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (catData) setCatalogItems(catData as ItemOption[]);

    setLoading(false);
  }, [countId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    catalogItems.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [catalogItems]);

  const isOpen = count?.status === "open" || count?.status === "counting";
  const isApproved = count?.status === "approved";
  const canApprove =
    count?.status === "review" || count?.status === "counting";

  async function handleAddItem() {
    if (!newItemId || !newExpectedQty.trim()) return;
    const qty = parseFloat(newExpectedQty);
    if (isNaN(qty) || qty < 0) return;
    setActionLoading(true);
    setError(null);
    const result = await addCountItem(countId, {
      itemId: newItemId,
      expectedQuantity: qty,
    });
    if (result.success && result.data) {
      setNewItemId("");
      setNewExpectedQty("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar item.");
    }
    setActionLoading(false);
  }

  async function handleUpdateCounted(itemId: string, value: string) {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    setActionLoading(true);
    setError(null);
    const result = await updateCountItem(itemId, {
      countedQuantity: qty,
    });
    if (result.success) {
      setCountedQtyMap((prev) => ({ ...prev, [itemId]: value }));
      await loadData();
    } else {
      setError(result.error ?? "Erro ao atualizar quantidade contada.");
    }
    setActionLoading(false);
  }

  async function handleApprove() {
    setActionLoading(true);
    setError(null);
    const result = await approveInventoryCount(countId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao aprovar contagem.");
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

  if (!count) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        Contagem não encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      <Link href="/contagens">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{count.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Badge variant={statusConfig[count.status]?.variant ?? "default"}>
                {statusConfig[count.status]?.label ?? count.status}
              </Badge>
              <span className="text-sm text-slate-600">
                Data: {formatDate(count.count_date)}
              </span>
              <span className="text-sm text-slate-600">
                Loja: {storeName || count.store_id.slice(0, 8) + "…"}
              </span>
              <span className="text-sm text-slate-600">
                Total: {count.total_items} | Contados: {count.counted_items} |
                Divergentes: {count.divergent_items}
              </span>
            </div>
            {count.description && (
              <p className="mt-2 text-sm text-slate-600">{count.description}</p>
            )}
          </div>
        </div>
        {count.access_token && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">
              Token de acesso (link compartilhável)
            </p>
            <p className="mt-1 font-mono text-sm text-slate-900 break-all">
              {count.access_token}
            </p>
          </div>
        )}
      </div>

      {/* Add items form (open or counting) */}
      {isOpen && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Adicionar item à contagem
          </h3>
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
              label="Quantidade esperada"
              type="number"
              step="0.0001"
              min="0"
              value={newExpectedQty}
              onChange={(e) => setNewExpectedQty(e.target.value)}
              placeholder="0"
            />
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddItem}
                loading={actionLoading}
                disabled={!newItemId || !newExpectedQty.trim()}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Itens ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item na contagem.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Item
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Esperada
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Contada
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Diferença
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const diff = it.difference ?? 0;
                  const diffColor =
                    diff < 0
                      ? "text-danger"
                      : diff > 0
                        ? "text-success"
                        : "text-slate-700";
                  return (
                    <tr key={it.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {itemMap[it.item_id] ?? it.item_id.slice(0, 8) + "…"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {Number(it.expected_quantity).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isApproved ? (
                          <span className="text-slate-700">
                            {it.counted_quantity != null
                              ? Number(it.counted_quantity).toLocaleString(
                                  "pt-BR",
                                  { minimumFractionDigits: 2 }
                                )
                              : "—"}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={countedQtyMap[it.id] ?? ""}
                            onChange={(e) =>
                              setCountedQtyMap((prev) => ({
                                ...prev,
                                [it.id]: e.target.value,
                              }))
                            }
                            onBlur={(e) =>
                              handleUpdateCounted(it.id, e.target.value)
                            }
                            className="h-8 w-24 rounded border border-slate-300 px-2 text-right text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${diffColor}`}>
                        {diff !== 0
                          ? (diff > 0 ? "+" : "") +
                            diff.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })
                          : "0"}
                      </td>
                      <td className="px-3 py-2">
                        {it.is_divergent && (
                          <Badge variant="danger">Divergente</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve button */}
      {canApprove && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <p className="text-sm text-slate-600">
            A aprovação gera inventory_moves ADJUST para divergências.
          </p>
          <Button
            variant="primary"
            onClick={handleApprove}
            loading={actionLoading}
          >
            Aprovar Contagem
          </Button>
        </div>
      )}

      {/* Approved banner */}
      {isApproved && (
        <div className="rounded-xl border-2 border-success/50 bg-success/5 p-6">
          <h3 className="text-lg font-semibold text-success">
            Contagem Aprovada
          </h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
            {count.approved_at && (
              <span>Aprovada em: {formatDateTime(count.approved_at)}</span>
            )}
            <span>Divergentes: {count.divergent_items}</span>
            <span>
              Aprovação gera ajustes de estoque (inventory_moves ADJUST) para
              os itens divergentes.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
