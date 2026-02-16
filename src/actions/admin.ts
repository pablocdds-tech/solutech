"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Profile, Store, UserStoreAccess, ModulePermission } from "@/types/database";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Acesso restrito a administradores");
  }
  return { supabase, userId: user.id, orgId: profile.org_id };
}

// ===========================================
// Listar usuários da organização
// ===========================================

export async function listUsers(): Promise<ActionResult<(Profile & { store_count: number; module_count: number })[]>> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("org_id", orgId)
      .order("full_name");

    if (error) return { success: false, error: error.message };

    const enriched = await Promise.all(
      (profiles ?? []).map(async (p: Profile) => {
        const { count: storeCount } = await supabase
          .from("user_store_access")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.id)
          .eq("org_id", orgId);

        const { count: moduleCount } = await supabase
          .from("module_permissions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.id)
          .eq("org_id", orgId);

        return { ...p, store_count: storeCount ?? 0, module_count: moduleCount ?? 0 };
      })
    );

    return { success: true, data: enriched };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Atualizar role do usuário
// ===========================================

export async function updateUserRole(
  userId: string,
  role: string
): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { error } = await supabase
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Ativar/Desativar usuário
// ===========================================

export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Gerenciar acesso a lojas
// ===========================================

export async function getUserStoreAccess(userId: string): Promise<ActionResult<UserStoreAccess[]>> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { data, error } = await supabase
      .from("user_store_access")
      .select("*")
      .eq("user_id", userId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as UserStoreAccess[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function setUserStoreAccess(
  userId: string,
  storeIds: string[]
): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getAdminContext();

    // Remover acessos atuais
    await supabase
      .from("user_store_access")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", orgId);

    // Inserir novos acessos
    if (storeIds.length > 0) {
      const rows = storeIds.map((storeId) => ({
        org_id: orgId,
        user_id: userId,
        store_id: storeId,
      }));

      const { error } = await supabase.from("user_store_access").insert(rows);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Gerenciar permissões de módulo
// ===========================================

export async function getUserModulePermissions(userId: string): Promise<ActionResult<ModulePermission[]>> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { data, error } = await supabase
      .from("module_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ModulePermission[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function setUserModulePermissions(
  userId: string,
  permissions: { module: string; accessLevel: string }[]
): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getAdminContext();

    // Remover permissões atuais
    await supabase
      .from("module_permissions")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", orgId);

    // Inserir novas permissões
    if (permissions.length > 0) {
      const rows = permissions.map((p) => ({
        org_id: orgId,
        user_id: userId,
        module: p.module,
        access_level: p.accessLevel,
      }));

      const { error } = await supabase.from("module_permissions").insert(rows);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Listar lojas
// ===========================================

export async function listStores(): Promise<ActionResult<Store[]>> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("org_id", orgId)
      .order("name");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Store[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Atualizar loja
// ===========================================

export async function updateStore(
  storeId: string,
  data: {
    name?: string;
    cnpj?: string;
    address?: string;
    isActive?: boolean;
  }
): Promise<ActionResult<Store>> {
  try {
    const { supabase, orgId } = await getAdminContext();

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) payload.name = data.name;
    if (data.cnpj !== undefined) payload.cnpj = data.cnpj;
    if (data.address !== undefined) payload.address = data.address;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: store, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", storeId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    return { success: true, data: store as Store };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
