"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistTask,
  ChecklistTaskItem,
} from "@/types/database";
import type { ChecklistItemResult } from "@/types";

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
// Templates
// ===========================================

export async function createTemplate(data: {
  name: string;
  storeId?: string;
  description?: string;
  category?: string;
  scheduleType?: string;
  scheduleConfig?: Record<string, unknown>;
}): Promise<ActionResult<ChecklistTemplate>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const { data: template, error } = await supabase
      .from("checklist_templates")
      .insert({
        org_id: orgId,
        store_id: data.storeId ?? null,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        schedule_type: data.scheduleType ?? null,
        schedule_config: data.scheduleConfig ?? null,
        is_active: true,
        source_type: "user",
        source_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: template as ChecklistTemplate };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar template",
    };
  }
}

export async function updateTemplate(
  templateId: string,
  data: Partial<{
    name: string;
    description: string;
    category: string;
    isActive: boolean;
    scheduleType: string;
    scheduleConfig: Record<string, unknown>;
  }>
): Promise<ActionResult<ChecklistTemplate>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload: Record<string, unknown> = {};
    if (data.name != null) payload.name = data.name;
    if (data.description != null) payload.description = data.description;
    if (data.category != null) payload.category = data.category;
    if (data.isActive != null) payload.is_active = data.isActive;
    if (data.scheduleType != null) payload.schedule_type = data.scheduleType;
    if (data.scheduleConfig != null) payload.schedule_config = data.scheduleConfig;

    const { data: template, error } = await supabase
      .from("checklist_templates")
      .update(payload)
      .eq("id", templateId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: template as ChecklistTemplate };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao atualizar template",
    };
  }
}

export async function addTemplateItem(
  templateId: string,
  data: {
    title: string;
    description?: string;
    sortOrder?: number;
    requiresEvidence?: boolean;
    isCritical?: boolean;
  }
): Promise<ActionResult<ChecklistTemplateItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data: item, error } = await supabase
      .from("checklist_template_items")
      .insert({
        org_id: orgId,
        template_id: templateId,
        title: data.title,
        description: data.description ?? null,
        sort_order: data.sortOrder ?? 0,
        requires_evidence: data.requiresEvidence ?? false,
        is_critical: data.isCritical ?? false,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: item as ChecklistTemplateItem };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao adicionar item",
    };
  }
}

export async function removeTemplateItem(
  itemId: string
): Promise<ActionResult<unknown>> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("checklist_template_items")
      .delete()
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao remover item",
    };
  }
}

export async function listTemplates(): Promise<
  ActionResult<ChecklistTemplate[]>
> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as ChecklistTemplate[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao listar templates",
    };
  }
}

export async function getTemplate(
  templateId: string
): Promise<ActionResult<ChecklistTemplate>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("id", templateId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Template não encontrado" };

    return { success: true, data: data as ChecklistTemplate };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar template",
    };
  }
}

export async function getTemplateItems(
  templateId: string
): Promise<ActionResult<ChecklistTemplateItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("checklist_template_items")
      .select("*")
      .eq("template_id", templateId)
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true });

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as ChecklistTemplateItem[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar itens",
    };
  }
}

// ===========================================
// Tasks
// ===========================================

export async function createTask(data: {
  storeId: string;
  templateId: string;
  taskDate?: string;
  shift?: string;
  assignedTo?: string;
  dueAt?: string;
}): Promise<ActionResult<ChecklistTask>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const taskDate =
      data.taskDate ?? new Date().toISOString().split("T")[0];

    const { data: task, error } = await supabase
      .from("checklist_tasks")
      .insert({
        org_id: orgId,
        store_id: data.storeId,
        template_id: data.templateId,
        task_date: taskDate,
        shift: data.shift ?? null,
        assigned_to: data.assignedTo ?? null,
        due_at: data.dueAt ?? null,
        status: "pending",
        source_type: "user",
        source_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/checklists");
    return { success: true, data: task as ChecklistTask };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar tarefa",
    };
  }
}

export async function respondTaskItem(
  taskItemId: string,
  data: {
    result: "ok" | "nok" | "na";
    observation?: string;
    evidenceUrl?: string;
  }
): Promise<ActionResult<ChecklistTaskItem>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload: Record<string, unknown> = {
      result: data.result as ChecklistItemResult,
      responded_at: new Date().toISOString(),
      responded_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (data.observation != null) payload.observation = data.observation;
    if (data.evidenceUrl != null) payload.evidence_url = data.evidenceUrl;

    const { data: item, error } = await supabase
      .from("checklist_task_items")
      .update(payload)
      .eq("id", taskItemId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, data: item as ChecklistTaskItem };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao responder item",
    };
  }
}

export async function completeTask(
  taskId: string
): Promise<ActionResult<unknown>> {
  try {
    const { supabase } = await getContext();

    const { error } = await supabase.rpc("fn_complete_checklist_task", {
      p_task_id: taskId,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/checklists");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Erro ao concluir tarefa",
    };
  }
}

export async function listTasks(options?: {
  status?: string;
  storeId?: string;
  limit?: number;
}): Promise<ActionResult<ChecklistTask[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("checklist_tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as ChecklistTask[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao listar tarefas",
    };
  }
}

export async function getTask(
  taskId: string
): Promise<ActionResult<ChecklistTask>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("checklist_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Tarefa não encontrada" };

    return { success: true, data: data as ChecklistTask };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar tarefa",
    };
  }
}

export async function getTaskItems(
  taskId: string
): Promise<ActionResult<ChecklistTaskItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("checklist_task_items")
      .select("*")
      .eq("task_id", taskId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as ChecklistTaskItem[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao buscar itens",
    };
  }
}
