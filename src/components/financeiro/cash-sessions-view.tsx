"use client";

import * as React from "react";
import Link from "next/link";
import {
  listCashSessions,
  openCashSession,
  closeCashSession,
} from "@/actions/financeiro";
import type { CashSession } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function CashSessionsView() {
  const [data, setData] = React.useState<CashSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stores, setStores] = React.useState<{ id: string; name: string }[]>([]);

  // Open form
  const [openStoreId, setOpenStoreId] = React.useState("");
  const [openingBalance, setOpeningBalance] = React.useState("");

  // Close form (per session)
  const [closingSessionId, setClosingSessionId] = React.useState<string | null>(null);
  const [closingBalance, setClosingBalance] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const result = await listCashSessions();
    if (result.success && result.data) setData(result.data);
    else setError(result.error ?? "Erro");
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadStores() {
      const supabase = createClient();
      const { data: s } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (s) setStores(s);
    }
    loadStores();
  }, []);

  async function handleOpen() {
    if (!openStoreId || openingBalance === "") return;
    setActionLoading(true);
    const result = await openCashSession({
      storeId: openStoreId,
      openingBalance: parseFloat(openingBalance),
    });
    if (result.success) {
      setOpenStoreId("");
      setOpeningBalance("");
      await loadData();
    } else setError(result.error ?? "Erro");
    setActionLoading(false);
  }

  async function handleClose(sessionId: string) {
    if (!closingBalance || closingSessionId !== sessionId) return;
    setActionLoading(true);
    const result = await closeCashSession({
      sessionId,
      closingBalance: parseFloat(closingBalance),
    });
    if (result.success) {
      setClosingSessionId(null);
      setClosingBalance("");
      await loadData();
    } else setError(result.error ?? "Erro");
    setActionLoading(false);
  }

  const openSessions = data.filter((s) => s.status === "open");

  const columns: Column<CashSession & Record<string, unknown>>[] = [
    {
      key: "opened_at",
      header: "Abertura",
      render: (r) => formatDate(r.opened_at),
    },
    {
      key: "store_id",
      header: "Loja",
      render: (r) => r.store_id,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "open" ? "success" : "default"}>
          {r.status === "open" ? "Aberto" : "Fechado"}
        </Badge>
      ),
    },
    {
      key: "opening_balance",
      header: "Abertura",
      className: "text-right",
      render: (r) => (
        <span className="text-right">{formatCurrency(Number(r.opening_balance))}</span>
      ),
    },
    {
      key: "closing_balance",
      header: "Fechamento",
      className: "text-right",
      render: (r) => (
        <span className="text-right">
          {r.closing_balance != null ? formatCurrency(Number(r.closing_balance)) : "-"}
        </span>
      ),
    },
    {
      key: "difference",
      header: "Diferença",
      className: "text-right",
      render: (r) => {
        const diff = r.difference != null ? Number(r.difference) : null;
        if (diff === null) return <span className="text-right">-</span>;
        return (
          <span
            className={`text-right font-medium ${diff < 0 ? "text-danger" : "text-success"}`}
          >
            {formatCurrency(diff)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "open" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setClosingSessionId(r.id);
              setClosingBalance("");
            }}
          >
            Fechar Caixa
          </Button>
        ) : null,
    },
  ];

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
        <h2 className="text-lg font-semibold text-slate-900">Sessões de Caixa</h2>
        <Link href="/financeiro">
          <Button variant="outline" size="sm">
            &larr; Voltar
          </Button>
        </Link>
      </div>

      {/* Sessões abertas - formulário de fechamento */}
      {openSessions.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
          <h3 className="font-semibold text-slate-900">Caixas Abertos</h3>
          {openSessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <span className="text-sm text-slate-700">
                Loja {s.store_id} — Aberto em {formatDate(s.opened_at)}
              </span>
              {closingSessionId === s.id ? (
                <>
                  <Input
                    label="Saldo ao fechar (R$)"
                    type="number"
                    step="0.01"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    className="w-36"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleClose(s.id)}
                    loading={actionLoading}
                  >
                    Fechar Caixa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setClosingSessionId(null);
                      setClosingBalance("");
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClosingSessionId(s.id);
                    setClosingBalance("");
                  }}
                >
                  Fechar Caixa
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Abrir Caixa */}
      <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">Abrir Caixa</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
            <select
              value={openStoreId}
              onChange={(e) => setOpenStoreId(e.target.value)}
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
            label="Saldo inicial (R$)"
            type="number"
            step="0.01"
            min="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            required
          />
          <div className="flex items-end">
            <Button size="sm" onClick={handleOpen} loading={actionLoading}>
              Abrir Caixa
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de sessões anteriores */}
      <DataTable
        columns={columns}
        data={data as (CashSession & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma sessão de caixa."
        getRowKey={(r) => r.id}
      />
    </div>
  );
}
