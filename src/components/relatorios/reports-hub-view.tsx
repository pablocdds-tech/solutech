"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getReportStockValuation,
  getReportVirtualBank,
  getReportChecklistRanking,
} from "@/actions/relatorios";
import type {
  StockValuationRow,
  VirtualBankRow,
  ChecklistRankingRow,
} from "@/actions/relatorios";
import { formatCurrency } from "@/lib/utils";

export function ReportsHubView() {
  const router = useRouter();
  const [stockData, setStockData] = React.useState<StockValuationRow[]>([]);
  const [virtualBankData, setVirtualBankData] = React.useState<VirtualBankRow[]>([]);
  const [checklistData, setChecklistData] = React.useState<ChecklistRankingRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const [stockRes, bankRes, checklistRes] = await Promise.all([
        getReportStockValuation(),
        getReportVirtualBank(),
        getReportChecklistRanking(),
      ]);
      if (stockRes.success && stockRes.data) setStockData(stockRes.data);
      if (bankRes.success && bankRes.data) setVirtualBankData(bankRes.data);
      if (checklistRes.success && checklistRes.data) setChecklistData(checklistRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const totalStockValue = stockData.reduce((s, r) => s + (r.total_value ?? 0), 0);
  const totalVirtualBalance = virtualBankData.reduce((s, r) => s + (r.balance ?? 0), 0);
  const avgChecklistScore =
    checklistData.length > 0
      ? checklistData.reduce((s, r) => s + (r.avg_score ?? 0), 0) / checklistData.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Linked report cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => router.push("/relatorios/dre")}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50/50"
        >
          <h3 className="font-semibold text-slate-900">DRE</h3>
          <p className="mt-1 text-sm text-slate-600">
            Demonstração do Resultado do Exercício
          </p>
          <span className="mt-2 text-sm text-primary-600">Abrir relatório →</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/relatorios/fluxo-caixa")}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50/50"
        >
          <h3 className="font-semibold text-slate-900">Fluxo de Caixa</h3>
          <p className="mt-1 text-sm text-slate-600">
            Entradas e saídas bancárias por período
          </p>
          <span className="mt-2 text-sm text-primary-600">Abrir relatório →</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/relatorios/aging")}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50/50"
        >
          <h3 className="font-semibold text-slate-900">Aging AP/AR</h3>
          <p className="mt-1 text-sm text-slate-600">
            Contas a pagar e receber por faixa de vencimento
          </p>
          <span className="mt-2 text-sm text-primary-600">Abrir relatório →</span>
        </button>
      </div>

      {/* Descriptive cards (inline data) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">Valoração Estoque</h3>
          <p className="mt-1 text-sm text-slate-600">
            Valor total do estoque por item e loja
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Carregando…</p>
          ) : (
            <p className="mt-2 text-lg font-semibold text-slate-800">
              {formatCurrency(totalStockValue)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">Produção</h3>
          <p className="mt-1 text-sm text-slate-600">
            Resumo de ordens de produção por receita
          </p>
          <p className="mt-2 text-sm text-slate-500">Relatório detalhado em breve</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">Banco Virtual</h3>
          <p className="mt-1 text-sm text-slate-600">
            Saldo consolidado por loja
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Carregando…</p>
          ) : (
            <p className="mt-2 text-lg font-semibold text-slate-800">
              {formatCurrency(totalVirtualBalance)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">Ranking Checklists</h3>
          <p className="mt-1 text-sm text-slate-600">
            Média de pontuação por loja
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">Carregando…</p>
          ) : (
            <p className="mt-2 text-lg font-semibold text-slate-800">
              {avgChecklistScore.toFixed(1)} pts
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
