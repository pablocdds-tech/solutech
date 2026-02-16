"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InventoryBalance } from "@/types/database";

type EstoqueResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getOrgId(): Promise<string> {
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
  return profile.org_id;
}

async function callAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  p_org_id: string,
  p_action: string,
  p_table_name: string,
  p_record_id: string | null,
  p_old_data: Record<string, unknown> | null,
  p_new_data: Record<string, unknown> | null,
  p_store_id?: string | null
): Promise<void> {
  const params: Record<string, unknown> = {
    p_org_id,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
  };
  if (p_store_id != null) params.p_store_id = p_store_id;
  const { error } = await supabase.rpc("fn_audit_log", params);
  if (error) {
    console.error("[AUDIT] Falha ao registrar auditoria:", error);
    throw new Error(`Falha na auditoria: ${error.message}`);
  }
}

/**
 * Lista saldo de estoque (view v_inventory_balance) com filtro opcional por loja.
 */
export async function getInventoryBalance(
  storeId?: string
): Promise<EstoqueResult<InventoryBalance[]>> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    let query = supabase
      .from("v_inventory_balance")
      .select("*")
      .eq("org_id", orgId);

    if (storeId) {
      query = query.eq("store_id", storeId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as InventoryBalance[] };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao buscar saldo de estoque.";
    return { success: false, error: msg };
  }
}

/**
 * Lista movimentos de estoque com filtros.
 */
export async function listInventoryMoves(options?: {
  storeId?: string;
  itemId?: string;
  moveType?: string;
  limit?: number;
  offset?: number;
}): Promise<EstoqueResult<Record<string, unknown>[]>> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    let query = supabase
      .from("inventory_moves")
      .select(
        `
        *,
        items(name),
        stores(name)
      `
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.itemId) query = query.eq("item_id", options.itemId);
    if (options?.moveType) query = query.eq("move_type", options.moveType);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const moves = (data ?? []).map((row: Record<string, unknown>) => {
      const items = row.items as { name?: string } | { name?: string }[] | null;
      const stores = row.stores as { name?: string } | { name?: string }[] | null;
      const itemObj = Array.isArray(items) ? items[0] : items;
      const storeObj = Array.isArray(stores) ? stores[0] : stores;
      const { items: _i, stores: _s, ...rest } = row;
      return {
        ...rest,
        item_name: itemObj?.name ?? null,
        store_name: storeObj?.name ?? null,
      };
    });

    return { success: true, data: moves };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao listar movimentos.";
    return { success: false, error: msg };
  }
}

/**
 * Cria ajuste manual de estoque (tipo ADJUST) para testes/admin.
 */
export async function createAdjustmentMove(data: {
  storeId: string;
  itemId: string;
  quantity: number;
  unitCost?: number;
  reasonId?: string;
  notes?: string;
}): Promise<EstoqueResult<Record<string, unknown>>> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const unitCost = data.unitCost ?? 0;

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      item_id: data.itemId,
      move_type: "ADJUST",
      quantity: data.quantity,
      unit_cost: unitCost,
      reason_id: data.reasonId ?? null,
      notes: data.notes ?? null,
      reference_type: null,
      reference_id: null,
      batch_id: null,
      source_type: "user",
      source_id: user?.id ?? null,
      created_by: user?.id ?? null,
    };

    const { data: inserted, error } = await supabase
      .from("inventory_moves")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await callAudit(
      supabase,
      orgId,
      "create",
      "inventory_moves",
      (inserted as { id?: string })?.id ?? null,
      null,
      inserted as Record<string, unknown>,
      data.storeId
    );

    revalidatePath("/estoque");

    return { success: true, data: inserted as Record<string, unknown> };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao criar ajuste de estoque.";
    return { success: false, error: msg };
  }
}
