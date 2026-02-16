"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  listInventoryCounts,
  createInventoryCount,
} from "@/actions/contagens";
import type { InventoryCount } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
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

interface StoreOption {
  id: string;
  name: string;
}

export function InventoryCountsView() {
  const router = useRouter();
  const [data, setData] = React.useState<InventoryCount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stores, setStores] = React.useState<StoreOption[]>([]);

  const [newStoreId, setNewStoreId] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [newCountDate, setNewCountDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [newDescription, setNewDescription] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listInventoryCounts();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar contagens.");
    }
    setLoading(false);
  }, []);

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

  async function handleCreate() {
    if (!newStoreId || !newTitle.trim()) return;
    setActionLoading(true);
    setError(null);
    const result = await createInventoryCount({
      storeId: newStoreId,
      title: newTitle.trim(),
      countDate: newCountDate || undefined,
      description: newDescription.trim() || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewStoreId("");
      setNewTitle("");
      setNewCountDate(new Date().toISOString().split("T")[0]);
      setNewDescription("");
      await loadData();
      router.push(`/contagens/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar contagem.");
    }
    setActionLoading(false);
  }

  const storeMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    stores.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [stores]);

  const total = data.length;
  const abertas = data.filter((c) => c.status === "open").length;
  const emContagem = data.filter((c) => c.status === "counting").length;
  const aprovadas = data.filter((c) => c.status === "approved").length;

  const columns: Column<InventoryCount & Record<string, unknown>>[] = [
    {
      key: "title",
      header: "Título",
      render: (row) => (
        <span className="text-sm font-medium text-slate-900">{row.title}</span>
      ),
    },
    {
      key: "count_date",
      header: "Data",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.count_date)}
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
      key: "store_id",
      header: "Loja",
      render: (row) => (
        <span className="text-sm text-slate-700 font-mono">
          {(storeMap[row.store_id] ?? row.store_id).slice(0, 8)}
          {(storeMap[row.store_id] ?? row.store_id).length > 8 ? "…" : ""}
        </span>
      ),
    },
    {
      key: "total_items",
      header: "Total itens",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.total_items)}
        </span>
      ),
    },
    {
      key: "counted_items",
      header: "Contados",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.counted_items)}
        </span>
      ),
    },
    {
      key: "divergent_items",
      header: "Divergentes",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.divergent_items)}
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
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Total contagens</p>
          <p className="text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Abertas</p>
          <p className="text-2xl font-semibold text-info">{abertas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Em contagem</p>
          <p className="text-2xl font-semibold text-warning">{emContagem}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Aprovadas</p>
          <p className="text-2xl font-semibold text-success">{aprovadas}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Nova Contagem
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Nova Contagem
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
            <Input
              label="Título"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Contagem mensal"
            />
            <Input
              label="Data da contagem"
              type="date"
              value={newCountDate}
              onChange={(e) => setNewCountDate(e.target.value)}
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
              disabled={!newStoreId || !newTitle.trim()}
            >
              Criar Contagem
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
        data={data as (InventoryCount & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma contagem encontrada."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/contagens/${row.id}`)}
      />
    </div>
  );
}
