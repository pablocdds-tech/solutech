"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  listProductionOrders,
  createProductionOrder,
  listRecipes,
} from "@/actions/producao";
import type { ProductionOrder, Recipe } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  in_progress: { label: "Em Andamento", variant: "info" },
  finalized: { label: "Finalizado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

interface StoreOption {
  id: string;
  name: string;
}

export function ProductionOrdersView() {
  const router = useRouter();
  const [data, setData] = React.useState<ProductionOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);

  const [newStoreId, setNewStoreId] = React.useState("");
  const [newRecipeId, setNewRecipeId] = React.useState("");
  const [newPlannedQuantity, setNewPlannedQuantity] = React.useState("");
  const [newPlannedDate, setNewPlannedDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [newNotes, setNewNotes] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listProductionOrders(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar ordens de produção.");
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
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (storesData) setStores(storesData as StoreOption[]);
    }
    loadStores();
  }, []);

  React.useEffect(() => {
    async function loadRecipes() {
      const result = await listRecipes();
      if (result.success && result.data) setRecipes(result.data);
    }
    loadRecipes();
  }, []);

  async function handleCreate() {
    if (!newStoreId || !newRecipeId || !newPlannedQuantity) return;
    const qty = parseFloat(newPlannedQuantity);
    if (isNaN(qty) || qty <= 0) return;
    setActionLoading(true);
    setError(null);
    const result = await createProductionOrder({
      storeId: newStoreId,
      recipeId: newRecipeId,
      plannedQuantity: qty,
      plannedDate: newPlannedDate || undefined,
      notes: newNotes.trim() || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewStoreId("");
      setNewRecipeId("");
      setNewPlannedQuantity("");
      setNewPlannedDate(new Date().toISOString().split("T")[0]);
      setNewNotes("");
      router.push(`/producao/ordens/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar ordem.");
    }
    setActionLoading(false);
  }

  const columns: Column<ProductionOrder & Record<string, unknown>>[] = [
    {
      key: "planned_date",
      header: "Data Planejada",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.planned_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const cfg =
          statusConfig[row.status] ?? {
            label: row.status,
            variant: "default" as const,
          };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: "recipe_id",
      header: "Receita",
      render: (row) => (
        <span className="text-sm text-slate-700 font-mono">
          {String(row.recipe_id).slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "planned_quantity",
      header: "Qtd Planejada",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.planned_quantity).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "actual_quantity",
      header: "Qtd Real",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.actual_quantity != null
            ? Number(row.actual_quantity).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "real_unit_cost",
      header: "Custo Unit. Real",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {formatCurrency(Number(row.real_unit_cost))}
        </span>
      ),
    },
    {
      key: "total_input_cost",
      header: "Custo Insumos",
      className: "text-right",
      render: (row) => (
        <span className="text-right font-medium text-slate-900">
          {formatCurrency(Number(row.total_input_cost))}
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
          {(["all", "draft", "in_progress", "finalized", "cancelled"] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s === "all" ? "Todas" : statusConfig[s]?.label ?? s}
              </button>
            )
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Nova Ordem
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Nova Ordem de Produção
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
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Loja
              </label>
              <select
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione a loja</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Receita
              </label>
              <select
                value={newRecipeId}
                onChange={(e) => setNewRecipeId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione a receita</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Quantidade Planejada"
              type="number"
              step="0.0001"
              min="0"
              value={newPlannedQuantity}
              onChange={(e) => setNewPlannedQuantity(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Data Planejada"
              type="date"
              value={newPlannedDate}
              onChange={(e) => setNewPlannedDate(e.target.value)}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Textarea
                label="Observações"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
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
              disabled={!newStoreId || !newRecipeId || !newPlannedQuantity}
            >
              Criar Ordem
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
        data={data as (ProductionOrder & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma ordem de produção encontrada."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/producao/ordens/${row.id}`)}
      />
    </div>
  );
}
