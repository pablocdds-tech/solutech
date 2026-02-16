"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { importNfeXml } from "@/actions/import-nfe";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import type { Store } from "@/types/database";

interface NfeImportViewProps {
  stores: Store[];
}

export function NfeImportView({ stores }: NfeImportViewProps) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [billedStoreId, setBilledStoreId] = useState(stores[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [xmlContent, setXmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    receivingId: string;
    invoiceKey: string | null;
    supplierName: string | null;
    totalAmount: number;
    totalItems: number;
    autoMatched: number;
    supplierMatched: boolean;
    parseErrors: string[];
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setError("");
      setResult(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setXmlContent(content);
      };
      reader.onerror = () => setError("Erro ao ler arquivo");
      reader.readAsText(file, "UTF-8");
    },
    []
  );

  const handleImport = async () => {
    if (!storeId || !billedStoreId || !xmlContent) {
      setError("Selecione loja de destino, loja faturada e arquivo XML");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const res = await importNfeXml({
      storeId,
      billedStoreId,
      xmlContent,
      fileName,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error ?? "Erro desconhecido");
      return;
    }

    setResult({
      receivingId: res.data!.receiving.id,
      invoiceKey: res.data!.draft.invoiceKey,
      supplierName: res.data!.draft.supplierName,
      totalAmount: res.data!.draft.totalAmount,
      totalItems: res.data!.draft.items.length,
      autoMatched: res.data!.itemsAutoMatched,
      supplierMatched: res.data!.supplierMatched,
      parseErrors: res.data!.parseErrors,
    });
  };

  const cdStores = stores.filter((s) => s.type === "cd");
  const retailStores = stores.filter((s) => s.type === "store");
  const allStores = [...cdStores, ...retailStores];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar NF-e (XML)"
        description="Faça upload do XML da Nota Fiscal Eletrônica para criar um draft de recebimento"
      />

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        {/* Loja de Destino (onde entra o estoque) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loja de Destino (onde entra o estoque)
          </label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {allStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.type === "cd" ? "CD" : "Loja"})
              </option>
            ))}
          </select>
        </div>

        {/* Loja Faturada (CNPJ da NF) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loja Faturada (CNPJ da NF / quem paga)
          </label>
          <select
            value={billedStoreId}
            onChange={(e) => setBilledStoreId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {retailStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.cnpj ? `(${s.cnpj})` : ""}
              </option>
            ))}
            {retailStores.length === 0 &&
              stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Compras do CD são faturadas no CNPJ da loja. O AP será gerado nesta loja.
          </p>
        </div>

        {/* Arquivo XML */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arquivo XML da NF-e
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Escolher XML
              <input
                type="file"
                accept=".xml,.XML"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {fileName && (
              <span className="text-sm text-gray-600">{fileName}</span>
            )}
          </div>
        </div>

        {/* Botão Importar */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleImport}
            disabled={loading || !xmlContent}
          >
            {loading ? "Processando XML..." : "Importar NF-e"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-green-800">
            Draft de recebimento criado com sucesso
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fornecedor</span>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                {result.supplierName ?? "N/A"}
                {result.supplierMatched ? (
                  <Badge variant="success">Match</Badge>
                ) : (
                  <Badge variant="warning">Pendente</Badge>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Valor Total</span>
              <p className="font-medium text-gray-900">
                R$ {result.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Itens</span>
              <p className="font-medium text-gray-900">
                {result.totalItems} itens ({result.autoMatched} auto-match)
              </p>
            </div>
            <div>
              <span className="text-gray-500">Chave</span>
              <p className="font-mono text-xs text-gray-700 truncate" title={result.invoiceKey ?? ""}>
                {result.invoiceKey ? `${result.invoiceKey.slice(0, 20)}...` : "N/A"}
              </p>
            </div>
          </div>

          {result.parseErrors.length > 0 && (
            <div className="text-xs text-amber-600 space-y-1">
              <p className="font-medium">Avisos do parse:</p>
              {result.parseErrors.map((e, i) => (
                <p key={i}>• {e}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              size="sm"
              onClick={() => router.push(`/compras/${result.receivingId}`)}
            >
              Abrir Recebimento
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setResult(null);
                setXmlContent("");
                setFileName("");
              }}
            >
              Importar Outro
            </Button>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
