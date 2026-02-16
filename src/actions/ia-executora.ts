"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AiTask, AiTaskStep } from "@/types/database";

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
// Criar tarefa IA (Plan)
// ===========================================

export async function createAiTask(data: {
  title: string;
  intent: string;
  storeId?: string;
  description?: string;
  context?: Record<string, unknown>;
  aiModel?: string;
}): Promise<ActionResult<AiTask>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId ?? null,
      status: "planning",
      title: data.title,
      description: data.description ?? null,
      intent: data.intent,
      context: data.context ?? null,
      ai_model: data.aiModel ?? null,
      source_type: "ai",
      source_id: userId,
      created_by: userId,
    };

    const { data: task, error } = await supabase
      .from("ai_tasks")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/ia-executora");
    return { success: true, data: task as AiTask };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Adicionar step ao plano
// ===========================================

export async function addAiTaskStep(
  taskId: string,
  data: {
    stepOrder: number;
    actionCatalog: string;
    actionParams: Record<string, unknown>;
    description: string;
  }
): Promise<ActionResult<AiTaskStep>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      ai_task_id: taskId,
      step_order: data.stepOrder,
      action_catalog: data.actionCatalog,
      action_params: data.actionParams,
      description: data.description,
    };

    const { data: step, error } = await supabase
      .from("ai_task_steps")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Atualizar total_steps na task
    await supabase
      .from("ai_tasks")
      .update({
        total_steps: data.stepOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("org_id", orgId);

    revalidatePath("/ia-executora");
    return { success: true, data: step as AiTaskStep };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Submeter plano para revisão humana
// ===========================================

export async function submitAiTaskForReview(
  taskId: string,
  planSummary: string
): Promise<ActionResult<AiTask>> {
  try {
    const { supabase, orgId } = await getContext();

    // Contar steps existentes
    const { count } = await supabase
      .from("ai_task_steps")
      .select("*", { count: "exact", head: true })
      .eq("ai_task_id", taskId)
      .eq("org_id", orgId);

    const { data: task, error } = await supabase
      .from("ai_tasks")
      .update({
        status: "pending_review",
        plan_summary: planSummary,
        total_steps: count ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/ia-executora");
    return { success: true, data: task as AiTask };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Aprovar tarefa (Confirm) — via RPC atômica
// ===========================================

export async function approveAiTask(
  taskId: string,
  notes?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_ai_approve_task", {
      p_task_id: taskId,
      p_notes: notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean; message?: string };
    if (!result.success) return { success: false, error: result.message ?? "Erro" };

    revalidatePath("/ia-executora");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao aprovar" };
  }
}

// ===========================================
// Rejeitar tarefa — via RPC atômica
// ===========================================

export async function rejectAiTask(
  taskId: string,
  notes?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_ai_reject_task", {
      p_task_id: taskId,
      p_notes: notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/ia-executora");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao rejeitar" };
  }
}

// ===========================================
// Executar step (Execute) — via RPC
// Chamado pelo sistema após aprovação humana
// ===========================================

export async function executeAiStep(
  stepId: string,
  result: Record<string, unknown>,
  success: boolean,
  errorMessage?: string,
  createdRecords?: Record<string, unknown>,
  durationMs?: number
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    // Marcar step como executing
    await supabase
      .from("ai_task_steps")
      .update({
        status: "executing",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", stepId);

    const { data, error } = await supabase.rpc("fn_ai_execute_step", {
      p_step_id: stepId,
      p_result: result,
      p_success: success,
      p_error_message: errorMessage ?? null,
      p_created_records: createdRecords ?? null,
      p_duration_ms: durationMs ?? null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/ia-executora");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro na execução" };
  }
}

// ===========================================
// Iniciar execução da tarefa (muda status → executing)
// ===========================================

export async function startAiTaskExecution(taskId: string): Promise<ActionResult<AiTask>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data: task, error } = await supabase
      .from("ai_tasks")
      .update({
        status: "executing",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("org_id", orgId)
      .eq("status", "approved")
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/ia-executora");
    return { success: true, data: task as AiTask };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Cancelar tarefa
// ===========================================

export async function cancelAiTask(taskId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("ai_tasks")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    // Cancelar steps pendentes
    await supabase
      .from("ai_task_steps")
      .update({
        status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("ai_task_id", taskId)
      .eq("org_id", orgId)
      .eq("status", "pending");

    revalidatePath("/ia-executora");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Listagens
// ===========================================

export async function listAiTasks(options?: {
  status?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<AiTask[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ai_tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.storeId) query = query.eq("store_id", options.storeId);
    query = query.limit(options?.limit ?? 50);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AiTask[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getAiTask(taskId: string): Promise<ActionResult<AiTask>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("ai_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as AiTask };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getAiTaskSteps(taskId: string): Promise<ActionResult<AiTaskStep[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("ai_task_steps")
      .select("*")
      .eq("ai_task_id", taskId)
      .eq("org_id", orgId)
      .order("step_order");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AiTaskStep[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Contadores para dashboard
// ===========================================

export async function getAiTasksStats(): Promise<
  ActionResult<{
    pending_review: number;
    executing: number;
    completed: number;
    failed: number;
  }>
> {
  try {
    const { supabase, orgId } = await getContext();

    const statuses = ["pending_review", "executing", "completed", "failed"] as const;
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await supabase
        .from("ai_tasks")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", status);
      counts[status] = count ?? 0;
    }

    return {
      success: true,
      data: {
        pending_review: counts.pending_review,
        executing: counts.executing,
        completed: counts.completed,
        failed: counts.failed,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
