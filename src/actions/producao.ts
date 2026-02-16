"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Recipe,
  RecipeItem,
  ProductionOrder,
  ProductionConsumption,
  ProductionLoss,
  CmvResult,
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

// ===========================================
// production.create_recipe
// ===========================================

export async function createRecipe(data: {
  name: string;
  outputItemId: string;
  outputQuantity: number;
  outputUnitId?: string;
  storeId?: string;
  description?: string;
  notes?: string;
}): Promise<ActionResult<Recipe>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId ?? null,
      name: data.name.trim(),
      description: data.description ?? null,
      output_item_id: data.outputItemId,
      output_quantity: data.outputQuantity,
      output_unit_id: data.outputUnitId ?? null,
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: recipe as Recipe };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function updateRecipe(
  recipeId: string,
  data: Partial<{
    name: string;
    outputItemId: string;
    outputQuantity: number;
    outputUnitId: string | null;
    description: string | null;
    notes: string | null;
    isActive: boolean;
  }>
): Promise<ActionResult<Recipe>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.outputItemId !== undefined) payload.output_item_id = data.outputItemId;
    if (data.outputQuantity !== undefined) payload.output_quantity = data.outputQuantity;
    if (data.outputUnitId !== undefined) payload.output_unit_id = data.outputUnitId;
    if (data.description !== undefined) payload.description = data.description;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: recipe, error } = await supabase
      .from("recipes")
      .update(payload)
      .eq("id", recipeId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: recipe as Recipe };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function listRecipes(): Promise<ActionResult<Recipe[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("org_id", orgId)
      .order("name");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Recipe[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getRecipe(recipeId: string): Promise<ActionResult<Recipe>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as Recipe };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Recipe Items (insumos da ficha)
// ===========================================

export async function addRecipeItem(
  recipeId: string,
  data: {
    itemId: string;
    quantity: number;
    unitId?: string;
    lossPercentage?: number;
    notes?: string;
  }
): Promise<ActionResult<RecipeItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      recipe_id: recipeId,
      item_id: data.itemId,
      quantity: data.quantity,
      unit_id: data.unitId ?? null,
      loss_percentage: data.lossPercentage ?? 0,
      notes: data.notes ?? null,
    };

    const { data: item, error } = await supabase
      .from("recipe_items")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: item as RecipeItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function removeRecipeItem(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("recipe_items")
      .delete()
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getRecipeItems(recipeId: string): Promise<ActionResult<RecipeItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("recipe_items")
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("org_id", orgId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as RecipeItem[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// production.create_order / production.start_order
// ===========================================

export async function createProductionOrder(data: {
  storeId: string;
  recipeId: string;
  plannedQuantity: number;
  plannedDate?: string;
  notes?: string;
}): Promise<ActionResult<ProductionOrder>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      recipe_id: data.recipeId,
      planned_quantity: data.plannedQuantity,
      planned_date: data.plannedDate ?? new Date().toISOString().split("T")[0],
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: order, error } = await supabase
      .from("production_orders")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: order as ProductionOrder };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function startProductionOrder(orderId: string): Promise<ActionResult<ProductionOrder>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const { data: order, error } = await supabase
      .from("production_orders")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        started_by: userId,
      })
      .eq("id", orderId)
      .eq("org_id", orgId)
      .eq("status", "draft")
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: order as ProductionOrder };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// production.register_consumption
// ===========================================

export async function registerConsumption(
  orderId: string,
  data: {
    itemId: string;
    quantity: number;
    unitCost: number;
    unitId?: string;
    notes?: string;
  }
): Promise<ActionResult<ProductionConsumption>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      production_order_id: orderId,
      item_id: data.itemId,
      quantity: data.quantity,
      unit_cost: data.unitCost,
      unit_id: data.unitId ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    };

    const { data: consumption, error } = await supabase
      .from("production_consumptions")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: consumption as ProductionConsumption };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// production.register_loss
// ===========================================

export async function registerLoss(
  orderId: string,
  data: {
    itemId: string;
    quantity: number;
    unitCost: number;
    unitId?: string;
    reason?: string;
    reasonId?: string;
    notes?: string;
  }
): Promise<ActionResult<ProductionLoss>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      production_order_id: orderId,
      item_id: data.itemId,
      quantity: data.quantity,
      unit_cost: data.unitCost,
      unit_id: data.unitId ?? null,
      reason: data.reason ?? null,
      reason_id: data.reasonId ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    };

    const { data: loss, error } = await supabase
      .from("production_losses")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/producao");
    return { success: true, data: loss as ProductionLoss };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// production.finalize_order (atômica via RPC)
// ===========================================

export async function finalizeProductionOrder(
  orderId: string,
  actualQuantity?: number
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = { p_order_id: orderId };
    if (actualQuantity !== undefined) params.p_actual_quantity = actualQuantity;

    const { data, error } = await supabase.rpc("fn_finalize_production_order", params);

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; message?: string };
    if (!result.success) return { success: false, error: result.message ?? "Erro" };

    revalidatePath("/producao");
    revalidatePath("/estoque");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao finalizar" };
  }
}

// ===========================================
// Listagens
// ===========================================

export async function listProductionOrders(options?: {
  status?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<ProductionOrder[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("production_orders")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.storeId) query = query.eq("store_id", options.storeId);
    query = query.limit(options?.limit ?? 50);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProductionOrder[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getProductionOrder(orderId: string): Promise<ActionResult<ProductionOrder>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("production_orders")
      .select("*")
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as ProductionOrder };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getOrderConsumptions(orderId: string): Promise<ActionResult<ProductionConsumption[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("production_consumptions")
      .select("*")
      .eq("production_order_id", orderId)
      .eq("org_id", orgId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProductionConsumption[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getOrderLosses(orderId: string): Promise<ActionResult<ProductionLoss[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("production_losses")
      .select("*")
      .eq("production_order_id", orderId)
      .eq("org_id", orgId)
      .order("created_at");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ProductionLoss[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// cmv.compute_for_sales_period
// ===========================================

export async function computeCmv(options?: {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<CmvResult[]>> {
  try {
    const { supabase } = await getContext();

    const params: Record<string, unknown> = {};
    if (options?.storeId) params.p_store_id = options.storeId;
    if (options?.dateFrom) params.p_date_from = options.dateFrom;
    if (options?.dateTo) params.p_date_to = options.dateTo;

    const { data, error } = await supabase.rpc("fn_compute_cmv_for_period", params);

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as CmvResult[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao calcular CMV" };
  }
}
