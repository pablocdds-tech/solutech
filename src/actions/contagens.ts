"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryCount, InventoryCountItem } from "@/types/database";

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

export async function createInventoryCount(data: {
  storeId: string;
  title: string;
  countDate?: string;
  description?: string;
}): Promise<ActionResult<InventoryCount>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const countDate =
      data.countDate ?? new Date().toISOString().split("T")[0];

    const { data: count, error } = await supabase
      .from("inventory_counts")
      .insert({
        org_id: orgId,
        store_id: data.storeId,
        title: data.title,
        count_date: countDate,
        description: data.description ?? null,
        status: "open",
        source_type: "user",
        source_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/contagens");
    return { success: true, data: count as InventoryCount };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar contagem",
    };
  }
}

export async function addCountItem(
  countId: string,
  data: {
    itemId: string;
    expectedQuantity: number;
    unitId?: string;
  }
): Promise<ActionResult<InventoryCountItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data: item, error } = await supabase
      .from("inventory_count_items")
      .insert({
        org_id: orgId,
        inventory_count_id: countId,
        item_id: data.itemId,
        expected_quantity: data.expectedQuantity,
        unit_id: data.unitId ?? null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: item as InventoryCountItem };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao adicionar item",
    };
  }
}

export async function updateCountItem(
  itemId: string,
  data: { countedQuantity: number; notes?: string }
): Promise<ActionResult<InventoryCountItem>> {
  try {
    const { supabase, userId } = await getContext();

    const { data: item, error } = await supabase
      .from("inventory_count_items")
      .update({
        counted_quantity: data.countedQuantity,
        notes: data.notes ?? null,
        counted_at: new Date().toISOString(),
        counted_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: item as InventoryCountItem };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao atualizar item",
    };
  }
}

export async function approveInventoryCount(
  countId: string
): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await getContext();

    const { error } = await supabase.rpc("fn_approve_inventory_count", {
      p_count_id: countId,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/contagens");
    revalidatePath("/estoque");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao aprovar contagem",
    };
  }
}

export async function listInventoryCounts(options?: {
  status?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<InventoryCount[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("inventory_counts")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as InventoryCount[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao listar contagens",
    };
  }
}

export async function getInventoryCount(
  countId: string
): Promise<ActionResult<InventoryCount>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("inventory_counts")
      .select("*")
      .eq("id", countId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Contagem não encontrada" };

    return { success: true, data: data as InventoryCount };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar contagem",
    };
  }
}

export async function getCountItems(
  countId: string
): Promise<ActionResult<InventoryCountItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("inventory_count_items")
      .select("*")
      .eq("inventory_count_id", countId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as InventoryCountItem[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar itens",
    };
  }
}
