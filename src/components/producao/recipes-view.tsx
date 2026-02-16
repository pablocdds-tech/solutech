"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { listRecipes, createRecipe } from "@/actions/producao";
import type { Recipe } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ItemOption {
  id: string;
  name: string;
}

export function RecipesView() {
  const router = useRouter();
  const [data, setData] = React.useState<Recipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [items, setItems] = React.useState<ItemOption[]>([]);
  const [activeFilter, setActiveFilter] = React.useState<"all" | "active">("all");

  const [newName, setNewName] = React.useState("");
  const [newOutputItemId, setNewOutputItemId] = React.useState("");
  const [newOutputQuantity, setNewOutputQuantity] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listRecipes();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar fichas técnicas.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadItems() {
      const supabase = createClient();
      const { data: itemsData } = await supabase
        .from("items")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (itemsData) setItems(itemsData as ItemOption[]);
    }
    loadItems();
  }, []);

  const filteredData = React.useMemo(() => {
    if (activeFilter === "active") return data.filter((r) => r.is_active);
    return data;
  }, [data, activeFilter]);

  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    items.forEach((i) => (m[i.id] = i.name));
    return m;
  }, [items]);

  async function handleCreate() {
    if (!newName.trim() || !newOutputItemId || !newOutputQuantity) return;
    const qty = parseFloat(newOutputQuantity);
    if (isNaN(qty) || qty <= 0) return;
    setActionLoading(true);
    setError(null);
    const result = await createRecipe({
      name: newName.trim(),
      outputItemId: newOutputItemId,
      outputQuantity: qty,
      description: newDescription.trim() || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewName("");
      setNewOutputItemId("");
      setNewOutputQuantity("");
      setNewDescription("");
      router.push(`/producao/fichas/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar ficha técnica.");
    }
    setActionLoading(false);
  }

  const columns: Column<Recipe & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Nome",
      render: (row) => (
        <span className="font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      key: "output_item_id",
      header: "Item de Saída",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {itemMap[row.output_item_id] ?? row.output_item_id.slice(0, 8) + "…"}
        </span>
      ),
    },
    {
      key: "output_quantity",
      header: "Qtd Saída",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.output_quantity).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => (
        <Badge variant={row.is_active ? "success" : "default"}>
          {row.is_active ? "Ativa" : "Inativa"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Criada em",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ];

  if (error && !showCreateForm) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === f
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "Todas" : "Apenas ativas"}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Nova Ficha
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Nova Ficha Técnica
          </h3>
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Fechar
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nome"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Bolo de Chocolate"
            />
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Item de Saída
              </label>
              <select
                value={newOutputItemId}
                onChange={(e) => setNewOutputItemId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione o item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Quantidade de Saída"
              type="number"
              step="0.0001"
              min="0"
              value={newOutputQuantity}
              onChange={(e) => setNewOutputQuantity(e.target.value)}
              placeholder="1"
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Textarea
                label="Descrição"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={actionLoading}
              disabled={!newName.trim() || !newOutputItemId || !newOutputQuantity}
            >
              Criar Ficha
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredData as (Recipe & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma ficha técnica encontrada."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/producao/fichas/${row.id}`)}
      />
    </div>
  );
}
