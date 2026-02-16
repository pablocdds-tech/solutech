"use client";

import * as React from "react";
import Link from "next/link";
import { listInventoryMoves } from "@/actions/estoque";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface MoveRow extends Record<string, unknown> {
  id: string;
  store_id: string;
  item_id: string;
  move_type: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  notes: string | null;
  source_type: string;
  created_at: string;
  item_name?: string;
  store_name?: string;
}

export function InventoryMovesView() {
  const [data, setData] = React.useState<MoveRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const opts: { moveType?: string; limit?: number } = { limit: 100 };
    if (filter !== "all") opts.moveType = filter;
    const result = await listInventoryMoves(opts);
    if (result.success && result.data) {
      setData(result.data as MoveRow[]);
    } else {
      setError(result.error ?? "Erro ao carregar movimentos.");
    }
    setLoading(false);
  }, [filter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const moveTypeLabel: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
    IN: { label: "Entrada", variant: "success" },
    OUT: { label: "Saída", variant: "danger" },
    ADJUST: { label: "Ajuste", variant: "warning" },
  };

  const columns: Column<MoveRow>[] = [
    {
      key: "created_at",
      header: "Data/Hora",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "move_type",
      header: "Tipo",
      render: (row) => {
        const info = moveTypeLabel[row.move_type] ?? {
          label: row.move_type,
          variant: "default" as const,
        };
        return <Badge variant={info.variant}>{info.label}</Badge>;
      },
    },
    {
      key: "store_name",
      header: "Loja",
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.store_name ?? "-"}
        </span>
      ),
    },
    {
      key: "item_name",
      header: "Item",
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.item_name ?? "-"}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Qtd",
      className: "text-right",
      render: (row) => (
        <span
          className={`text-right font-medium ${
            row.move_type === "OUT"
              ? "text-danger"
              : row.move_type === "IN"
                ? "text-success"
                : "text-slate-900"
          }`}
        >
          {row.move_type === "OUT" ? "-" : ""}
          {Number(row.quantity).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "unit_cost",
      header: "Custo Unit.",
      className: "text-right",
      render: (row) => (
        <span className="text-right text-sm text-slate-700">
          {formatCurrency(Number(row.unit_cost))}
        </span>
      ),
    },
    {
      key: "total_cost",
      header: "Custo Total",
      className: "text-right",
      render: (row) => (
        <span className="text-right font-medium text-slate-900">
          {formatCurrency(Number(row.total_cost))}
        </span>
      ),
    },
    {
      key: "reference_type",
      header: "Referência",
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.reference_type ?? "-"}
        </span>
      ),
    },
    {
      key: "source_type",
      header: "Origem",
      render: (row) => {
        const labels: Record<string, string> = {
          user: "Usuário",
          ai: "IA",
          system: "Sistema",
          import: "Importação",
        };
        return (
          <Badge variant="info">{labels[row.source_type] ?? row.source_type}</Badge>
        );
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
          {["all", "IN", "OUT", "ADJUST"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === type
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {type === "all"
                ? "Todos"
                : moveTypeLabel[type]?.label ?? type}
            </button>
          ))}
        </div>
        <Link href="/estoque">
          <Button variant="outline" size="sm">
            Posição de Estoque
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Nenhum movimento encontrado."
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
