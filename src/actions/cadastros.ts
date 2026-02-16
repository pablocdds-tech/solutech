"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CadastroResult = {
  success: boolean;
  data?: unknown;
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
  p_new_data: Record<string, unknown> | null
): Promise<void> {
  const { error } = await supabase.rpc("fn_audit_log", {
    p_org_id,
    p_action,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
  });
  if (error) {
    console.error("[AUDIT] Falha ao registrar auditoria:", error);
    throw new Error(`Falha na auditoria: ${error.message}`);
  }
}

/**
 * Lista entidades com busca e filtro de ativos.
 */
export async function listEntities(
  table: string,
  options?: {
    search?: string;
    searchFields?: string[];
    activeOnly?: boolean;
    orderBy?: string;
    orderAsc?: boolean;
    select?: string;
  }
): Promise<CadastroResult> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    let query = supabase
      .from(table)
      .select(options?.select ?? "*", { count: "exact" })
      .eq("org_id", orgId);

    if (options?.activeOnly !== false) {
      query = query.eq("is_active", true);
    }

    if (options?.search && options.searchFields?.length) {
      const term = `%${options.search}%`;
      const orCondition = options.searchFields
        .map((field) => `${field}.ilike.${term}`)
        .join(",");
      query = query.or(orCondition);
    }

    const orderCol = options?.orderBy ?? "name";
    const orderOpt = { ascending: options?.orderAsc !== false };
    query = query.order(orderCol, orderOpt);

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: { items: data ?? [], total: count ?? 0 },
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao listar registros.";
    return { success: false, error: msg };
  }
}

/**
 * Busca uma entidade por ID.
 */
export async function getEntity(
  table: string,
  id: string,
  select?: string
): Promise<CadastroResult> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from(table)
      .select(select ?? "*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao buscar registro.";
    return { success: false, error: msg };
  }
}

/**
 * Cria uma nova entidade.
 */
export async function createEntity(
  table: string,
  data: Record<string, unknown>,
  revalidate?: string
): Promise<CadastroResult> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const exclude = ["id", "created_at", "updated_at", "normalized_name"];
    const payload = { ...data } as Record<string, unknown>;
    exclude.forEach((k) => delete payload[k]);
    payload.org_id = orgId;

    const { data: inserted, error } = await supabase
      .from(table)
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
      table,
      (inserted as { id?: string })?.id ?? null,
      null,
      inserted as Record<string, unknown>
    );

    if (revalidate) revalidatePath(revalidate);

    return { success: true, data: inserted };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao criar registro.";
    return { success: false, error: msg };
  }
}

/**
 * Atualiza uma entidade existente.
 */
export async function updateEntity(
  table: string,
  id: string,
  data: Record<string, unknown>,
  revalidate?: string
): Promise<CadastroResult> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data: existing } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!existing) {
      return { success: false, error: "Registro não encontrado." };
    }

    const exclude = ["id", "org_id", "created_at", "updated_at", "normalized_name"];
    const payload = { ...data } as Record<string, unknown>;
    exclude.forEach((k) => delete payload[k]);

    const { data: updated, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await callAudit(
      supabase,
      orgId,
      "update",
      table,
      id,
      existing as Record<string, unknown>,
      updated as Record<string, unknown>
    );

    if (revalidate) revalidatePath(revalidate);

    return { success: true, data: updated };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao atualizar registro.";
    return { success: false, error: msg };
  }
}

/**
 * Alterna o status ativo (soft-delete) de uma entidade.
 */
export async function toggleEntityActive(
  table: string,
  id: string,
  isActive: boolean,
  revalidate?: string
): Promise<CadastroResult> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data: existing } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!existing) {
      return { success: false, error: "Registro não encontrado." };
    }

    const newData = { ...existing, is_active: isActive } as Record<
      string,
      unknown
    >;

    const { data: updated, error } = await supabase
      .from(table)
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await callAudit(
      supabase,
      orgId,
      isActive ? "activate" : "deactivate",
      table,
      id,
      existing as Record<string, unknown>,
      newData
    );

    if (revalidate) revalidatePath(revalidate);

    return { success: true, data: updated };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao alterar status.";
    return { success: false, error: msg };
  }
}
