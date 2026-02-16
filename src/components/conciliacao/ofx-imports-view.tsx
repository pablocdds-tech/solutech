"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listOfxImports,
  createOfxImport,
} from "@/actions/conciliacao";
import type { OfxImport } from "@/types/database";
import type { Store, BankAccount } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  pending: { label: "Pendente", variant: "warning" },
  processing: { label: "Processando", variant: "info" },
  completed: { label: "Completo", variant: "success" },
  failed: { label: "Falhou", variant: "danger" },
};

export function OfxImportsView() {
  const router = useRouter();
  const [imports, setImports] = React.useState<OfxImport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [stores, setStores] = React.useState<Store[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [storeId, setStoreId] = React.useState("");
  const [bankAccountId, setBankAccountId] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const filteredBankAccounts = React.useMemo(
    () => (storeId ? bankAccounts.filter((b) => b.store_id === storeId) : bankAccounts),
    [storeId, bankAccounts]
  );

  const loadImports = React.useCallback(async () => {
    setLoading(true);
    const result = await listOfxImports();
    if (result.success && result.data) setImports(result.data);
    else setError(result.error ?? "Erro ao carregar importações");
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadImports();
  }, [loadImports]);

  React.useEffect(() => {
    async function loadOpts() {
      const supabase = createClient();
      const [sRes, bRes] = await Promise.all([
        supabase.from("stores").select("*").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("*").eq("is_active", true).order("name"),
      ]);
      if (sRes.data) setStores(sRes.data as Store[]);
      if (bRes.data) setBankAccounts(bRes.data as BankAccount[]);
    }
    loadOpts();
  }, []);

  async function handleCreate() {
    if (!storeId || !bankAccountId || !fileName.trim()) return;
    setActionLoading(true);
    setError(null);
    const result = await createOfxImport({
      storeId,
      bankAccountId,
      fileName: fileName.trim(),
      notes: notes.trim() || undefined,
    });
    if (result.success && result.data) {
      setShowForm(false);
      setStoreId("");
      setBankAccountId("");
      setFileName("");
      setNotes("");
      router.push(`/conciliacao/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar importação");
    }
    setActionLoading(false);
  }

  const pendentes = imports.filter((i) => i.status === "pending" || i.status === "processing").length;
  const completados = imports.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {error}{" "}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              &larr; Voltar
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Fechar" : "Nova Importação"}
          </Button>
          <Link href="/conciliacao/importar">
            <Button variant="primary" size="sm">
              Importar Arquivo OFX
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && imports.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Total de importações</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{imports.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Pendentes</p>
            <p className="mt-1 text-2xl font-semibold text-warning">{pendentes}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Completados</p>
            <p className="mt-1 text-2xl font-semibold text-success">{completados}</p>
          </div>
        </div>
      )}

      {/* Nova importação form */}
      {showForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Nova Importação OFX</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Loja</label>
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setBankAccountId("");
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Conta Bancária</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                disabled={!storeId}
              >
                <option value="">Selecione...</option>
                {filteredBankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nome do arquivo"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="extrato.ofx"
            />
            <Input
              label="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            loading={actionLoading}
            disabled={!storeId || !bankAccountId || !fileName.trim()}
          >
            Criar Importação
          </Button>
        </div>
      )}

      {/* Imports table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : imports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhuma importação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-700">Arquivo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-700">Linhas</th>
                <th className="text-right px-4 py-3 font-medium text-slate-700">Match / Pend / Ign</th>
                <th className="text-left px-4 py-3 font-medium text-slate-700">Criado em</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => {
                const total = imp.total_lines || 1;
                const done = (imp.matched_lines || 0) + (imp.ignored_lines || 0);
                const pct = Math.round((done / total) * 100);
                return (
                  <tr
                    key={imp.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/conciliacao/${imp.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{imp.file_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusConfig[imp.status]?.variant ?? "default"}>
                        {statusConfig[imp.status]?.label ?? imp.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{imp.total_lines ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-success">{imp.matched_lines ?? 0}</span>
                      {" / "}
                      <span className="text-warning">{imp.pending_lines ?? 0}</span>
                      {" / "}
                      <span className="text-slate-500">{imp.ignored_lines ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(imp.created_at)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-primary-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
