"use client";

import * as React from "react";
import Link from "next/link";
import {
  getRecipe,
  getRecipeItems,
  addRecipeItem,
  removeRecipeItem,
} from "@/actions/producao";
import type { Recipe, RecipeItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface Props {
  recipeId: string;
}

interface ItemOption {
  id: string;
  name: string;
}

export function RecipeDetailView({ recipeId }: Props) {
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [items, setItems] = React.useState<RecipeItem[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<ItemOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newItemId, setNewItemId] = React.useState("");
  const [newQuantity, setNewQuantity] = React.useState("");
  const [newLossPercent, setNewLossPercent] = React.useState("0");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [recipeRes, itemsRes] = await Promise.all([
      getRecipe(recipeId),
      getRecipeItems(recipeId),
    ]);

    if (recipeRes.success && recipeRes.data) {
      setRecipe(recipeRes.data);
    } else {
      setError(recipeRes.error ?? "Erro ao carregar ficha técnica.");
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
    if (catData) setCatalogItems(catData as ItemOption[]);

    setLoading(false);
  }, [recipeId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    catalogItems.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [catalogItems]);

  async function handleAddItem() {
    if (!newItemId || !newQuantity) return;
    const qty = parseFloat(newQuantity);
    const loss = parseFloat(newLossPercent);
    if (isNaN(qty) || qty <= 0) return;
    setActionLoading(true);
    const result = await addRecipeItem(recipeId, {
      itemId: newItemId,
      quantity: qty,
      lossPercentage: isNaN(loss) ? 0 : loss,
    });
    if (result.success) {
      setNewItemId("");
      setNewQuantity("");
      setNewLossPercent("0");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar insumo");
    }
    setActionLoading(false);
  }

  async function handleRemoveItem(recipeItemId: string) {
    setActionLoading(true);
    const result = await removeRecipeItem(recipeItemId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao remover insumo");
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

  if (!recipe) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        Ficha técnica não encontrada.
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

      <Link href="/producao/fichas">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{recipe.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Badge variant={recipe.is_active ? "success" : "default"}>
                {recipe.is_active ? "Ativa" : "Inativa"}
              </Badge>
              <span className="text-sm text-slate-600">
                Item de saída: {itemMap[recipe.output_item_id] ?? recipe.output_item_id.slice(0, 8) + "…"}
              </span>
              <span className="text-sm text-slate-600">
                Qtd: {Number(recipe.output_quantity).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {recipe.description && (
              <p className="mt-2 text-sm text-slate-600">{recipe.description}</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        A ficha técnica define a composição da receita para ordens de produção.
      </p>

      {/* Insumos section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Insumos ({items.length})
        </h3>

        {/* Add insumo form */}
        <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-900">Adicionar Insumo</h4>
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
              label="Perda %"
              type="number"
              step="0.01"
              min="0"
              value={newLossPercent}
              onChange={(e) => setNewLossPercent(e.target.value)}
              placeholder="0"
            />
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddItem}
                loading={actionLoading}
                disabled={!newItemId || !newQuantity}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum insumo adicionado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Item
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Quantidade
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                    Perda %
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600">
                    Ações
                  </th>
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
                      {Number(item.loss_percentage).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
