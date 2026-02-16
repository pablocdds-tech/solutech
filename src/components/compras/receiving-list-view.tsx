"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listReceivings } from "@/actions/compras";
import type { Receiving } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function ReceivingListView() {
  const router = useRouter();
  const [data, setData] = React.useState<Receiving[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listReceivings(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar recebimentos.");
    }
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const columns: Column<Receiving & Record<string, unknown>>[] = [
    {
      key: "created_at",
      header: "Data",
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
        const cfg = statusConfig[row.status] ?? { label: row.status, variant: "default" as const };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: "invoice_number",
      header: "Nº NF",
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.invoice_number ?? "—"}
        </span>
      ),
    },
    {
      key: "invoice_date",
      header: "Data NF",
      render: (row) =>
        row.invoice_date ? (
          <span className="text-sm text-slate-700">{formatDate(row.invoice_date)}</span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
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
      render: (row) => {
        const labels: Record<string, string> = {
          user: "Manual",
          ai: "IA",
          system: "Sistema",
          import: "Importação",
        };
        return <Badge variant="info">{labels[row.source_type] ?? row.source_type}</Badge>;
      },
    },
  ];

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {["all", "draft", "confirmed", "cancelled"].map((s) => (
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
        <Link href="/compras/novo">
          <Button variant="primary" size="sm">
            Novo Recebimento
          </Button>
        </Link>
      </div>

      {/* Resumo */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Rascunhos</p>
            <p className="mt-1 text-2xl font-semibold text-warning">
              {data.filter((r) => r.status === "draft").length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Confirmados</p>
            <p className="mt-1 text-2xl font-semibold text-success">
              {data.filter((r) => r.status === "confirmed").length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(
                data
                  .filter((r) => r.status === "confirmed")
                  .reduce((acc, r) => acc + Number(r.total_amount), 0)
              )}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data as (Receiving & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhum recebimento encontrado."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/compras/${row.id}`)}
      />
    </div>
  );
}
