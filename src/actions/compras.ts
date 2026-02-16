"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Receiving,
  ReceivingItem,
  ReceivingPayment,
  ApPayable,
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

async function callAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  action: string,
  tableName: string,
  recordId: string | null,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  storeId?: string | null
) {
  const params: Record<string, unknown> = {
    p_org_id: orgId,
    p_action: action,
    p_table_name: tableName,
    p_record_id: recordId,
    p_old_data: oldData,
    p_new_data: newData,
  };
  if (storeId != null) params.p_store_id = storeId;
  await supabase.rpc("fn_audit_log", params);
}

// ===========================================
// purchases.upload_document
// Upload de documento NF (XML/PDF/foto)
// ===========================================

export async function uploadDocument(data: {
  receivingId: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  documentType: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        org_id: orgId,
        type: data.documentType,
        file_name: data.fileName,
        file_path: data.filePath,
        file_size: data.fileSize ?? null,
        mime_type: data.mimeType ?? null,
        metadata: {},
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const docRecord = doc as Record<string, unknown>;

    await supabase.from("document_links").insert({
      org_id: orgId,
      document_id: (docRecord).id as string,
      linked_table: "receivings",
      linked_id: data.receivingId,
    });

    await callAudit(supabase, orgId, "upload_document", "documents", docRecord.id as string, null, docRecord);

    revalidatePath("/compras");
    return { success: true, data: docRecord };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao fazer upload" };
  }
}

// ===========================================
// purchases.set_receiving_header
// Criar ou atualizar cabeçalho do recebimento
// ===========================================

export async function createReceivingDraft(data: {
  storeId: string;
  billedStoreId: string;
  supplierId?: string;
  invoiceKey?: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  invoiceDate?: string;
  totalProducts?: number;
  freightAmount?: number;
  discountAmount?: number;
  otherCosts?: number;
  totalAmount?: number;
  notes?: string;
}): Promise<ActionResult<Receiving>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      billed_store_id: data.billedStoreId,
      supplier_id: data.supplierId ?? null,
      status: "draft",
      invoice_key: data.invoiceKey ?? null,
      invoice_number: data.invoiceNumber ?? null,
      invoice_series: data.invoiceSeries ?? null,
      invoice_date: data.invoiceDate ?? null,
      total_products: data.totalProducts ?? 0,
      freight_amount: data.freightAmount ?? 0,
      discount_amount: data.discountAmount ?? 0,
      other_costs: data.otherCosts ?? 0,
      total_amount: data.totalAmount ?? 0,
      notes: data.notes ?? null,
      source_type: "user",
      source_id: userId,
      created_by: userId,
    };

    const { data: rec, error } = await supabase
      .from("receivings")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    const recData = rec as Receiving;

    await callAudit(
      supabase, orgId, "create_receiving_draft", "receivings",
      recData.id, null, rec as Record<string, unknown>, data.storeId
    );

    revalidatePath("/compras");
    return { success: true, data: recData };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar recebimento" };
  }
}

export async function updateReceivingHeader(
  receivingId: string,
  data: {
    supplierId?: string;
    invoiceKey?: string;
    invoiceNumber?: string;
    invoiceSeries?: string;
    invoiceDate?: string;
    totalProducts?: number;
    freightAmount?: number;
    discountAmount?: number;
    otherCosts?: number;
    totalAmount?: number;
    notes?: string;
  }
): Promise<ActionResult<Receiving>> {
  try {
    const { supabase, orgId } = await getContext();

    const updates: Record<string, unknown> = {};
    if (data.supplierId !== undefined) updates.supplier_id = data.supplierId;
    if (data.invoiceKey !== undefined) updates.invoice_key = data.invoiceKey;
    if (data.invoiceNumber !== undefined) updates.invoice_number = data.invoiceNumber;
    if (data.invoiceSeries !== undefined) updates.invoice_series = data.invoiceSeries;
    if (data.invoiceDate !== undefined) updates.invoice_date = data.invoiceDate;
    if (data.totalProducts !== undefined) updates.total_products = data.totalProducts;
    if (data.freightAmount !== undefined) updates.freight_amount = data.freightAmount;
    if (data.discountAmount !== undefined) updates.discount_amount = data.discountAmount;
    if (data.otherCosts !== undefined) updates.other_costs = data.otherCosts;
    if (data.totalAmount !== undefined) updates.total_amount = data.totalAmount;
    if (data.notes !== undefined) updates.notes = data.notes;

    const { data: rec, error } = await supabase
      .from("receivings")
      .update(updates)
      .eq("id", receivingId)
      .eq("org_id", orgId)
      .eq("status", "draft")
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await callAudit(
      supabase, orgId, "update_receiving_header", "receivings",
      receivingId, null, rec as Record<string, unknown>
    );

    revalidatePath("/compras");
    return { success: true, data: rec as Receiving };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar recebimento" };
  }
}

// ===========================================
// purchases.resolve_line_item_match
// Resolver match de item da NF com cadastro
// ===========================================

export async function addReceivingItem(
  receivingId: string,
  data: {
    supplierItemCode?: string;
    supplierItemName: string;
    ncm?: string;
    cfop?: string;
    quantity: number;
    unitCost: number;
    discount?: number;
    itemId?: string;
    unitId?: string;
    matchedStatus?: string;
    notes?: string;
  }
): Promise<ActionResult<ReceivingItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      receiving_id: receivingId,
      supplier_item_code: data.supplierItemCode ?? null,
      supplier_item_name: data.supplierItemName,
      ncm: data.ncm ?? null,
      cfop: data.cfop ?? null,
      quantity: data.quantity,
      unit_cost: data.unitCost,
      discount: data.discount ?? 0,
      item_id: data.itemId ?? null,
      unit_id: data.unitId ?? null,
      matched_status: data.matchedStatus ?? (data.itemId ? "matched" : "pending"),
      notes: data.notes ?? null,
    };

    const { data: item, error } = await supabase
      .from("receiving_items")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/compras");
    return { success: true, data: item as ReceivingItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao adicionar item" };
  }
}

export async function resolveLineItemMatch(
  itemId: string,
  data: {
    catalogItemId: string;
    unitId?: string;
    matchedStatus?: string;
  }
): Promise<ActionResult<ReceivingItem>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data: item, error } = await supabase
      .from("receiving_items")
      .update({
        item_id: data.catalogItemId,
        unit_id: data.unitId ?? null,
        matched_status: data.matchedStatus ?? "matched",
      })
      .eq("id", itemId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await callAudit(
      supabase, orgId, "resolve_line_item_match", "receiving_items",
      itemId, null, item as Record<string, unknown>
    );

    revalidatePath("/compras");
    return { success: true, data: item as ReceivingItem };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao resolver match" };
  }
}

export async function ignoreLineItem(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("receiving_items")
      .update({ matched_status: "ignored" })
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/compras");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao ignorar item" };
  }
}

export async function removeReceivingItem(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, orgId } = await getContext();

    const { error } = await supabase
      .from("receiving_items")
      .delete()
      .eq("id", itemId)
      .eq("org_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/compras");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao remover item" };
  }
}

// ===========================================
// purchases.set_payment_plan
// Definir parcelas de pagamento
// ===========================================

export async function setPaymentPlan(
  receivingId: string,
  installments: {
    dueDate: string;
    amount: number;
    paymentMethodId?: string;
    notes?: string;
  }[]
): Promise<ActionResult<ReceivingPayment[]>> {
  try {
    const { supabase, orgId } = await getContext();

    // Remove parcelas anteriores
    await supabase
      .from("receiving_payments")
      .delete()
      .eq("receiving_id", receivingId)
      .eq("org_id", orgId);

    // Insere novas parcelas
    const payloads = installments.map((inst, idx) => ({
      org_id: orgId,
      receiving_id: receivingId,
      installment: idx + 1,
      due_date: inst.dueDate,
      amount: inst.amount,
      payment_method_id: inst.paymentMethodId ?? null,
      notes: inst.notes ?? null,
    }));

    const { data: payments, error } = await supabase
      .from("receiving_payments")
      .insert(payloads)
      .select();

    if (error) return { success: false, error: error.message };

    await callAudit(
      supabase, orgId, "set_payment_plan", "receiving_payments",
      receivingId, null, { installments: payments } as unknown as Record<string, unknown>
    );

    revalidatePath("/compras");
    return { success: true, data: (payments ?? []) as ReceivingPayment[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao definir parcelas" };
  }
}

// ===========================================
// purchases.validate_receiving_draft
// Validar rascunho antes de confirmar
// ===========================================

export async function validateReceivingDraft(
  receivingId: string
): Promise<ActionResult<{ valid: boolean; issues: string[] }>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_validate_receiving_draft", {
      p_receiving_id: receivingId,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { valid: boolean; issues: string[] };
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao validar" };
  }
}

// ===========================================
// purchases.confirm_receiving
// ATÔMICA + IDEMPOTENTE via SQL RPC
// ===========================================

export async function confirmReceiving(
  receivingId: string
): Promise<ActionResult<{
  receiving_id: string;
  inventory_moves_created: number;
  ap_payables_created: number;
  idempotent?: boolean;
  message: string;
}>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_confirm_receiving", {
      p_receiving_id: receivingId,
    });

    if (error) return { success: false, error: error.message };

    const result = data as {
      success: boolean;
      receiving_id: string;
      inventory_moves_created: number;
      ap_payables_created: number;
      idempotent?: boolean;
      message: string;
    };

    if (!result.success) {
      return { success: false, error: result.message ?? "Erro na confirmação" };
    }

    revalidatePath("/compras");
    revalidatePath("/estoque");
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao confirmar recebimento" };
  }
}

// ===========================================
// purchases.cancel_receiving_draft
// ===========================================

export async function cancelReceivingDraft(
  receivingId: string
): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_cancel_receiving_draft", {
      p_receiving_id: receivingId,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { success: boolean };
    if (!result.success) {
      return { success: false, error: "Erro ao cancelar" };
    }

    revalidatePath("/compras");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao cancelar" };
  }
}

// ===========================================
// LEITURA: listagens
// ===========================================

export async function listReceivings(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<Receiving[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("receivings")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as Receiving[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao listar recebimentos" };
  }
}

export async function getReceiving(
  receivingId: string
): Promise<ActionResult<Receiving>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("receivings")
      .select("*")
      .eq("id", receivingId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as Receiving };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao buscar recebimento" };
  }
}

export async function getReceivingItems(
  receivingId: string
): Promise<ActionResult<ReceivingItem[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("receiving_items")
      .select("*")
      .eq("receiving_id", receivingId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ReceivingItem[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao listar itens" };
  }
}

export async function getReceivingPayments(
  receivingId: string
): Promise<ActionResult<ReceivingPayment[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("receiving_payments")
      .select("*")
      .eq("receiving_id", receivingId)
      .eq("org_id", orgId)
      .order("installment", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ReceivingPayment[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao listar parcelas" };
  }
}

export async function listApPayables(options?: {
  storeId?: string;
  status?: string;
  supplierId?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<ApPayable[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ap_payables")
      .select("*")
      .eq("org_id", orgId)
      .order("due_date", { ascending: true });

    if (options?.storeId) query = query.eq("store_id", options.storeId);
    if (options?.status) query = query.eq("status", options.status);
    if (options?.supplierId) query = query.eq("supplier_id", options.supplierId);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, data: (data ?? []) as ApPayable[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao listar contas a pagar" };
  }
}
