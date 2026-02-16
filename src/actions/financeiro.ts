"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  ApPayable,
  ArReceivable,
  BankTransaction,
  BankBalance,
  CashSession,
} from "@/types/database";

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

async function callAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  action: string,
  tableName: string,
  recordId: string | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  storeId?: string | null
) {
  const params: Record<string, unknown> = {
    p_org_id: orgId,
    p_action: action,
    p_table_name: tableName,
    p_record_id: recordId,
    p_old_data: oldData,
    p_new_data: newData,
  };
  if (storeId != null) params.p_store_id = storeId;
  await supabase.rpc("fn_audit_log", params);
}

// ===========================================
// CONTAS A PAGAR (AP)
// ===========================================

export async function listApPayables(options?: {
  storeId?: string;
  status?: string;
  limit?: number;
}): Promise<ActionResult<ApPayable[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ap_payables")
      .select("*")
      .eq("org_id", orgId)
      .order("due_date", { ascending: true });

    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.status) query = query.eq("status", options.status);

    const limit = options?.limit ?? 100;
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ApPayable[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function createApPayable(data: {
  storeId: string;
  supplierId?: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentMethodId?: string;
  financeCategoryId?: string;
  costCenterId?: string;
  notes?: string;
}): Promise<ActionResult<ApPayable>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      supplier_id: data.supplierId ?? null,
      description: data.description,
      amount: data.amount,
      due_date: data.dueDate,
      payment_method_id: data.paymentMethodId ?? null,
      finance_category_id: data.financeCategoryId ?? null,
      cost_center_id: data.costCenterId ?? null,
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: rec, error } = await supabase
      .from("ap_payables")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const apData = rec as ApPayable;
    await callAudit(supabase, orgId, "create_ap", "ap_payables", apData.id, null, rec as Record<string, unknown>, data.storeId);

    revalidatePath("/financeiro");
    return { success: true, data: apData };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar AP" };
  }
}

export async function payAp(data: {
  payableId: string;
  bankAccountId: string;
  amount: number;
  transactionDate?: string;
  notes?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_pay_ap", {
      p_payable_id: data.payableId,
      p_bank_account_id: data.bankAccountId,
      p_amount: data.amount,
      p_transaction_date: data.transactionDate ?? new Date().toISOString().split("T")[0],
      p_notes: data.notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    const res = result as { success: boolean };
    if (!res.success) return { success: false, error: "Erro no pagamento" };

    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao pagar AP" };
  }
}

// ===========================================
// CONTAS A RECEBER (AR)
// ===========================================

export async function listArReceivables(options?: {
  storeId?: string;
  status?: string;
  limit?: number;
}): Promise<ActionResult<ArReceivable[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ar_receivables")
      .select("*")
      .eq("org_id", orgId)
      .order("due_date", { ascending: true });

    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.status) query = query.eq("status", options.status);

    const limit = options?.limit ?? 100;
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ArReceivable[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function createArReceivable(data: {
  storeId: string;
  description: string;
  amount: number;
  dueDate: string;
  salesChannelId?: string;
  paymentMethodId?: string;
  financeCategoryId?: string;
  costCenterId?: string;
  notes?: string;
}): Promise<ActionResult<ArReceivable>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      description: data.description,
      amount: data.amount,
      due_date: data.dueDate,
      sales_channel_id: data.salesChannelId ?? null,
      payment_method_id: data.paymentMethodId ?? null,
      finance_category_id: data.financeCategoryId ?? null,
      cost_center_id: data.costCenterId ?? null,
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: rec, error } = await supabase
      .from("ar_receivables")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const arData = rec as ArReceivable;
    await callAudit(supabase, orgId, "create_ar", "ar_receivables", arData.id, null, rec as Record<string, unknown>, data.storeId);

    revalidatePath("/financeiro");
    return { success: true, data: arData };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar AR" };
  }
}

export async function receiveAr(data: {
  receivableId: string;
  bankAccountId: string;
  amount: number;
  transactionDate?: string;
  notes?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_receive_ar", {
      p_receivable_id: data.receivableId,
      p_bank_account_id: data.bankAccountId,
      p_amount: data.amount,
      p_transaction_date: data.transactionDate ?? new Date().toISOString().split("T")[0],
      p_notes: data.notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    const res = result as { success: boolean };
    if (!res.success) return { success: false, error: "Erro no recebimento" };

    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao receber AR" };
  }
}

// ===========================================
// BANCOS
// ===========================================

export async function getBankBalances(): Promise<ActionResult<BankBalance[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("v_bank_balance")
      .select("*")
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as BankBalance[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function listBankTransactions(options?: {
  bankAccountId?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<BankTransaction[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("bank_transactions")
      .select("*")
      .eq("org_id", orgId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (options?.bankAccountId) query = query.eq("bank_account_id", options.bankAccountId);
    if (options?.storeId) query = query.eq("store_id", options.storeId);

    const limit = options?.limit ?? 100;
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as BankTransaction[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function createBankTransaction(data: {
  storeId: string;
  bankAccountId: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  transactionDate?: string;
  notes?: string;
}): Promise<ActionResult<BankTransaction>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      bank_account_id: data.bankAccountId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      transaction_date: data.transactionDate ?? new Date().toISOString().split("T")[0],
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: rec, error } = await supabase
      .from("bank_transactions")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const txData = rec as BankTransaction;
    await callAudit(supabase, orgId, "create_bank_tx", "bank_transactions", txData.id, null, rec as Record<string, unknown>, data.storeId);

    revalidatePath("/financeiro");
    return { success: true, data: txData };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar transação" };
  }
}

// ===========================================
// CAIXA
// ===========================================

export async function listCashSessions(options?: {
  storeId?: string;
  status?: string;
}): Promise<ActionResult<CashSession[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("cash_sessions")
      .select("*")
      .eq("org_id", orgId)
      .order("opened_at", { ascending: false });

    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.status) query = query.eq("status", options.status);

    const { data, error } = await query.limit(50);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as CashSession[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function openCashSession(data: {
  storeId: string;
  openingBalance: number;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_open_cash_session", {
      p_store_id: data.storeId,
      p_opening_balance: data.openingBalance,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao abrir caixa" };
  }
}

export async function closeCashSession(data: {
  sessionId: string;
  closingBalance: number;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_close_cash_session", {
      p_session_id: data.sessionId,
      p_closing_balance: data.closingBalance,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao fechar caixa" };
  }
}
