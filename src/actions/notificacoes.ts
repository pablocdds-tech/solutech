"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Notification } from "@/types/database";
import type { NotificationChannel, NotificationPriority } from "@/types";

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

export async function listNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<ActionResult<Notification[]>> {
  try {
    const { supabase, userId } = await getContext();

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.unreadOnly) query = query.eq("is_read", false);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };

    revalidatePath("/notificacoes");
    return { success: true, data: (data ?? []) as Notification[] };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao listar notificações",
    };
  }
}

export async function markAsRead(
  notificationId: string
): Promise<ActionResult<Notification>> {
  try {
    const { supabase, userId } = await getContext();

    const { data, error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/notificacoes");
    return { success: true, data: data as Notification };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao marcar como lida",
    };
  }
}

export async function markAllAsRead(): Promise<ActionResult<unknown>> {
  try {
    const { supabase, userId } = await getContext();

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) return { success: false, error: error.message };

    revalidatePath("/notificacoes");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao marcar todas como lidas",
    };
  }
}

export async function getUnreadCount(): Promise<ActionResult<number>> {
  try {
    const { supabase, userId } = await getContext();

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) return { success: false, error: error.message };

    return { success: true, data: count ?? 0 };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao buscar contagem",
    };
  }
}

export async function createNotification(data: {
  userId: string;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  storeId?: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<ActionResult<Notification>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        org_id: orgId,
        user_id: data.userId,
        store_id: data.storeId ?? null,
        title: data.title,
        body: data.body ?? null,
        priority: data.priority ?? "normal",
        channel: data.channel ?? "inbox",
        reference_type: data.referenceType ?? null,
        reference_id: data.referenceId ?? null,
        is_read: false,
        sent_external: false,
        source_type: "user",
        source_id: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: notification as Notification };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao criar notificação",
    };
  }
}
