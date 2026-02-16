"use client";

import * as React from "react";
import Link from "next/link";
import {
  getProductionOrder,
  getOrderConsumptions,
  getOrderLosses,
  startProductionOrder,
  registerConsumption,
  registerLoss,
  finalizeProductionOrder,
  getRecipe,
} from "@/actions/producao";
import type {
  ProductionOrder,
  ProductionConsumption,
  ProductionLoss,
  Recipe,
} from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orderId: string;
}

interface ItemOption {
  id: string;
  name: string;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  in_progress: { label: "Em Andamento", variant: "info" },
  finalized: { label: "Finalizado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function ProductionOrderDetailView({ orderId }: Props) {
  const [order, setOrder] = React.useState<ProductionOrder | null>(null);
  const [consumptions, setConsumptions] = React.useState<ProductionConsumption[]>([]);
  const [losses, setLosses] = React.useState<ProductionLoss[]>([]);
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [storeName, setStoreName] = React.useState<string>("");
  const [catalogItems, setCatalogItems] = React.useState<ItemOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newConsItemId, setNewConsItemId] = React.useState("");
  const [newConsQuantity, setNewConsQuantity] = React.useState("");
  const [newConsUnitCost, setNewConsUnitCost] = React.useState("");
  const [newLossItemId, setNewLossItemId] = React.useState("");
  const [newLossQuantity, setNewLossQuantity] = React.useState("");
  const [newLossUnitCost, setNewLossUnitCost] = React.useState("");
  const [newLossReason, setNewLossReason] = React.useState("");
  const [actualQuantity, setActualQuantity] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orderRes, consRes, lossesRes] = await Promise.all([
      getProductionOrder(orderId),
      getOrderConsumptions(orderId),
      getOrderLosses(orderId),
    ]);

    if (orderRes.success && orderRes.data) {
      setOrder(orderRes.data);
      setActualQuantity(
        String(
          orderRes.data.actual_quantity ?? orderRes.data.planned_quantity ?? ""
        )
      );
      const recipeRes = await getRecipe(orderRes.data.recipe_id);
      if (recipeRes.success && recipeRes.data) {
        setRecipe(recipeRes.data);
      }
      const supabase = createClient();
      const { data: storeData } = await supabase
        .from("stores")
        .select("name")
        .eq("id", orderRes.data.store_id)
        .single();
      if (storeData) setStoreName((storeData as { name: string }).name);
    } else {
      setError(orderRes.error ?? "Erro ao carregar ordem.");
    }

    if (consRes.success && consRes.data) setConsumptions(consRes.data);
    if (lossesRes.success && lossesRes.data) setLosses(lossesRes.data);

    const supabase = createClient();
    const { data: catData } = await supabase
      .from("items")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (catData) setCatalogItems(catData as ItemOption[]);

    setLoading(false);
  }, [orderId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    catalogItems.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [catalogItems]);

  const isDraft = order?.status === "draft";
  const isInProgress = order?.status === "in_progress";
  const isFinalized = order?.status === "finalized";
  const canEdit = isDraft || isInProgress;

  async function handleStart() {
    setActionLoading(true);
    setError(null);
    const result = await startProductionOrder(orderId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao iniciar produção");
    }
    setActionLoading(false);
  }

  async function handleAddConsumption() {
    if (!newConsItemId || !newConsQuantity || !newConsUnitCost) return;
    const qty = parseFloat(newConsQuantity);
    const cost = parseFloat(newConsUnitCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    setActionLoading(true);
    const result = await registerConsumption(orderId, {
      itemId: newConsItemId,
      quantity: qty,
      unitCost: cost,
    });
    if (result.success) {
      setNewConsItemId("");
      setNewConsQuantity("");
      setNewConsUnitCost("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao registrar consumo");
    }
    setActionLoading(false);
  }

  async function handleAddLoss() {
    if (!newLossItemId || !newLossQuantity || !newLossUnitCost) return;
    const qty = parseFloat(newLossQuantity);
    const cost = parseFloat(newLossUnitCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    setActionLoading(true);
    const result = await registerLoss(orderId, {
      itemId: newLossItemId,
      quantity: qty,
      unitCost: cost,
      reason: newLossReason.trim() || undefined,
    });
    if (result.success) {
      setNewLossItemId("");
      setNewLossQuantity("");
      setNewLossUnitCost("");
      setNewLossReason("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao registrar perda");
    }
    setActionLoading(false);
  }

  async function handleFinalize() {
    const qty = parseFloat(actualQuantity);
    if (isNaN(qty) || qty <= 0) return;
    setActionLoading(true);
    setError(null);
    const result = await finalizeProductionOrder(orderId, qty);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao finalizar ordem");
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
        Ordem não encontrada.
      </div>
    );
  }

  const consumptionsTotal = consumptions.reduce(
    (sum, c) => sum + Number(c.total_cost),
    0
  );
  const lossesTotal = losses.reduce((sum, l) => sum + Number(l.total_cost), 0);

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

      <Link href="/producao/ordens">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Ordem de Produção
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Badge
                variant={statusConfig[order.status]?.variant ?? "default"}
              >
                {statusConfig[order.status]?.label ?? order.status}
              </Badge>
              <span className="text-sm text-slate-600">
                Receita: {recipe?.name ?? order.recipe_id.slice(0, 8) + "…"}
              </span>
              <span className="text-sm text-slate-600">
                Loja: {storeName || order.store_id.slice(0, 8) + "…"}
              </span>
              <span className="text-sm text-slate-600">
                Planejada:{" "}
                {Number(order.planned_quantity).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
              {order.actual_quantity != null && (
                <span className="text-sm text-slate-600">
                  Real:{" "}
                  {Number(order.actual_quantity).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>Data planejada: {formatDate(order.planned_date)}</span>
              {order.started_at && (
                <span>Iniciada: {formatDateTime(order.started_at)}</span>
              )}
              {order.finalized_at && (
                <span>Finalizada: {formatDateTime(order.finalized_at)}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium text-slate-900">
              <span>Custo unit. real: {formatCurrency(Number(order.real_unit_cost))}</span>
              <span>Custo insumos: {formatCurrency(Number(order.total_input_cost))}</span>
              <span>Perdas: {formatCurrency(Number(order.total_loss_cost))}</span>
            </div>
          </div>
        </div>
        {order.notes && (
          <p className="mt-3 text-sm text-slate-600">{order.notes}</p>
        )}
      </div>

      {/* Start production button (draft only) */}
      {isDraft && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <Button
            variant="primary"
            onClick={handleStart}
            loading={actionLoading}
          >
            Iniciar Produção
          </Button>
        </div>
      )}

      {/* Finalized banner */}
      {isFinalized && (
        <div className="rounded-xl border-2 border-success/50 bg-success/5 p-6">
          <h3 className="text-lg font-semibold text-success">
            Ordem Finalizada
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-5">
            {order.finalized_at && (
              <span>Finalizada em: {formatDateTime(order.finalized_at)}</span>
            )}
            <span>Custo unit. real: {formatCurrency(Number(order.real_unit_cost))}</span>
            <span>Custo insumos: {formatCurrency(Number(order.total_input_cost))}</span>
            <span>Perdas: {formatCurrency(Number(order.total_loss_cost))}</span>
            {order.actual_quantity != null && (
              <span>
                Qtd real:{" "}
                {Number(order.actual_quantity).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Consumptions section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Consumos ({consumptions.length})
        </h3>

        {canEdit && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-900">
              Registrar Consumo
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Item
                </label>
                <select
                  value={newConsItemId}
                  onChange={(e) => setNewConsItemId(e.target.value)}
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
                value={newConsQuantity}
                onChange={(e) => setNewConsQuantity(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Custo Unit."
                type="number"
                step="0.01"
                min="0"
                value={newConsUnitCost}
                onChange={(e) => setNewConsUnitCost(e.target.value)}
                placeholder="0,00"
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={handleAddConsumption}
                  loading={actionLoading}
                  disabled={
                    !newConsItemId || !newConsQuantity || !newConsUnitCost
                  }
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        )}

        {consumptions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum consumo registrado.</p>
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
                </tr>
              </thead>
              <tbody>
                {consumptions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {itemMap[c.item_id] ?? c.item_id}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(c.quantity).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(Number(c.unit_cost))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(Number(c.total_cost))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-700">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {formatCurrency(consumptionsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Losses section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Perdas ({losses.length})
        </h3>

        {canEdit && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-900">
              Registrar Perda
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Item
                </label>
                <select
                  value={newLossItemId}
                  onChange={(e) => setNewLossItemId(e.target.value)}
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
                value={newLossQuantity}
                onChange={(e) => setNewLossQuantity(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Custo Unit."
                type="number"
                step="0.01"
                min="0"
                value={newLossUnitCost}
                onChange={(e) => setNewLossUnitCost(e.target.value)}
                placeholder="0,00"
              />
              <Input
                label="Motivo"
                type="text"
                value={newLossReason}
                onChange={(e) => setNewLossReason(e.target.value)}
                placeholder="Opcional"
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={handleAddLoss}
                  loading={actionLoading}
                  disabled={
                    !newLossItemId || !newLossQuantity || !newLossUnitCost
                  }
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        )}

        {losses.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma perda registrada.</p>
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
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {losses.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {itemMap[l.item_id] ?? l.item_id}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(l.quantity).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(Number(l.unit_cost))}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(Number(l.total_cost))}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {l.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-700">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {formatCurrency(lossesTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Finalize section (draft or in_progress) */}
      {canEdit && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Finalizar Ordem
          </h3>
          <p className="text-sm text-slate-600">
            A finalização gera: OUT insumos + IN produto acabado com custo real
            calculado. Atômica.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <Input
              label="Quantidade Real"
              type="number"
              step="0.0001"
              min="0"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              placeholder="Quantidade produzida"
            />
            <Button
              variant="primary"
              onClick={handleFinalize}
              loading={actionLoading}
              disabled={
                !actualQuantity || parseFloat(actualQuantity) <= 0
              }
            >
              Finalizar Ordem
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
