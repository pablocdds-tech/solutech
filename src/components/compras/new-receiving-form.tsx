"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createReceivingDraft } from "@/actions/compras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface StoreOption {
  id: string;
  name: string;
  type: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

export function NewReceivingForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);

  // Form state
  const [storeId, setStoreId] = React.useState("");
  const [billedStoreId, setBilledStoreId] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceKey, setInvoiceKey] = React.useState("");
  const [invoiceSeries, setInvoiceSeries] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      const [storesRes, suppliersRes] = await Promise.all([
        supabase.from("stores").select("id, name, type").eq("is_active", true).order("name"),
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      ]);
      if (storesRes.data) setStores(storesRes.data as StoreOption[]);
      if (suppliersRes.data) setSuppliers(suppliersRes.data as SupplierOption[]);
    }
    loadOptions();
  }, []);

  const storeOptions = stores.map((s) => ({
    value: s.id,
    label: `${s.name} ${s.type === "cd" ? "(CD)" : "(Loja)"}`,
  }));

  const billedStoreOptions = stores
    .filter((s) => s.type !== "cd")
    .map((s) => ({ value: s.id, label: s.name }));

  const supplierOptions = [
    { value: "", label: "Selecione (opcional)..." },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || !billedStoreId) {
      setError("Selecione a loja destino e a loja faturada.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createReceivingDraft({
      storeId,
      billedStoreId,
      supplierId: supplierId || undefined,
      invoiceKey: invoiceKey || undefined,
      invoiceNumber: invoiceNumber || undefined,
      invoiceSeries: invoiceSeries || undefined,
      invoiceDate: invoiceDate || undefined,
      totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
      notes: notes || undefined,
    });

    if (result.success && result.data) {
      router.push(`/compras/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar recebimento.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Lojas */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Lojas</h2>

        <Select
          label="Loja Destino (recebe estoque)"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          options={storeOptions}
          placeholder="Selecione..."
          required
        />

        <Select
          label="Loja Faturada (paga a NF)"
          value={billedStoreId}
          onChange={(e) => setBilledStoreId(e.target.value)}
          options={billedStoreOptions}
          placeholder="Selecione..."
          required
        />
      </div>

      {/* Fornecedor */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Fornecedor</h2>
        <Select
          label="Fornecedor"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          options={supplierOptions}
        />
      </div>

      {/* Dados da NF */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Dados da NF</h2>

        <Input
          label="Chave NF-e (44 dígitos)"
          value={invoiceKey}
          onChange={(e) => setInvoiceKey(e.target.value)}
          placeholder="Opcional — preencha se tiver o XML"
          maxLength={44}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Número da NF"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Ex: 12345"
          />
          <Input
            label="Série"
            value={invoiceSeries}
            onChange={(e) => setInvoiceSeries(e.target.value)}
            placeholder="Ex: 1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data da NF"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
          <Input
            label="Valor Total (R$)"
            type="number"
            step="0.01"
            min="0"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Observações */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Observações</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notas opcionais..."
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
      </div>

      {/* Botões */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/compras")}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Criar Rascunho
        </Button>
      </div>
    </form>
  );
}
