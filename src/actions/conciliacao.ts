"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { OfxImport, OfxLine, ReconciliationMatch } from "@/types/database";

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
// bank.ofx_upload_document (criar registro do import)
// ===========================================

export async function createOfxImport(data: {
  storeId: string;
  bankAccountId: string;
  fileName: string;
  documentId?: string;
  notes?: string;
}): Promise<ActionResult<OfxImport>> {
  try {
    const { supabase, userId, orgId } = await getContext();

    const payload = {
      org_id: orgId,
      store_id: data.storeId,
      bank_account_id: data.bankAccountId,
      file_name: data.fileName,
      document_id: data.documentId ?? null,
      notes: data.notes ?? null,
      source_type: "import",
      source_id: userId,
      created_by: userId,
    };

    const { data: imp, error } = await supabase
      .from("ofx_imports")
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    return { success: true, data: imp as OfxImport };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// bank.ofx_import_parse (staging idempotente via RPC)
// ===========================================

export async function parseOfxImport(
  importId: string,
  lines: Array<{
    fitid?: string;
    hash_key?: string;
    transaction_date: string;
    amount: number;
    description?: string;
    memo?: string;
    type_code?: string;
  }>
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data, error } = await supabase.rpc("fn_ofx_import_parse", {
      p_import_id: importId,
      p_lines: lines,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    return { success: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro no parse" };
  }
}

// ===========================================
// bank.ofx_detect_matches (sugere, não aplica)
// ===========================================

export async function detectMatches(importId: string): Promise<
  ActionResult<
    Array<{
      ofxLine: OfxLine;
      suggestions: Array<{
        type: "ap" | "ar" | "bank_tx";
        id: string;
        description: string;
        amount: number;
        score: number;
      }>;
    }>
  >
> {
  try {
    const { supabase, orgId } = await getContext();

    // Buscar linhas pendentes
    const { data: pendingLines, error: linesError } = await supabase
      .from("ofx_lines")
      .select("*")
      .eq("ofx_import_id", importId)
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("transaction_date");

    if (linesError) return { success: false, error: linesError.message };

    const lines = (pendingLines ?? []) as OfxLine[];
    const results: Array<{
      ofxLine: OfxLine;
      suggestions: Array<{
        type: "ap" | "ar" | "bank_tx";
        id: string;
        description: string;
        amount: number;
        score: number;
      }>;
    }> = [];

    for (const line of lines) {
      const suggestions: Array<{
        type: "ap" | "ar" | "bank_tx";
        id: string;
        description: string;
        amount: number;
        score: number;
      }> = [];

      const absAmount = Math.abs(line.amount);

      if (line.amount < 0) {
        // Débito: buscar AP pendentes com valor similar
        const { data: aps } = await supabase
          .from("ap_payables")
          .select("id, description, amount")
          .eq("org_id", orgId)
          .in("status", ["pending", "partial"])
          .gte("amount", absAmount * 0.95)
          .lte("amount", absAmount * 1.05)
          .limit(5);

        for (const ap of aps ?? []) {
          const apRec = ap as { id: string; description: string; amount: number };
          suggestions.push({
            type: "ap",
            id: apRec.id,
            description: apRec.description ?? "AP",
            amount: apRec.amount,
            score: Math.abs(apRec.amount - absAmount) < 0.01 ? 1 : 0.8,
          });
        }
      } else {
        // Crédito: buscar AR pendentes com valor similar
        const { data: ars } = await supabase
          .from("ar_receivables")
          .select("id, description, amount")
          .eq("org_id", orgId)
          .in("status", ["pending", "partial"])
          .gte("amount", absAmount * 0.95)
          .lte("amount", absAmount * 1.05)
          .limit(5);

        for (const ar of ars ?? []) {
          const arRec = ar as { id: string; description: string; amount: number };
          suggestions.push({
            type: "ar",
            id: arRec.id,
            description: arRec.description ?? "AR",
            amount: arRec.amount,
            score: Math.abs(arRec.amount - absAmount) < 0.01 ? 1 : 0.8,
          });
        }
      }

      // Buscar bank_transactions sem match com valor e data próximos
      const { data: txs } = await supabase
        .from("bank_transactions")
        .select("id, description, amount, transaction_date")
        .eq("org_id", orgId)
        .gte("amount", absAmount * 0.95)
        .lte("amount", absAmount * 1.05)
        .limit(5);

      for (const tx of txs ?? []) {
        const txRec = tx as { id: string; description: string; amount: number };
        suggestions.push({
          type: "bank_tx",
          id: txRec.id,
          description: txRec.description ?? "TX",
          amount: txRec.amount,
          score: Math.abs(txRec.amount - absAmount) < 0.01 ? 0.9 : 0.6,
        });
      }

      results.push({ ofxLine: line, suggestions });
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// bank.reconcile_apply_match (via RPC)
// ===========================================

export async function applyMatch(data: {
  ofxLineId: string;
  bankTransactionId?: string;
  apPayableId?: string;
  arReceivableId?: string;
  createBankTx?: boolean;
}): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_reconcile_apply_match", {
      p_ofx_line_id: data.ofxLineId,
      p_bank_transaction_id: data.bankTransactionId ?? null,
      p_ap_payable_id: data.apPayableId ?? null,
      p_ar_receivable_id: data.arReceivableId ?? null,
      p_create_bank_tx: data.createBankTx ?? false,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// bank.reconcile_apply_split (via RPC)
// ===========================================

export async function applySplit(
  ofxLineId: string,
  allocations: Array<{
    amount: number;
    bank_transaction_id?: string;
    ap_payable_id?: string;
    ar_receivable_id?: string;
  }>
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_reconcile_apply_split", {
      p_ofx_line_id: ofxLineId,
      p_allocations: allocations,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// bank.reconcile_mark_ignored (via RPC)
// ===========================================

export async function markIgnored(
  ofxLineId: string,
  reason?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_reconcile_mark_ignored", {
      p_ofx_line_id: ofxLineId,
      p_reason: reason ?? null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// bank.reconcile_unmatch (rollback controlado via RPC)
// ===========================================

export async function unmatch(
  ofxLineId: string,
  reason?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const { supabase } = await getContext();

    const { data: result, error } = await supabase.rpc("fn_reconcile_unmatch", {
      p_ofx_line_id: ofxLineId,
      p_reason: reason ?? "Desconciliação manual",
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/conciliacao");
    revalidatePath("/financeiro");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ===========================================
// Listagens
// ===========================================

export async function listOfxImports(options?: {
  bankAccountId?: string;
  status?: string;
  limit?: number;
}): Promise<ActionResult<OfxImport[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ofx_imports")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.bankAccountId) query = query.eq("bank_account_id", options.bankAccountId);
    if (options?.status) query = query.eq("status", options.status);
    query = query.limit(options?.limit ?? 50);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as OfxImport[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getOfxImport(importId: string): Promise<ActionResult<OfxImport>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("ofx_imports")
      .select("*")
      .eq("id", importId)
      .eq("org_id", orgId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as OfxImport };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getOfxLines(importId: string, options?: {
  status?: string;
}): Promise<ActionResult<OfxLine[]>> {
  try {
    const { supabase, orgId } = await getContext();

    let query = supabase
      .from("ofx_lines")
      .select("*")
      .eq("ofx_import_id", importId)
      .eq("org_id", orgId)
      .order("transaction_date", { ascending: true });

    if (options?.status) query = query.eq("status", options.status);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as OfxLine[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function getReconciliationHistory(ofxLineId: string): Promise<ActionResult<ReconciliationMatch[]>> {
  try {
    const { supabase, orgId } = await getContext();

    const { data, error } = await supabase
      .from("reconciliation_matches")
      .select("*")
      .eq("ofx_line_id", ofxLineId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ReconciliationMatch[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" };
  }
}
