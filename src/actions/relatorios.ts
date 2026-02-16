"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  return { supabase, userId: user.id, orgId: profile.org_id };
}

// === Tipos de retorno dos relatórios ===

export interface DashboardSummary {
  org_id: string;
  store_id: string;
  store_name: string;
  ap_pending: number;
  ar_pending: number;
  sales_month: number;
  purchases_month: number;
  items_in_stock: number;
  open_production_orders: number;
  pending_checklists: number;
  open_counts: number;
}

export interface DreRow {
  category: string;
  description: string;
  amount: number;
}

export interface CashFlowRow {
  category: string;
  description: string;
  amount: number;
}

export interface AgingRow {
  aging_bucket: string;
  count: number;
  total_amount: number;
}

export interface StockValuationRow {
  store_id: string;
  item_id: string;
  balance: number;
  avg_cost: number;
  total_value: number;
}

export interface ProductionSummaryRow {
  recipe_id: string;
  total_orders: number;
  total_planned: number;
  total_actual: number;
  total_input_cost: number;
  total_loss_cost: number;
  avg_unit_cost: number;
}

export interface VirtualBankRow {
  store_id: string;
  total_debits: number;
  total_credits: number;
  total_adjusts: number;
  balance: number;
}

export interface ChecklistRankingRow {
  store_id: string;
  total_tasks: number;
  completed_tasks: number;
  avg_score: number;
  total_nok: number;
}

// ===========================================
// Dashboard
// ===========================================

export async function getDashboardSummary(): Promise<ActionResult<DashboardSummary[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("v_dashboard_summary")
      .select("*")
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as DashboardSummary[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// DRE
// ===========================================

export async function getReportDre(options?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<DreRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (options?.storeId) params.p_store_id = options.storeId;
    if (options?.dateFrom) params.p_date_from = options.dateFrom;
    if (options?.dateTo) params.p_date_to = options.dateTo;

    const { data, error } = await supabase.rpc("fn_report_dre", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as DreRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Fluxo de Caixa
// ===========================================

export async function getReportCashFlow(options?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<CashFlowRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (options?.storeId) params.p_store_id = options.storeId;
    if (options?.dateFrom) params.p_date_from = options.dateFrom;
    if (options?.dateTo) params.p_date_to = options.dateTo;

    const { data, error } = await supabase.rpc("fn_report_cash_flow", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as CashFlowRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Aging AP / AR
// ===========================================

export async function getReportAgingAp(storeId?: string): Promise<ActionResult<AgingRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (storeId) params.p_store_id = storeId;

    const { data, error } = await supabase.rpc("fn_report_aging_ap", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AgingRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getReportAgingAr(storeId?: string): Promise<ActionResult<AgingRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (storeId) params.p_store_id = storeId;

    const { data, error } = await supabase.rpc("fn_report_aging_ar", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AgingRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Valoração de Estoque
// ===========================================

export async function getReportStockValuation(storeId?: string): Promise<ActionResult<StockValuationRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (storeId) params.p_store_id = storeId;

    const { data, error } = await supabase.rpc("fn_report_stock_valuation", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as StockValuationRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Produção
// ===========================================

export async function getReportProductionSummary(options?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<ProductionSummaryRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (options?.storeId) params.p_store_id = options.storeId;
    if (options?.dateFrom) params.p_date_from = options.dateFrom;
    if (options?.dateTo) params.p_date_to = options.dateTo;

    const { data, error } = await supabase.rpc("fn_report_production_summary", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProductionSummaryRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Banco Virtual
// ===========================================

export async function getReportVirtualBank(): Promise<ActionResult<VirtualBankRow[]>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_report_virtual_bank_summary");
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as VirtualBankRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Ranking Checklists
// ===========================================

export async function getReportChecklistRanking(options?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<ChecklistRankingRow[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (options?.dateFrom) params.p_date_from = options.dateFrom;
    if (options?.dateTo) params.p_date_to = options.dateTo;

    const { data, error } = await supabase.rpc("fn_report_checklist_ranking", params);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ChecklistRankingRow[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
