"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Sale, SaleItem, SalePayment } from "@/types/database";

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

// ===========================================
// Criar venda (draft)
// ===========================================

export async function createSale(data: {
  storeId: string;
  saleDate?: string;
  salesChannelId?: string;
  discount?: number;
  customerName?: string;
  customerDoc?: string;
  externalId?: string;
  notes?: string;
}): Promise<ActionResult<Sale>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      sale_date: data.saleDate ?? new Date().toISOString().split("T")[0],
      sales_channel_id: data.salesChannelId ?? null,
      discount: data.discount ?? 0,
      customer_name: data.customerName ?? null,
      customer_doc: data.customerDoc ?? null,
      external_id: data.externalId ?? null,
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: sale, error } = await supabase
      .from("sales")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true, data: sale as Sale };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Itens da venda
// ===========================================

export async function addSaleItem(
  saleId: string,
  data: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    unitId?: string;
    notes?: string;
  }
): Promise<ActionResult<SaleItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      sale_id: saleId,
      item_id: data.itemId,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      discount: data.discount ?? 0,
      unit_id: data.unitId ?? null,
      notes: data.notes ?? null,
    };

    const { data: item, error } = await supabase
      .from("sale_items")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true, data: item as SaleItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function removeSaleItem(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("sale_items")
      .delete()
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Pagamentos da venda
// ===========================================

export async function addSalePayment(
  saleId: string,
  data: {
    paymentMethodId?: string;
    amount: number;
    installments?: number;
    daysToReceive?: number;
    notes?: string;
  }
): Promise<ActionResult<SalePayment>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      sale_id: saleId,
      payment_method_id: data.paymentMethodId ?? null,
      amount: data.amount,
      installments: data.installments ?? 1,
      days_to_receive: data.daysToReceive ?? 0,
      notes: data.notes ?? null,
    };

    const { data: payment, error } = await supabase
      .from("sale_payments")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true, data: payment as SalePayment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function removeSalePayment(paymentId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("sale_payments")
      .delete()
      .eq("id", paymentId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Confirmar venda (atômica via RPC)
// ===========================================

export async function confirmSale(saleId: string): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_confirm_sale", {
      p_sale_id: saleId,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; message?: string };
    if (!result.success) return { success: false, error: result.message ?? "Erro" };

    revalidatePath("/vendas");
    revalidatePath("/estoque");
    revalidatePath("/financeiro");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao confirmar" };
  }
}

// ===========================================
// Cancelar venda (via RPC)
// ===========================================

export async function cancelSale(saleId: string): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_cancel_sale", {
      p_sale_id: saleId,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/vendas");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Listagens
// ===========================================

export async function listSales(options?: {
  status?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<Sale[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("sales")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.storeId) query = query.eq("store_id", options.storeId);
    query = query.limit(options?.limit ?? 50);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Sale[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getSale(saleId: string): Promise<ActionResult<Sale>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as Sale };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getSaleItems(saleId: string): Promise<ActionResult<SaleItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId)
      .eq("org_id", orgId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SaleItem[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getSalePayments(saleId: string): Promise<ActionResult<SalePayment[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("sale_payments")
      .select("*")
      .eq("sale_id", saleId)
      .eq("org_id", orgId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SalePayment[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
