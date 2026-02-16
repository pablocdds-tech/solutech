"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  getRowKey?: (item: T) => string;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "Nenhum registro encontrado.",
  loading = false,
  getRowKey,
}: DataTableProps<T>) {
  const getKey = (item: T, index: number) => {
    if (getRowKey) return getRowKey(item);
    const id = item.id ?? item._id ?? index;
    return String(id);
  };

  if (loading) {
    return (
      <div className="w-full overflow-auto rounded-[var(--radius-lg)] border border-slate-200 bg-surface">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left font-medium text-slate-600",
                    col.className
                  )}
                >
                  <span className="inline-block h-4 w-24 animate-pulse rounded bg-slate-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-0"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <span className="inline-block h-4 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description="Tente ajustar os filtros ou adicionar novos dados."
      />
    );
  }

  return (
    <div className="w-full overflow-auto rounded-[var(--radius-lg)] border border-slate-200 bg-surface">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left font-medium text-slate-600",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={getKey(item, index)}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "border-b border-slate-100 last:border-0 transition-colors",
                index % 2 === 1 && "bg-slate-50/50",
                onRowClick && "cursor-pointer hover:bg-primary-50/50"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-slate-700",
                    col.className
                  )}
                >
                  {col.render
                    ? col.render(item)
                    : String(item[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
