"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  VirtualLedgerBalance,
  VirtualLedgerStatement,
} from "@/types/database";

type BancoVirtualResult<T = unknown> = {
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
 * Lista saldos do banco virtual (view v_virtual_ledger_balance).
 */
export async function getVirtualLedgerBalances(): Promise<
  BancoVirtualResult<VirtualLedgerBalance[]>
> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();

    const { data, error } = await supabase
      .from("v_virtual_ledger_balance")
      .select("*")
      .eq("org_id", orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as VirtualLedgerBalance[] };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Erro ao buscar saldos do banco virtual.";
    return { success: false, error: msg };
  }
}

/**
 * Obtém extrato do banco virtual de uma loja via RPC.
 */
export async function getVirtualLedgerStatement(
  storeId: string,
  limit?: number,
  offset?: number
): Promise<BancoVirtualResult<VirtualLedgerStatement[]>> {
  try {
    const supabase = await createClient();
    await getOrgId(); // ensure auth

    const { data, error } = await supabase.rpc("get_virtual_ledger_statement", {
      p_store_id: storeId,
      p_limit: limit ?? 50,
      p_offset: offset ?? 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as VirtualLedgerStatement[] };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Erro ao buscar extrato do banco virtual.";
    return { success: false, error: msg };
  }
}

/**
 * Cria ajuste administrativo excepcional no banco virtual (tipo ADJUST).
 */
export async function createVirtualLedgerAdjustment(data: {
  storeId: string;
  amount: number;
  description: string;
  notes?: string;
}): Promise<BancoVirtualResult<Record<string, unknown>>> {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      entry_type: "ADJUST",
      amount: data.amount,
      description: data.description,
      notes: data.notes ?? null,
      reference_type: null,
      reference_id: null,
      source_type: "user",
      source_id: user?.id ?? null,
      created_by: user?.id ?? null,
    };

    const { data: inserted, error } = await supabase
      .from("virtual_ledger_entries")
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
      "virtual_ledger_entries",
      (inserted as { id?: string })?.id ?? null,
      null,
      inserted as Record<string, unknown>,
      data.storeId
    );

    revalidatePath("/banco-virtual");

    return { success: true, data: inserted as Record<string, unknown> };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Erro ao criar ajuste do banco virtual.";
    return { success: false, error: msg };
  }
}
