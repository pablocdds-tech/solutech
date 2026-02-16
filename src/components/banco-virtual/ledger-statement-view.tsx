"use client";

import * as React from "react";
import Link from "next/link";
import { getVirtualLedgerStatement } from "@/actions/banco-virtual";
import type { VirtualLedgerStatement } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface LedgerStatementViewProps {
  storeId: string;
}

export function LedgerStatementView({ storeId }: LedgerStatementViewProps) {
  const [data, setData] = React.useState<VirtualLedgerStatement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const result = await getVirtualLedgerStatement(storeId, 100, 0);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? "Erro ao carregar extrato.");
      }
      setLoading(false);
    }
    load();
  }, [storeId]);

  const entryTypeConfig: Record<
    string,
    { label: string; variant: "danger" | "success" | "warning"; sign: string }
  > = {
    DEBIT: { label: "Débito", variant: "danger", sign: "+" },
    CREDIT: { label: "Crédito", variant: "success", sign: "-" },
    ADJUST: { label: "Ajuste", variant: "warning", sign: "" },
  };

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200" />
            </div>
            <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/banco-virtual">
          <Button variant="outline" size="sm">
            &larr; Voltar
          </Button>
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-slate-900">
            Nenhum lançamento
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Esta loja ainda não possui lançamentos no banco virtual.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Data/Hora
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Descrição
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Referência
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Valor
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Saldo
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, idx) => {
                const config = entryTypeConfig[entry.entry_type] ?? {
                  label: entry.entry_type,
                  variant: "default" as const,
                  sign: "",
                };
                const amount = Number(entry.amount);
                const runningBalance = Number(entry.running_balance);

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      idx % 2 === 1 ? "bg-slate-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-900">{entry.description}</span>
                      {entry.notes && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.reference_type ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          entry.entry_type === "DEBIT"
                            ? "text-danger"
                            : entry.entry_type === "CREDIT"
                              ? "text-success"
                              : "text-warning"
                        }`}
                      >
                        {config.sign}
                        {formatCurrency(amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          runningBalance > 0
                            ? "text-danger"
                            : runningBalance < 0
                              ? "text-success"
                              : "text-slate-900"
                        }`}
                      >
                        {formatCurrency(runningBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.created_by_name ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
