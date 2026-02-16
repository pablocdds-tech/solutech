"use client";

import * as React from "react";
import Link from "next/link";
import { settleVirtualBalance } from "@/actions/cd-loja";
import { getVirtualLedgerBalances } from "@/actions/banco-virtual";
import type { VirtualLedgerBalance } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface BankAccountOption {
  id: string;
  name: string;
  store_id: string;
}

export function SettleVirtualView() {
  const [balances, setBalances] = React.useState<VirtualLedgerBalance[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccountOption[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );

  const [storeId, setStoreId] = React.useState("");
  const [bankAccountId, setBankAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const [balRes, bankResult] = await Promise.all([
      getVirtualLedgerBalances(),
      supabase
        .from("bank_accounts")
        .select("id, name, store_id")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (balRes.success && balRes.data) {
      setBalances(balRes.data);
    } else {
      setError(balRes.error ?? "Erro ao carregar saldos do banco virtual.");
    }

    if (bankResult.data) setBankAccounts(bankResult.data as BankAccountOption[]);

    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const storesWithBalance = balances.filter((b) => Number(b.balance) > 0);

  async function handleSettle() {
    if (!storeId || !bankAccountId || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    const result = await settleVirtualBalance({
      storeId,
      bankAccountId,
      amount: amt,
      description: description || "Liquidação banco virtual",
    });
    if (result.success) {
      setSuccessMessage("Liquidação realizada com sucesso.");
      setStoreId("");
      setBankAccountId("");
      setAmount("");
      setDescription("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao liquidar.");
    }
    setActionLoading(false);
  }

  if (error && !loading && balances.length === 0) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/cd-loja">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      <p className="text-sm text-slate-600">
        O pagamento gera: transação bancária DEBIT + CREDIT no banco virtual +
        audit.
      </p>

      {/* Virtual balance cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="h-5 w-32 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-40 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {balances.map((b) => {
            const bal = Number(b.balance);
            const hasDebt = bal > 0;
            return (
              <div
                key={b.store_id}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {b.store_name}
                    </h3>
                    <Badge
                      variant={
                        b.store_type === "cd" ? "info" : "default"
                      }
                    >
                      {b.store_type === "cd" ? "CD" : "Loja"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-2xl font-bold ${
                        hasDebt ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatCurrency(bal)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {hasDebt
                        ? "Deve ao CD"
                        : bal < 0
                          ? "Crédito"
                          : "Zerado"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settlement form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Liquidar Saldo
        </h3>

        {successMessage && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success font-medium">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
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
              Loja (com saldo a liquidar)
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <option value="">Selecione a loja</option>
              {storesWithBalance.map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.store_name} ({formatCurrency(Number(s.balance))})
                </option>
              ))}
              {storesWithBalance.length === 0 && !loading && (
                <option value="" disabled>
                  Nenhuma loja com saldo pendente
                </option>
              )}
            </select>
          </div>
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Conta Bancária
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <option value="">Selecione a conta</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            required
          />
          <div className="sm:col-span-2">
            <Input
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Liquidação banco virtual"
            />
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleSettle}
          loading={actionLoading}
          disabled={!storeId || !bankAccountId || !amount}
        >
          Liquidar
        </Button>
      </div>
    </div>
  );
}
