"use client";

import * as React from "react";
import Link from "next/link";
import {
  getReceiving,
  getReceivingItems,
  getReceivingPayments,
  addReceivingItem,
  resolveLineItemMatch,
  ignoreLineItem,
  removeReceivingItem,
  setPaymentPlan,
  validateReceivingDraft,
  confirmReceiving,
  cancelReceivingDraft,
  updateReceivingHeader,
} from "@/actions/compras";
import type { Receiving, ReceivingItem, ReceivingPayment } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  receivingId: string;
}

interface CatalogItem {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

const matchConfig: Record<string, { label: string; variant: "warning" | "success" | "info" | "default" }> = {
  pending: { label: "Pendente", variant: "warning" },
  matched: { label: "Vinculado", variant: "success" },
  created: { label: "Novo Item", variant: "info" },
  ignored: { label: "Ignorado", variant: "default" },
};

export function ReceivingDetailView({ receivingId }: Props) {
  const [rec, setRec] = React.useState<Receiving | null>(null);
  const [items, setItems] = React.useState<ReceivingItem[]>([]);
  const [payments, setPayments] = React.useState<ReceivingPayment[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [validation, setValidation] = React.useState<{ valid: boolean; issues: string[] } | null>(null);

  // Add item form state
  const [showAddItem, setShowAddItem] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemQty, setNewItemQty] = React.useState("");
  const [newItemCost, setNewItemCost] = React.useState("");
  const [newItemCatalogId, setNewItemCatalogId] = React.useState("");

  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  const [paymentDate, setPaymentDate] = React.useState("");
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [payInstallments, setPayInstallments] = React.useState<{ dueDate: string; amount: number }[]>([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const [recRes, itemsRes, paymentsRes] = await Promise.all([
      getReceiving(receivingId),
      getReceivingItems(receivingId),
      getReceivingPayments(receivingId),
    ]);

    if (recRes.success && recRes.data) setRec(recRes.data);
    else setError(recRes.error ?? "Erro ao carregar recebimento.");

    if (itemsRes.success && itemsRes.data) setItems(itemsRes.data);
    if (paymentsRes.success && paymentsRes.data) setPayments(paymentsRes.data);

    // Load catalog items for matching
    const supabase = createClient();
    const { data: catItems } = await supabase
      .from("items")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (catItems) setCatalogItems(catItems as CatalogItem[]);

    setLoading(false);
  }, [receivingId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const isDraft = rec?.status === "draft";

  // === Ações de Itens ===
  async function handleAddItem() {
    if (!newItemName || !newItemQty || !newItemCost) return;
    setActionLoading(true);
    const result = await addReceivingItem(receivingId, {
      supplierItemName: newItemName,
      quantity: parseFloat(newItemQty),
      unitCost: parseFloat(newItemCost),
      itemId: newItemCatalogId || undefined,
      matchedStatus: newItemCatalogId ? "matched" : "pending",
    });
    if (result.success) {
      setShowAddItem(false);
      setNewItemName("");
      setNewItemQty("");
      setNewItemCost("");
      setNewItemCatalogId("");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar item");
    }
    setActionLoading(false);
  }

  async function handleMatchItem(itemId: string, catalogItemId: string) {
    setActionLoading(true);
    await resolveLineItemMatch(itemId, { catalogItemId });
    await loadData();
    setActionLoading(false);
  }

  async function handleIgnoreItem(itemId: string) {
    setActionLoading(true);
    await ignoreLineItem(itemId);
    await loadData();
    setActionLoading(false);
  }

  async function handleRemoveItem(itemId: string) {
    setActionLoading(true);
    await removeReceivingItem(itemId);
    await loadData();
    setActionLoading(false);
  }

  // === Ações de Pagamento ===
  function handleAddInstallment() {
    if (!paymentDate || !paymentAmount) return;
    setPayInstallments([
      ...payInstallments,
      { dueDate: paymentDate, amount: parseFloat(paymentAmount) },
    ]);
    setPaymentDate("");
    setPaymentAmount("");
  }

  async function handleSavePaymentPlan() {
    if (payInstallments.length === 0) return;
    setActionLoading(true);
    const result = await setPaymentPlan(receivingId, payInstallments);
    if (result.success) {
      setShowPaymentForm(false);
      setPayInstallments([]);
      await loadData();
    } else {
      setError(result.error ?? "Erro ao salvar parcelas");
    }
    setActionLoading(false);
  }

  // === Ações Principais ===
  async function handleValidate() {
    setActionLoading(true);
    const result = await validateReceivingDraft(receivingId);
    if (result.success && result.data) {
      setValidation(result.data);
    } else {
      setError(result.error ?? "Erro ao validar");
    }
    setActionLoading(false);
  }

  async function handleConfirm() {
    setActionLoading(true);
    setError(null);
    const result = await confirmReceiving(receivingId);
    if (result.success) {
      await loadData();
      setValidation(null);
    } else {
      setError(result.error ?? "Erro ao confirmar");
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!confirm("Deseja realmente cancelar este rascunho?")) return;
    setActionLoading(true);
    const result = await cancelReceivingDraft(receivingId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao cancelar");
    }
    setActionLoading(false);
  }

  async function handleUpdateTotal() {
    const total = items.reduce((sum, it) => sum + Number(it.total_cost), 0);
    await updateReceivingHeader(receivingId, { totalAmount: total });
    await loadData();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-64 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!rec) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        Recebimento não encontrado.
      </div>
    );
  }

  const pendingItems = items.filter((i) => i.matched_status === "pending").length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      {/* Voltar */}
      <Link href="/compras">
        <Button variant="outline" size="sm">&larr; Voltar</Button>
      </Link>

      {/* CABEÇALHO */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              NF {rec.invoice_number ?? "S/N"}
              {rec.invoice_series && <span className="ml-1 text-sm text-slate-500">Série {rec.invoice_series}</span>}
            </h2>
            <div className="mt-1 flex items-center gap-3">
              <Badge variant={statusConfig[rec.status]?.variant ?? "default"}>
                {statusConfig[rec.status]?.label ?? rec.status}
              </Badge>
              {rec.invoice_date && (
                <span className="text-sm text-slate-600">Data NF: {formatDate(rec.invoice_date)}</span>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(Number(rec.total_amount))}</p>
        </div>

        {rec.invoice_key && (
          <p className="mt-3 text-xs text-slate-500 font-mono break-all">
            Chave: {rec.invoice_key}
          </p>
        )}
        {rec.notes && <p className="mt-2 text-sm text-slate-600">{rec.notes}</p>}
      </div>

      {/* ITENS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Itens ({items.length})
            {pendingItems > 0 && (
              <Badge variant="warning" className="ml-2">{pendingItems} pendente(s)</Badge>
            )}
          </h3>
          {isDraft && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleUpdateTotal}>
                Recalcular Total
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowAddItem(!showAddItem)}>
                {showAddItem ? "Fechar" : "Adicionar Item"}
              </Button>
            </div>
          )}
        </div>

        {/* Form adicionar item */}
        {showAddItem && isDraft && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Nome (NF)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Nome do item na NF"
                required
              />
              <Input
                label="Qtd"
                type="number"
                step="0.0001"
                min="0"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                required
              />
              <Input
                label="Custo Unit."
                type="number"
                step="0.01"
                min="0"
                value={newItemCost}
                onChange={(e) => setNewItemCost(e.target.value)}
                required
              />
              <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Vincular ao Cadastro
                </label>
                <select
                  value={newItemCatalogId}
                  onChange={(e) => setNewItemCatalogId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <option value="">Pendente...</option>
                  {catalogItems.map((ci) => (
                    <option key={ci.id} value={ci.id}>{ci.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button size="sm" onClick={handleAddItem} loading={actionLoading}>
              Adicionar
            </Button>
          </div>
        )}

        {/* Lista de itens */}
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Item NF</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Qtd</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Custo Unit.</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Total</th>
                  {isDraft && (
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-900">{item.supplier_item_name}</span>
                      {item.supplier_item_code && (
                        <span className="ml-1 text-xs text-slate-500">({item.supplier_item_code})</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={matchConfig[item.matched_status]?.variant ?? "default"}>
                        {matchConfig[item.matched_status]?.label ?? item.matched_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(item.unit_cost))}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.total_cost))}</td>
                    {isDraft && (
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {item.matched_status === "pending" && (
                            <>
                              <select
                                className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleMatchItem(item.id, e.target.value);
                                }}
                              >
                                <option value="">Vincular...</option>
                                {catalogItems.map((ci) => (
                                  <option key={ci.id} value={ci.id}>{ci.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleIgnoreItem(item.id)}
                                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                                title="Ignorar"
                              >
                                Ignorar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                            title="Remover"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={isDraft ? 4 : 4} className="px-3 py-2 text-right text-slate-700">
                    Total Itens:
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {formatCurrency(items.reduce((sum, it) => sum + Number(it.total_cost), 0))}
                  </td>
                  {isDraft && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* PLANO DE PAGAMENTO */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Plano de Pagamento ({payments.length} parcela{payments.length !== 1 ? "s" : ""})
          </h3>
          {isDraft && (
            <Button variant="primary" size="sm" onClick={() => setShowPaymentForm(!showPaymentForm)}>
              {showPaymentForm ? "Fechar" : "Definir Parcelas"}
            </Button>
          )}
        </div>

        {showPaymentForm && isDraft && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <div className="flex items-end gap-3">
              <Input
                label="Vencimento"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <Input
                label="Valor (R$)"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={handleAddInstallment}>
                Adicionar
              </Button>
            </div>

            {payInstallments.length > 0 && (
              <div className="space-y-2">
                {payInstallments.map((inst, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded bg-white p-2 text-sm">
                    <span>Parcela {idx + 1}: {formatDate(inst.dueDate)}</span>
                    <span className="font-medium">{formatCurrency(inst.amount)}</span>
                    <button
                      onClick={() =>
                        setPayInstallments(payInstallments.filter((_, i) => i !== idx))
                      }
                      className="text-xs text-danger hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">
                    Total: {formatCurrency(payInstallments.reduce((s, i) => s + i.amount, 0))}
                  </span>
                  <Button size="sm" onClick={handleSavePaymentPlan} loading={actionLoading}>
                    Salvar Plano
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {payments.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Parcela</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Vencimento</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{p.installment}ª</td>
                    <td className="px-3 py-2">{formatDate(p.due_date)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-right text-slate-700">Total:</td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {formatCurrency(payments.reduce((s, p) => s + Number(p.amount), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* VALIDAÇÃO & AÇÕES */}
      {isDraft && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Confirmar Recebimento</h3>

          {validation && (
            <div
              className={`rounded-lg border p-4 ${
                validation.valid
                  ? "border-success/30 bg-success/5"
                  : "border-danger/30 bg-danger/5"
              }`}
            >
              {validation.valid ? (
                <p className="text-sm font-medium text-success">
                  Rascunho válido. Pronto para confirmar.
                </p>
              ) : (
                <div>
                  <p className="text-sm font-medium text-danger">Problemas encontrados:</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-danger">
                    {validation.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleValidate} loading={actionLoading}>
              Validar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={actionLoading}
              disabled={validation !== null && !validation.valid}
            >
              Confirmar Recebimento
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
              Cancelar Rascunho
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            A confirmação gera automaticamente: entrada de estoque (IN) na loja destino + contas a pagar (AP) na loja faturada.
            Operação atômica e idempotente.
          </p>
        </div>
      )}

      {/* Info para confirmados */}
      {rec.status === "confirmed" && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-6">
          <h3 className="text-lg font-semibold text-success">Recebimento Confirmado</h3>
          <p className="mt-1 text-sm text-slate-700">
            Confirmado em {rec.confirmed_at ? formatDate(rec.confirmed_at) : "—"}.
            Estoque e contas a pagar gerados automaticamente.
          </p>
        </div>
      )}

      {rec.status === "cancelled" && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
          <h3 className="text-lg font-semibold text-danger">Recebimento Cancelado</h3>
          <p className="mt-1 text-sm text-slate-700">
            Cancelado em {rec.cancelled_at ? formatDate(rec.cancelled_at) : "—"}.
          </p>
        </div>
      )}
    </div>
  );
}
