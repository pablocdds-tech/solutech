"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InternalOrder, InternalOrderItem } from "@/types/database";

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
// cd.create_internal_order (draft)
// ===========================================

export async function createInternalOrder(data: {
  sourceStoreId: string;
  destinationStoreId: string;
  orderDate?: string;
  notes?: string;
}): Promise<ActionResult<InternalOrder>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      source_store_id: data.sourceStoreId,
      destination_store_id: data.destinationStoreId,
      order_date: data.orderDate ?? new Date().toISOString().split("T")[0],
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: order, error } = await supabase
      .from("internal_orders")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const orderData = order as InternalOrder;
    await callAudit(supabase, orgId, "create_internal_order", "internal_orders", orderData.id, null, order as Record<string, unknown>, data.sourceStoreId);

    revalidatePath("/cd-loja");
    return { success: true, data: orderData };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar pedido" };
  }
}

export async function addInternalOrderItem(
  orderId: string,
  data: {
    itemId: string;
    quantity: number;
    unitCost: number;
    unitId?: string;
    notes?: string;
  }
): Promise<ActionResult<InternalOrderItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      internal_order_id: orderId,
      item_id: data.itemId,
      quantity: data.quantity,
      unit_cost: data.unitCost,
      unit_id: data.unitId ?? null,
      notes: data.notes ?? null,
    };

    const { data: item, error } = await supabase
      .from("internal_order_items")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/cd-loja");
    return { success: true, data: item as InternalOrderItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao adicionar item" };
  }
}

export async function removeInternalOrderItem(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("internal_order_items")
      .delete()
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/cd-loja");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao remover item" };
  }
}

// ===========================================
// cd.confirm_internal_order (atômica via RPC)
// ===========================================

export async function confirmInternalOrder(orderId: string): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_confirm_internal_order", {
      p_order_id: orderId,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; message?: string };
    if (!result.success) return { success: false, error: result.message ?? "Erro na confirmação" };

    revalidatePath("/cd-loja");
    revalidatePath("/estoque");
    revalidatePath("/banco-virtual");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao confirmar pedido" };
  }
}

// ===========================================
// cd.settle_virtual_balance_with_real_payment
// ===========================================

export async function settleVirtualBalance(data: {
  storeId: string;
  bankAccountId: string;
  amount: number;
  description?: string;
  apPayableId?: string;
  transactionDate?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_settle_virtual_balance", {
      p_store_id: data.storeId,
      p_bank_account_id: data.bankAccountId,
      p_amount: data.amount,
      p_description: data.description ?? "Liquidação banco virtual",
      p_ap_payable_id: data.apPayableId ?? null,
      p_transaction_date: data.transactionDate ?? new Date().toISOString().split("T")[0],
    });

    if (error) return { success: false, error: error.message };

    const res = result as { success: boolean; message?: string };
    if (!res.success) return { success: false, error: res.message ?? "Erro" };

    revalidatePath("/cd-loja");
    revalidatePath("/banco-virtual");
    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao liquidar" };
  }
}

// ===========================================
// cd.adjust_virtual_balance_admin
// ===========================================

export async function adjustVirtualBalanceAdmin(data: {
  storeId: string;
  amount: number;
  description: string;
  notes?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_adjust_virtual_balance_admin", {
      p_store_id: data.storeId,
      p_amount: data.amount,
      p_description: data.description,
      p_notes: data.notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/cd-loja");
    revalidatePath("/banco-virtual");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro no ajuste admin" };
  }
}

// ===========================================
// Listagens
// ===========================================

export async function listInternalOrders(options?: {
  status?: string;
  limit?: number;
}): Promise<ActionResult<InternalOrder[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("internal_orders")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    query = query.limit(options?.limit ?? 50);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as InternalOrder[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getInternalOrder(orderId: string): Promise<ActionResult<InternalOrder>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("internal_orders")
      .select("*")
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InternalOrder };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getInternalOrderItems(orderId: string): Promise<ActionResult<InternalOrderItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("internal_order_items")
      .select("*")
      .eq("internal_order_id", orderId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as InternalOrderItem[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
