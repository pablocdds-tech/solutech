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
// Atualizar item (ex: editar qty)
// ===========================================

export async function updateInternalOrderItem(
  itemId: string,
  data: {
    quantity?: number;
    unitCost?: number;
    notes?: string;
  }
): Promise<ActionResult<InternalOrderItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const updates: Record<string, unknown> = {};
    if (data.quantity !== undefined) updates.quantity = data.quantity;
    if (data.unitCost !== undefined) updates.unit_cost = data.unitCost;
    if (data.notes !== undefined) updates.notes = data.notes;

    const { data: item, error } = await supabase
      .from("internal_order_items")
      .update(updates)
      .eq("id", itemId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/cd-loja");
    return { success: true, data: item as InternalOrderItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar item" };
  }
}

// ===========================================
// Cancelar pedido
// ===========================================

export async function cancelInternalOrder(orderId: string): Promise<ActionResult> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const { error } = await supabase
      .from("internal_orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
      })
      .eq("id", orderId)
      .eq("org_id", orgId)
      .eq("status", "draft");

    if (error) return { success: false, error: error.message };

    await callAudit(supabase, orgId, "cancel_internal_order", "internal_orders", orderId, null, { status: "cancelled" });

    revalidatePath("/cd-loja");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao cancelar" };
  }
}

// ===========================================
// Buscar preço de item na price_list por loja destino
// ===========================================

export async function getItemPriceForStore(
  itemId: string,
  storeId: string
): Promise<ActionResult<{ price: number; costPrice: number | null }>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data: priceData } = await supabase
      .from("item_prices")
      .select("price, cost_price")
      .eq("org_id", orgId)
      .eq("item_id", itemId)
      .eq("store_id", storeId)
      .eq("is_active", true)
      .lte("valid_from", new Date().toISOString().split("T")[0])
      .order("valid_from", { ascending: false })
      .limit(1);

    if (priceData && priceData.length > 0) {
      const p = priceData[0] as { price: number; cost_price: number | null };
      return { success: true, data: { price: p.price, costPrice: p.cost_price } };
    }

    return { success: true, data: { price: 0, costPrice: null } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Listagens (com nomes de lojas resolvidos)
// ===========================================

export interface InternalOrderWithStoreNames extends InternalOrder {
  source_store_name: string;
  destination_store_name: string;
  items_count: number;
}

export async function listInternalOrders(options?: {
  status?: string;
  limit?: number;
}): Promise<ActionResult<InternalOrderWithStoreNames[]>> {
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
    if (error) return { success: false, error: `Listagem falhou: ${error.message} (code: ${error.code})` };

    const orders = (data ?? []) as InternalOrder[];

    // Resolver nomes de lojas
    const storeIds = new Set<string>();
    orders.forEach((o) => {
      storeIds.add(o.source_store_id);
      storeIds.add(o.destination_store_id);
    });

    const storeMap: Record<string, string> = {};
    if (storeIds.size > 0) {
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", Array.from(storeIds));
      (storesData ?? []).forEach((s: { id: string; name: string }) => {
        storeMap[s.id] = s.name;
      });
    }

    // Contar itens por pedido
    const orderIds = orders.map((o) => o.id);
    const itemsCounts: Record<string, number> = {};
    if (orderIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("internal_order_items")
        .select("internal_order_id")
        .in("internal_order_id", orderIds);
      (itemsData ?? []).forEach((item: { internal_order_id: string }) => {
        itemsCounts[item.internal_order_id] = (itemsCounts[item.internal_order_id] ?? 0) + 1;
      });
    }

    const enriched: InternalOrderWithStoreNames[] = orders.map((o) => ({
      ...o,
      source_store_name: storeMap[o.source_store_id] ?? "—",
      destination_store_name: storeMap[o.destination_store_id] ?? "—",
      items_count: itemsCounts[o.id] ?? 0,
    }));

    return { success: true, data: enriched };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getInternalOrder(orderId: string): Promise<ActionResult<InternalOrderWithStoreNames>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("internal_orders")
      .select("*")
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: `Pedido não encontrado: ${error.message}` };

    const order = data as InternalOrder;

    // Resolver nomes
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name")
      .in("id", [order.source_store_id, order.destination_store_id]);

    const storeMap: Record<string, string> = {};
    (stores ?? []).forEach((s: { id: string; name: string }) => {
      storeMap[s.id] = s.name;
    });

    // Contar itens
    const { count } = await supabase
      .from("internal_order_items")
      .select("*", { count: "exact", head: true })
      .eq("internal_order_id", orderId);

    return {
      success: true,
      data: {
        ...order,
        source_store_name: storeMap[order.source_store_id] ?? "—",
        destination_store_name: storeMap[order.destination_store_id] ?? "—",
        items_count: count ?? 0,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export interface InternalOrderItemWithName extends InternalOrderItem {
  item_name: string;
}

export async function getInternalOrderItems(orderId: string): Promise<ActionResult<InternalOrderItemWithName[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("internal_order_items")
      .select("*")
      .eq("internal_order_id", orderId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    const items = (data ?? []) as InternalOrderItem[];

    // Resolver nomes dos itens
    const itemIds = [...new Set(items.map((i) => i.item_id))];
    const nameMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("items")
        .select("id, name")
        .in("id", itemIds);
      (itemsData ?? []).forEach((i: { id: string; name: string }) => {
        nameMap[i.id] = i.name;
      });
    }

    const enriched: InternalOrderItemWithName[] = items.map((i) => ({
      ...i,
      item_name: nameMap[i.item_id] ?? "Item desconhecido",
    }));

    return { success: true, data: enriched };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
