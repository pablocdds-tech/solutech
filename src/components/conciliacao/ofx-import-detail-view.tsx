"use client";

import * as React from "react";
import Link from "next/link";
import {
  getOfxImport,
  getOfxLines,
  detectMatches,
  applyMatch,
  markIgnored,
  unmatch,
} from "@/actions/conciliacao";
import type { OfxImport, OfxLine } from "@/types/database";
import type { ApPayable, ArReceivable, BankTransaction } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const lineStatusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  pending: { label: "Pendente", variant: "warning" },
  matched: { label: "Vinculado", variant: "success" },
  split: { label: "Rateado", variant: "info" },
  ignored: { label: "Ignorado", variant: "default" },
  created: { label: "Criado", variant: "success" },
};

type Suggestion = {
  type: "ap" | "ar" | "bank_tx";
  id: string;
  description: string;
  amount: number;
  score: number;
};

interface Props {
  importId: string;
}

export function OfxImportDetailView({ importId }: Props) {
  const [imp, setImp] = React.useState<OfxImport | null>(null);
  const [lines, setLines] = React.useState<OfxLine[]>([]);
  const [suggestionsMap, setSuggestionsMap] = React.useState<Map<string, Suggestion[]>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lineFilter, setLineFilter] = React.useState<"all" | "pending" | "matched" | "ignored">("all");
  const [apPayables, setApPayables] = React.useState<ApPayable[]>([]);
  const [arReceivables, setArReceivables] = React.useState<ArReceivable[]>([]);
  const [bankTransactions, setBankTransactions] = React.useState<BankTransaction[]>([]);
  const [expandedActions, setExpandedActions] = React.useState<string | null>(null);
  const [selectedBankTxId, setSelectedBankTxId] = React.useState("");
  const [selectedApId, setSelectedApId] = React.useState("");
  const [selectedArId, setSelectedArId] = React.useState("");
  const [ignoreReason, setIgnoreReason] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [impRes, linesRes, matchesRes] = await Promise.all([
      getOfxImport(importId),
      getOfxLines(importId),
      detectMatches(importId),
    ]);
    if (!impRes.success || !impRes.data) {
      setError(impRes.error ?? "Erro ao carregar importação");
      setLoading(false);
      return;
    }
    setImp(impRes.data);
    if (linesRes.success && linesRes.data) setLines(linesRes.data);
    if (matchesRes.success && matchesRes.data) {
      const map = new Map<string, Suggestion[]>();
      for (const item of matchesRes.data) {
        map.set(item.ofxLine.id, item.suggestions);
      }
      setSuggestionsMap(map);
    }
    setLoading(false);
  }, [importId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      if (!imp) return;
      const bankAccountId = imp.bank_account_id;
      const storeId = imp.store_id;
      const orgId = imp.org_id;

      const [apRes, arRes, txRes] = await Promise.all([
        supabase
          .from("ap_payables")
          .select("*")
          .eq("org_id", orgId)
          .eq("store_id", storeId)
          .in("status", ["pending", "partial"])
          .order("due_date"),
        supabase
          .from("ar_receivables")
          .select("*")
          .eq("org_id", orgId)
          .eq("store_id", storeId)
          .in("status", ["pending", "partial"])
          .order("due_date"),
        supabase
          .from("bank_transactions")
          .select("*")
          .eq("bank_account_id", bankAccountId)
          .eq("reconciled", false)
          .order("transaction_date", { ascending: false })
          .limit(50),
      ]);
      if (apRes.data) setApPayables(apRes.data as ApPayable[]);
      if (arRes.data) setArReceivables(arRes.data as ArReceivable[]);
      if (txRes.data) setBankTransactions(txRes.data as BankTransaction[]);
    }
    loadOptions();
  }, [imp]);

  const filteredLines = React.useMemo(() => {
    if (lineFilter === "all") return lines;
    if (lineFilter === "pending") return lines.filter((l) => l.status === "pending");
    if (lineFilter === "matched") return lines.filter((l) => ["matched", "split", "created"].includes(l.status));
    if (lineFilter === "ignored") return lines.filter((l) => l.status === "ignored");
    return lines;
  }, [lines, lineFilter]);

  async function handleApplyMatch(ofxLineId: string, opts: {
    bankTransactionId?: string;
    apPayableId?: string;
    arReceivableId?: string;
    createBankTx?: boolean;
  }) {
    setActionLoading(ofxLineId);
    setError(null);
    const result = await applyMatch({
      ofxLineId,
      ...opts,
    });
    if (result.success) {
      setExpandedActions(null);
      setSelectedBankTxId("");
      setSelectedApId("");
      setSelectedArId("");
      await loadData();
    } else {
      setError(result.error ?? "Erro");
    }
    setActionLoading(null);
  }

  async function handleMarkIgnored(ofxLineId: string) {
    setActionLoading(ofxLineId);
    setError(null);
    const result = await markIgnored(ofxLineId, ignoreReason.trim() || undefined);
    if (result.success) {
      setExpandedActions(null);
      setIgnoreReason("");
      await loadData();
    } else {
      setError(result.error ?? "Erro");
    }
    setActionLoading(null);
  }

  async function handleUnmatch(ofxLineId: string) {
    if (!window.confirm("Tem certeza que deseja desconciliar esta linha?")) return;
    const reasonInput = window.prompt("Motivo da desconciliar (opcional):");
    const reason = reasonInput != null && reasonInput.trim() ? reasonInput.trim() : undefined;
    setActionLoading(ofxLineId);
    setError(null);
    const result = await unmatch(ofxLineId, reason || undefined);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro");
    }
    setActionLoading(null);
  }

  const totalPending = lines.filter((l) => l.status === "pending").reduce((s, l) => s + l.amount, 0);
  const totalMatched = lines.filter((l) => ["matched", "split", "created"].includes(l.status)).reduce((s, l) => s + l.amount, 0);
  const totalIgnored = lines.filter((l) => l.status === "ignored").reduce((s, l) => s + l.amount, 0);

  if (loading && !imp) {
    return (
      <div className="p-8 text-center text-slate-500">Carregando...</div>
    );
  }

  if (!imp) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error ?? "Importação não encontrada."}
        <Link href="/conciliacao">
          <Button variant="outline" size="sm" className="ml-2">
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const total = imp.total_lines || 1;
  const done = (imp.matched_lines || 0) + (imp.ignored_lines || 0);
  const progressPct = Math.round((done / total) * 100);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error}{" "}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{imp.file_name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Status:{" "}
              <Badge
                variant={
                  imp.status === "completed"
                    ? "success"
                    : imp.status === "failed"
                    ? "danger"
                    : imp.status === "processing"
                    ? "info"
                    : "warning"
                }
              >
                {imp.status}
              </Badge>{" "}
              | Conta: {imp.bank_account_id.slice(0, 8)}...
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Total: {imp.total_lines ?? 0} | Match: {imp.matched_lines ?? 0} | Pend: {imp.pending_lines ?? 0} | Ign: {imp.ignored_lines ?? 0}
            </p>
          </div>
          <Link href="/conciliacao">
            <Button variant="outline" size="sm">
              &larr; Voltar
            </Button>
          </Link>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {done}/{total} processados ({progressPct}%)
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "matched", "ignored"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLineFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              lineFilter === tab ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab === "all" ? "Todas" : tab === "pending" ? "Pendentes" : tab === "matched" ? "Conciliadas" : "Ignoradas"}
          </button>
        ))}
      </div>

      {/* Line cards */}
      <div className="space-y-4">
        {filteredLines.map((line) => {
          const suggestions = suggestionsMap.get(line.id) ?? [];
          const isPending = line.status === "pending";
          const isMatched = ["matched", "split", "created"].includes(line.status);
          const isIgnored = line.status === "ignored";

          return (
            <div
              key={line.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {formatDate(line.transaction_date)}
                    </span>
                    <span
                      className={`font-semibold ${
                        line.amount >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatCurrency(line.amount)}
                    </span>
                    <Badge variant={lineStatusConfig[line.status]?.variant ?? "default"}>
                      {lineStatusConfig[line.status]?.label ?? line.status}
                    </Badge>
                    {line.fitid && (
                      <span className="text-xs text-slate-500">fitid: {line.fitid.slice(0, 12)}</span>
                    )}
                  </div>
                  {line.description && (
                    <p className="mt-1 text-sm text-slate-700">{line.description}</p>
                  )}
                  {line.memo && (
                    <p className="mt-0.5 text-xs text-slate-500">{line.memo}</p>
                  )}
                </div>
              </div>

              {/* Matched / Split / Created */}
              {isMatched && line.bank_transaction_id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-600">
                    TX: <code className="rounded bg-slate-100 px-1">{line.bank_transaction_id.slice(0, 8)}</code>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => handleUnmatch(line.id)}
                    loading={actionLoading === line.id}
                  >
                    Desconciliar
                  </Button>
                </div>
              )}

              {/* Ignored */}
              {isIgnored && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {line.notes && (
                    <p className="text-sm text-slate-600 mb-2">{line.notes}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnmatch(line.id)}
                    loading={actionLoading === line.id}
                  >
                    Desconciliar (reverter)
                  </Button>
                </div>
              )}

              {/* Pending: suggestions + actions */}
              {isPending && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">Sugestões</p>
                      <ul className="space-y-1">
                        {suggestions.map((s) => (
                          <li key={`${s.type}-${s.id}`} className="text-sm">
                            <span className="text-slate-700">
                              {s.type === "ap" && "AP"} {s.type === "ar" && "AR"} {s.type === "bank_tx" && "TX"}:{" "}
                              {s.description} — {formatCurrency(s.amount)}{" "}
                              <Badge variant="info">{(s.score * 100).toFixed(0)}%</Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplyMatch(line.id, { createBankTx: true })}
                      loading={actionLoading === line.id}
                    >
                      Conciliar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBankTxId("");
                        setExpandedActions(expandedActions === line.id ? null : line.id);
                      }}
                    >
                      Vincular a TX existente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedApId("");
                        setExpandedActions(expandedActions === `ap-${line.id}` ? null : `ap-${line.id}`);
                      }}
                    >
                      Vincular AP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedArId("");
                        setExpandedActions(expandedActions === `ar-${line.id}` ? null : `ar-${line.id}`);
                      }}
                    >
                      Vincular AR
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIgnoreReason("");
                        setExpandedActions(expandedActions === `ignore-${line.id}` ? null : `ignore-${line.id}`);
                      }}
                    >
                      Ignorar
                    </Button>
                  </div>

                  {/* Expanded: Bank TX select */}
                  {expandedActions === line.id && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Transação bancária</label>
                      <select
                        value={selectedBankTxId}
                        onChange={(e) => setSelectedBankTxId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      >
                        <option value="">Selecione...</option>
                        {bankTransactions.map((tx) => (
                          <option key={tx.id} value={tx.id}>
                            {formatDate(tx.transaction_date)} — {formatCurrency(tx.amount)} — {tx.description?.slice(0, 30)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedBankTxId) {
                            handleApplyMatch(line.id, { bankTransactionId: selectedBankTxId });
                          }
                        }}
                        disabled={!selectedBankTxId}
                        loading={actionLoading === line.id}
                      >
                        Vincular
                      </Button>
                    </div>
                  )}

                  {/* Expanded: AP select */}
                  {expandedActions === `ap-${line.id}` && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Conta a Pagar</label>
                      <select
                        value={selectedApId}
                        onChange={(e) => setSelectedApId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      >
                        <option value="">Selecione...</option>
                        {apPayables.map((ap) => (
                          <option key={ap.id} value={ap.id}>
                            {ap.description?.slice(0, 40)} — {formatCurrency(ap.amount)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedApId) {
                            handleApplyMatch(line.id, { apPayableId: selectedApId, createBankTx: true });
                          }
                        }}
                        disabled={!selectedApId}
                        loading={actionLoading === line.id}
                      >
                        Vincular AP
                      </Button>
                    </div>
                  )}

                  {/* Expanded: AR select */}
                  {expandedActions === `ar-${line.id}` && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Conta a Receber</label>
                      <select
                        value={selectedArId}
                        onChange={(e) => setSelectedArId(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      >
                        <option value="">Selecione...</option>
                        {arReceivables.map((ar) => (
                          <option key={ar.id} value={ar.id}>
                            {ar.description?.slice(0, 40)} — {formatCurrency(ar.amount)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedArId) {
                            handleApplyMatch(line.id, { arReceivableId: selectedArId, createBankTx: true });
                          }
                        }}
                        disabled={!selectedArId}
                        loading={actionLoading === line.id}
                      >
                        Vincular AR
                      </Button>
                    </div>
                  )}

                  {/* Expanded: Ignore reason */}
                  {expandedActions === `ignore-${line.id}` && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 space-y-2">
                      <Input
                        label="Motivo (opcional)"
                        value={ignoreReason}
                        onChange={(e) => setIgnoreReason(e.target.value)}
                        placeholder="Ex: duplicado, lançamento manual"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleMarkIgnored(line.id)}
                        loading={actionLoading === line.id}
                      >
                        Ignorar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredLines.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-8 text-center text-slate-500">
          Nenhuma linha para este filtro.
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Resumo</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-600">Valor pendente</p>
            <p className="mt-1 text-xl font-semibold text-warning">{formatCurrency(totalPending)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Valor conciliado</p>
            <p className="mt-1 text-xl font-semibold text-success">{formatCurrency(totalMatched)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Valor ignorado</p>
            <p className="mt-1 text-xl font-semibold text-slate-500">{formatCurrency(totalIgnored)}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Reprocessar importação não duplica linhas (idempotente por fitid/hash). Desconciliar reverte AP/AR e bank_tx com auditoria.
      </p>
    </div>
  );
}
