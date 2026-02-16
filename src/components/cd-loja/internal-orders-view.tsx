"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listInternalOrders, createInternalOrder } from "@/actions/cd-loja";
import type { InternalOrder } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

const sourceTypeLabels: Record<string, string> = {
  user: "Manual",
  ai: "IA",
  system: "Sistema",
  import: "Importação",
};

interface StoreOption {
  id: string;
  name: string;
  type: string;
}

export function InternalOrdersView() {
  const router = useRouter();
  const [data, setData] = React.useState<InternalOrder[]>([]);
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

  const columns: Column<InternalOrder & Record<string, unknown>>[] = [
    {
      key: "created_at",
      header: "Criado em",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.created_at)}
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
      key: "order_date",
      header: "Data Pedido",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.order_date)}
        </span>
      ),
    },
    {
      key: "total_amount",
      header: "Valor Total",
      className: "text-right",
      render: (row) => (
        <span className="text-right font-medium text-slate-900">
          {formatCurrency(Number(row.total_amount))}
        </span>
      ),
    },
    {
      key: "source_type",
      header: "Origem",
      render: (row) => (
        <Badge variant="info">
          {sourceTypeLabels[row.source_type] ?? row.source_type}
        </Badge>
      ),
    },
  ];

  const draftsCount = data.filter((r) => r.status === "draft").length;
  const confirmedCount = data.filter((r) => r.status === "confirmed").length;
  const totalConfirmado = data
    .filter((r) => r.status === "confirmed")
    .reduce((acc, r) => acc + Number(r.total_amount), 0);

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
              {s === "all"
                ? "Todos"
                : statusConfig[s]?.label ?? s}
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
            Novo Pedido
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Novo Pedido Interno
          </h3>
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline"
              >
                Fechar
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Loja Origem (CD)
              </label>
              <select
                value={newSourceStoreId}
                onChange={(e) => setNewSourceStoreId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
                Loja Destino
              </label>
              <select
                value={newDestStoreId}
                onChange={(e) => setNewDestStoreId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Rascunhos</p>
            <p className="mt-1 text-2xl font-semibold text-warning">
              {draftsCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Confirmados</p>
            <p className="mt-1 text-2xl font-semibold text-success">
              {confirmedCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total valor confirmado</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(totalConfirmado)}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data as (InternalOrder & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhum pedido interno encontrado."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/cd-loja/${row.id}`)}
      />
    </div>
  );
}
