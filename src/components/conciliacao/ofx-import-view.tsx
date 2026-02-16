"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { importOfxFile } from "@/actions/import-ofx";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { BankAccount, Store } from "@/types/database";

interface OfxImportViewProps {
  stores: Store[];
  bankAccounts: BankAccount[];
}

export function OfxImportView({ stores, bankAccounts }: OfxImportViewProps) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [bankAccountId, setBankAccountId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    totalParsed: number;
    inserted: number;
    skippedDuplicates: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const filteredAccounts = bankAccounts.filter(
    (a) => a.store_id === storeId && a.is_active
  );

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
        setFileContent(content);
      };
      reader.onerror = () => setError("Erro ao ler arquivo");
      reader.readAsText(file, "ISO-8859-1");
    },
    []
  );

  const handleImport = async () => {
    if (!storeId || !bankAccountId || !fileContent) {
      setError("Selecione loja, conta bancária e arquivo OFX");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const res = await importOfxFile({
      storeId,
      bankAccountId,
      fileName,
      fileContent,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error ?? "Erro desconhecido");
      return;
    }

    setResult({
      totalParsed: res.data!.totalParsed,
      inserted: res.data!.inserted,
      skippedDuplicates: res.data!.skippedDuplicates,
      errors: res.data!.errors,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar OFX"
        description="Faça upload de arquivo OFX do banco para conciliação"
      />

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        {/* Loja */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loja
          </label>
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setBankAccountId("");
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Conta Bancária */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conta Bancária
          </label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {filteredAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.bank_name ? `(${a.bank_name})` : ""}
              </option>
            ))}
          </select>
          {filteredAccounts.length === 0 && storeId && (
            <p className="text-xs text-amber-600 mt-1">
              Nenhuma conta bancária cadastrada para esta loja
            </p>
          )}
        </div>

        {/* Arquivo OFX */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arquivo OFX
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Escolher arquivo
              <input
                type="file"
                accept=".ofx,.OFX"
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
            disabled={loading || !fileContent || !bankAccountId}
          >
            {loading ? "Importando..." : "Importar OFX"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-green-800">
            Importação concluída
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-green-600 font-medium">
                {result.totalParsed}
              </span>{" "}
              <span className="text-green-700">transações no arquivo</span>
            </div>
            <div>
              <span className="text-green-600 font-medium">
                {result.inserted}
              </span>{" "}
              <span className="text-green-700">novas inseridas</span>
            </div>
            <div>
              <span className="text-amber-600 font-medium">
                {result.skippedDuplicates}
              </span>{" "}
              <span className="text-amber-700">duplicatas ignoradas</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 space-y-1 mt-2">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <Button
            size="sm"
            onClick={() => router.push("/conciliacao")}
            className="mt-2"
          >
            Ir para Conciliação
          </Button>
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
