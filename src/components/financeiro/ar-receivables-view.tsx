"use client";

import * as React from "react";
import Link from "next/link";
import { listArReceivables, createArReceivable, receiveAr } from "@/actions/financeiro";
import type { ArReceivable } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusCfg: Record<string, { label: string; variant: "warning" | "success" | "danger" | "info" }> = {
  pending: { label: "Pendente", variant: "warning" },
  partial: { label: "Parcial", variant: "info" },
  received: { label: "Recebido", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function ArReceivablesView() {
  const [data, setData] = React.useState<ArReceivable[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [showCreate, setShowCreate] = React.useState(false);
  const [showReceive, setShowReceive] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Create form
  const [stores, setStores] = React.useState<{ id: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; store_id: string }[]>([]);
  const [newStoreId, setNewStoreId] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newAmount, setNewAmount] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");

  // Receive form
  const [receiveBankAccountId, setReceiveBankAccountId] = React.useState("");
  const [receiveAmount, setReceiveAmount] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listArReceivables(opts);
    if (result.success && result.data) setData(result.data);
    else setError(result.error ?? "Erro");
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadOpts() {
      const supabase = createClient();
      const [s, b] = await Promise.all([
        supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("id, name, store_id").eq("is_active", true).order("name"),
      ]);
      if (s.data) setStores(s.data);
      if (b.data) setBankAccounts(b.data);
    }
    loadOpts();
  }, []);

  async function handleCreate() {
    if (!newStoreId || !newDesc || !newAmount || !newDueDate) return;
    setActionLoading(true);
    const result = await createArReceivable({
      storeId: newStoreId,
      description: newDesc,
      amount: parseFloat(newAmount),
      dueDate: newDueDate,
    });
    if (result.success) {
      setShowCreate(false);
      setNewStoreId("");
      setNewDesc("");
      setNewAmount("");
      setNewDueDate("");
      await loadData();
    } else setError(result.error ?? "Erro");
    setActionLoading(false);
  }

  async function handleReceive(receivableId: string) {
    if (!receiveBankAccountId || !receiveAmount) return;
    setActionLoading(true);
    const result = await receiveAr({
      receivableId,
      bankAccountId: receiveBankAccountId,
      amount: parseFloat(receiveAmount),
    });
    if (result.success) {
      setShowReceive(null);
      setReceiveBankAccountId("");
      setReceiveAmount("");
      await loadData();
    } else setError(result.error ?? "Erro");
    setActionLoading(false);
  }

  const columns: Column<ArReceivable & Record<string, unknown>>[] = [
    {
      key: "due_date",
      header: "Vencimento",
      render: (r) => {
        const overdue = r.status === "pending" && new Date(r.due_date) < new Date();
        return (
          <span className={overdue ? "font-medium text-danger" : "text-slate-700"}>
            {formatDate(r.due_date)}
            {overdue && (
              <Badge variant="danger" className="ml-1">
                Vencido
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={statusCfg[r.status]?.variant ?? "default"}>
          {statusCfg[r.status]?.label ?? r.status}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      render: (r) => <span className="font-medium text-slate-900">{r.description}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      className: "text-right",
      render: (r) => <span className="text-right font-medium">{formatCurrency(Number(r.amount))}</span>,
    },
    {
      key: "received_amount",
      header: "Recebido",
      className: "text-right",
      render: (r) => (
        <span className="text-right text-sm text-slate-600">
          {formatCurrency(Number(r.received_amount))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status !== "received" && r.status !== "cancelled" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowReceive(r.id);
              setReceiveAmount(String(Number(r.amount) - Number(r.received_amount)));
            }}
          >
            Receber
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {["all", "pending", "partial", "received"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {s === "all" ? "Todos" : statusCfg[s]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro">
            <Button variant="outline" size="sm">
              &larr; Voltar
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Fechar" : "Nova AR"}
          </Button>
        </div>
      </div>

      {/* Criar AR */}
      {showCreate && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 space-y-3">
          <h3 className="font-semibold text-slate-900">Nova Conta a Receber</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
              <select
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Descrição"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              required
            />
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              required
            />
            <Input
              label="Vencimento"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              required
            />
          </div>
          <Button size="sm" onClick={handleCreate} loading={actionLoading}>
            Criar
          </Button>
        </div>
      )}

      {/* Modal Receber */}
      {showReceive && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3">
          <h3 className="font-semibold text-slate-900">Receber Conta</h3>
          <p className="text-xs text-slate-600">
            O recebimento gera uma transação bancária (CREDIT) como evidência.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária</label>
              <select
                value={receiveBankAccountId}
                onChange={(e) => setReceiveBankAccountId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                required
              >
                <option value="">Selecione...</option>
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
              value={receiveAmount}
              onChange={(e) => setReceiveAmount(e.target.value)}
              required
            />
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                onClick={() => handleReceive(showReceive)}
                loading={actionLoading}
              >
                Confirmar Recebimento
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReceive(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Pendentes</p>
            <p className="mt-1 text-2xl font-semibold text-warning">
              {formatCurrency(
                data
                  .filter((d) => d.status === "pending")
                  .reduce((s, d) => s + Number(d.amount) - Number(d.received_amount), 0)
              )}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Vencidos</p>
            <p className="mt-1 text-2xl font-semibold text-danger">
              {data.filter((d) => d.status === "pending" && new Date(d.due_date) < new Date()).length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total Recebido</p>
            <p className="mt-1 text-2xl font-semibold text-success">
              {formatCurrency(data.reduce((s, d) => s + Number(d.received_amount), 0))}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data as (ArReceivable & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma conta a receber."
        getRowKey={(r) => r.id}
      />
    </div>
  );
}
