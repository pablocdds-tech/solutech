"use client";

import * as React from "react";
import Link from "next/link";
import { getBankBalances, listBankTransactions } from "@/actions/financeiro";
import type { BankBalance, BankTransaction } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export function BankBalanceView() {
  const [balances, setBalances] = React.useState<BankBalance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = React.useState<string | null>(null);
  const [transactionsByAccount, setTransactionsByAccount] = React.useState<
    Record<string, BankTransaction[]>
  >({});
  const [transactionsLoading, setTransactionsLoading] = React.useState<Record<string, boolean>>({});

  const loadBalances = React.useCallback(async () => {
    setLoading(true);
    const result = await getBankBalances();
    if (result.success && result.data) setBalances(result.data);
    else setError(result.error ?? "Erro");
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  async function loadTransactions(bankAccountId: string) {
    if (transactionsByAccount[bankAccountId]) return;
    setTransactionsLoading((prev) => ({ ...prev, [bankAccountId]: true }));
    const result = await listBankTransactions({ bankAccountId, limit: 30 });
    if (result.success && result.data) {
      setTransactionsByAccount((prev) => ({ ...prev, [bankAccountId]: result.data ?? [] }));
    }
    setTransactionsLoading((prev) => ({ ...prev, [bankAccountId]: false }));
  }

  function toggleExpand(bankAccountId: string) {
    setExpandedAccountId((prev) => (prev === bankAccountId ? null : bankAccountId));
    if (expandedAccountId !== bankAccountId) {
      loadTransactions(bankAccountId);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error}{" "}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Saldos Bancários</h2>
        <Link href="/financeiro">
          <Button variant="outline" size="sm">
            &larr; Voltar
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-4 animate-pulse"
            >
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-8 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => (
              <div
                key={b.bank_account_id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-sm font-medium text-slate-700">{b.account_name}</p>
                <p className="text-xs text-slate-500">{b.bank_name ?? "-"}</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${Number(b.balance) >= 0 ? "text-success" : "text-danger"}`}
                >
                  {formatCurrency(Number(b.balance))}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>Créditos: {formatCurrency(Number(b.total_credits))}</span>
                  <span>Débitos: {formatCurrency(Number(b.total_debits))}</span>
                  <span>Pend. conciliação: {b.pending_reconciliation}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => toggleExpand(b.bank_account_id)}
                >
                  {expandedAccountId === b.bank_account_id
                    ? "Ocultar Transações"
                    : "Ver Transações"}
                </Button>
              </div>
            ))}
          </div>

          {/* Expanded transactions */}
          {expandedAccountId && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Transações Recentes</h3>
              {transactionsLoading[expandedAccountId] ? (
                <div className="flex items-center gap-2 py-4">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  <span className="text-sm text-slate-600">Carregando...</span>
                </div>
              ) : (transactionsByAccount[expandedAccountId] ?? []).length === 0 ? (
                <p className="py-4 text-sm text-slate-600">Nenhuma transação encontrada.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Data</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">
                          Descrição
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600">Valor</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">
                          Conciliado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(transactionsByAccount[expandedAccountId] ?? []).map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-3 text-slate-700">
                            {formatDate(tx.transaction_date)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={tx.type === "credit" ? "success" : "danger"}>
                              {tx.type === "credit" ? "Crédito" : "Débito"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{tx.description}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(Number(tx.amount))}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={tx.reconciled ? "success" : "default"}>
                              {tx.reconciled ? "Sim" : "Não"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
