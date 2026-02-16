"use client";

import * as React from "react";
import Link from "next/link";
import {
  getSale,
  getSaleItems,
  getSalePayments,
  addSaleItem,
  removeSaleItem,
  addSalePayment,
  removeSalePayment,
  confirmSale,
  cancelSale,
} from "@/actions/vendas";
import type { Sale, SaleItem, SalePayment } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  saleId: string;
}

interface CatalogItem {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

interface StoreOption {
  id: string;
  name: string;
}

interface SalesChannelOption {
  id: string;
  name: string;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
};

export function SaleDetailView({ saleId }: Props) {
  const [sale, setSale] = React.useState<Sale | null>(null);
  const [items, setItems] = React.useState<SaleItem[]>([]);
  const [payments, setPayments] = React.useState<SalePayment[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<
    PaymentMethodOption[]
  >([]);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [salesChannels, setSalesChannels] = React.useState<SalesChannelOption[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newItemId, setNewItemId] = React.useState("");
  const [newQuantity, setNewQuantity] = React.useState("");
  const [newUnitPrice, setNewUnitPrice] = React.useState("");
  const [newItemDiscount, setNewItemDiscount] = React.useState("0");

  const [newPaymentMethodId, setNewPaymentMethodId] = React.useState("");
  const [newAmount, setNewAmount] = React.useState("");
  const [newInstallments, setNewInstallments] = React.useState("1");
  const [newDaysToReceive, setNewDaysToReceive] = React.useState("0");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [saleRes, itemsRes, paymentsRes] = await Promise.all([
      getSale(saleId),
      getSaleItems(saleId),
      getSalePayments(saleId),
    ]);

    if (saleRes.success && saleRes.data) {
      setSale(saleRes.data);
    } else {
      setError(saleRes.error ?? "Erro ao carregar venda.");
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data);
    }
    if (paymentsRes.success && paymentsRes.data) {
      setPayments(paymentsRes.data);
    }

    const supabase = createClient();
    const [catRes, pmRes, storesRes, channelsRes] = await Promise.all([
      supabase
        .from("items")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("payment_methods")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase.from("stores").select("id, name").eq("is_active", true),
      supabase
        .from("sales_channels")
        .select("id, name")
        .eq("is_active", true),
    ]);
    if (catRes.data) setCatalogItems(catRes.data as CatalogItem[]);
    if (pmRes.data) setPaymentMethods(pmRes.data as PaymentMethodOption[]);
    if (storesRes.data) setStores(storesRes.data as StoreOption[]);
    if (channelsRes.data)
      setSalesChannels(channelsRes.data as SalesChannelOption[]);

    setLoading(false);
  }, [saleId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const isDraft = sale?.status === "draft";
  const isConfirmed = sale?.status === "confirmed";
  const isCancelled = sale?.status === "cancelled";

  const itemMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    catalogItems.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [catalogItems]);

  const paymentMethodMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    paymentMethods.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [paymentMethods]);

  const storeMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    stores.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [stores]);

  const channelMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    salesChannels.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [salesChannels]);

  const itemsTotal = items.reduce((acc, i) => acc + Number(i.total_price), 0);
  const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalsMatch = Math.abs(itemsTotal - paymentsTotal) < 0.01;

  function getItemName(itemId: string) {
    return itemMap[itemId] ?? itemId;
  }

  function getPaymentMethodName(pmId: string | null) {
    return pmId ? (paymentMethodMap[pmId] ?? pmId) : "—";
  }

  async function handleAddItem() {
    if (!newItemId || !newQuantity || !newUnitPrice) return;
    const qty = parseFloat(newQuantity);
    const price = parseFloat(newUnitPrice);
    const disc = parseFloat(newItemDiscount);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) return;
    setActionLoading(true);
    const result = await addSaleItem(saleId, {
      itemId: newItemId,
      quantity: qty,
      unitPrice: price,
      discount: isNaN(disc) ? 0 : disc,
    });
    if (result.success) {
      setNewItemId("");
      setNewQuantity("");
      setNewUnitPrice("");
      setNewItemDiscount("0");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar item");
    }
    setActionLoading(false);
  }

  async function handleRemoveItem(itemId: string) {
    setActionLoading(true);
    const result = await removeSaleItem(itemId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao remover item");
    }
    setActionLoading(false);
  }

  async function handleAddPayment() {
    if (!newAmount) return;
    const amount = parseFloat(newAmount);
    const installments = parseInt(newInstallments, 10) || 1;
    const daysToReceive = parseInt(newDaysToReceive, 10) || 0;
    if (isNaN(amount) || amount <= 0) return;
    setActionLoading(true);
    const result = await addSalePayment(saleId, {
      paymentMethodId: newPaymentMethodId || undefined,
      amount,
      installments,
      daysToReceive,
    });
    if (result.success) {
      setNewPaymentMethodId("");
      setNewAmount("");
      setNewInstallments("1");
      setNewDaysToReceive("0");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao adicionar pagamento");
    }
    setActionLoading(false);
  }

  async function handleRemovePayment(paymentId: string) {
    setActionLoading(true);
    const result = await removeSalePayment(paymentId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao remover pagamento");
    }
    setActionLoading(false);
  }

  async function handleConfirm() {
    setActionLoading(true);
    setError(null);
    const result = await confirmSale(saleId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao confirmar venda");
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!window.confirm("Tem certeza que deseja cancelar esta venda?")) return;
    setActionLoading(true);
    setError(null);
    const result = await cancelSale(saleId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao cancelar venda");
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  if (error && !sale) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Venda não encontrada.
      </div>
    );
  }

  const cfg =
    statusConfig[sale.status] ?? {
      label: sale.status,
      variant: "default" as const,
    };

  return (
    <div className="space-y-4">
      <Link
        href="/vendas"
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        ← Voltar para vendas
      </Link>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Confirmed banner */}
      {isConfirmed && (
        <div className="rounded-lg border-2 border-success/40 bg-success/5 p-4">
          <p className="text-sm font-medium text-success">Venda confirmada</p>
          <p className="mt-1 text-sm text-slate-600">
            Confirmada em{" "}
            {sale.confirmed_at
              ? formatDate(sale.confirmed_at, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            Valor total: {formatCurrency(Number(sale.total_amount))}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Recebíveis gerados conforme as formas de pagamento.
          </p>
        </div>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="rounded-lg border-2 border-danger/40 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">Venda cancelada</p>
          <p className="mt-1 text-sm text-slate-600">
            Cancelada em{" "}
            {sale.cancelled_at
              ? formatDate(sale.cancelled_at, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Data</p>
            <p className="font-medium text-slate-900">
              {formatDate(sale.sale_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <div>
            <p className="text-xs text-slate-500">Loja</p>
            <p className="font-medium text-slate-900">
              {storeMap[sale.store_id] ?? sale.store_id.slice(0, 8)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Canal</p>
            <p className="font-medium text-slate-900">
              {sale.sales_channel_id
                ? channelMap[sale.sales_channel_id] ??
                  sale.sales_channel_id.slice(0, 8)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Desconto</p>
            <p className="font-medium text-slate-900">
              {formatCurrency(Number(sale.discount))}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor total</p>
            <p className="font-semibold text-slate-900">
              {formatCurrency(Number(sale.total_amount))}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="font-medium text-slate-900">
              {sale.customer_name ?? "—"}
            </p>
          </div>
          {sale.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Observações</p>
              <p className="text-sm text-slate-700">{sale.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items section */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Itens</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium text-slate-700">Item</th>
                <th className="px-3 py-2 font-medium text-slate-700">Qtd</th>
                <th className="px-3 py-2 font-medium text-slate-700">Preço un.</th>
                <th className="px-3 py-2 font-medium text-slate-700">Desc.</th>
                <th className="px-3 py-2 font-medium text-slate-700 text-right">
                  Total
                </th>
                {isDraft && <th className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-700">
                    {getItemName(item.item_id)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {formatCurrency(Number(item.unit_price))}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {formatCurrency(Number(item.discount))}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatCurrency(Number(item.total_price))}
                  </td>
                  {isDraft && (
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={actionLoading}
                        className="text-danger hover:bg-danger/10"
                      >
                        Remover
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isDraft && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-dashed border-slate-200 bg-slate-50/50 p-3">
            <div className="min-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Item
              </label>
              <select
                value={newItemId}
                onChange={(e) => setNewItemId(e.target.value)}
                className="flex h-9 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Selecione...</option>
                {catalogItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[80px]">
              <Input
                label="Qtd"
                type="number"
                min={0.001}
                step="any"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
            <div className="min-w-[100px]">
              <Input
                label="Preço un."
                type="number"
                min={0}
                step={0.01}
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
              />
            </div>
            <div className="min-w-[80px]">
              <Input
                label="Desc."
                type="number"
                min={0}
                step={0.01}
                value={newItemDiscount}
                onChange={(e) => setNewItemDiscount(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={
                actionLoading ||
                !newItemId ||
                !newQuantity ||
                !newUnitPrice
              }
            >
              Adicionar item
            </Button>
          </div>
        )}
        <div className="mt-3 border-t border-slate-200 pt-2 text-right">
          <span className="text-sm font-semibold text-slate-900">
            Total itens: {formatCurrency(itemsTotal)}
          </span>
        </div>
      </div>

      {/* Payments section */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Pagamentos
        </h3>
        {!totalsMatch && (
          <div className="mb-3 rounded border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            Atenção: total dos pagamentos ({formatCurrency(paymentsTotal)}) é
            diferente do total dos itens ({formatCurrency(itemsTotal)}).
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium text-slate-700">Forma</th>
                <th className="px-3 py-2 font-medium text-slate-700 text-right">
                  Valor
                </th>
                <th className="px-3 py-2 font-medium text-slate-700">
                  Parcelas
                </th>
                <th className="px-3 py-2 font-medium text-slate-700">
                  Dias p/ receber
                </th>
                {isDraft && <th className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-700">
                    {getPaymentMethodName(pay.payment_method_id)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatCurrency(Number(pay.amount))}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {pay.installments}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {pay.days_to_receive}
                  </td>
                  {isDraft && (
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePayment(pay.id)}
                        disabled={actionLoading}
                        className="text-danger hover:bg-danger/10"
                      >
                        Remover
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isDraft && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-dashed border-slate-200 bg-slate-50/50 p-3">
            <div className="min-w-[160px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Forma de pagamento
              </label>
              <select
                value={newPaymentMethodId}
                onChange={(e) => setNewPaymentMethodId(e.target.value)}
                className="flex h-9 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Selecione...</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[100px]">
              <Input
                label="Valor"
                type="number"
                min={0}
                step={0.01}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div className="min-w-[80px]">
              <Input
                label="Parcelas"
                type="number"
                min={1}
                value={newInstallments}
                onChange={(e) => setNewInstallments(e.target.value)}
              />
            </div>
            <div className="min-w-[100px]">
              <Input
                label="Dias p/ receber"
                type="number"
                min={0}
                value={newDaysToReceive}
                onChange={(e) => setNewDaysToReceive(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPayment}
              disabled={actionLoading || !newAmount}
            >
              Adicionar pagamento
            </Button>
          </div>
        )}
        <div className="mt-3 border-t border-slate-200 pt-2 text-right">
          <span className="text-sm font-semibold text-slate-900">
            Total pagamentos: {formatCurrency(paymentsTotal)}
          </span>
        </div>
      </div>

      {/* Actions (only if draft) */}
      {isDraft && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={actionLoading}
            >
              Confirmar Venda
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Cancelar Venda
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            A confirmação gera: estoque OUT na loja + recebíveis por prazo da
            forma de pagamento.
          </p>
        </div>
      )}
    </div>
  );
}
