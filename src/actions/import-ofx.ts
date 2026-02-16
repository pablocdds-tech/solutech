"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseOfxContent, generateTxHashKey } from "@/lib/parsers/ofx-parser";
import type { OfxImport } from "@/types/database";

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

/**
 * Fluxo completo: upload + parse + staging idempotente.
 * 1. Cria registro em ofx_imports
 * 2. Parseia conteúdo OFX
 * 3. Insere linhas em ofx_lines (unique por fitid/hash_key)
 * 4. Atualiza contadores do import
 */
export async function importOfxFile(data: {
  storeId: string;
  bankAccountId: string;
  fileName: string;
  fileContent: string;
}): Promise<
  ActionResult<{
    import: OfxImport;
    totalParsed: number;
    inserted: number;
    skippedDuplicates: number;
    errors: string[];
  }>
> {
  try {
    const { supabase, userId, orgId } = await getContext();

    // 1. Parse do conteúdo OFX
    const parsed = parseOfxContent(data.fileContent);

    if (parsed.transactions.length === 0 && parsed.errors.length > 0) {
      return {
        success: false,
        error: `Falha no parse OFX: ${parsed.errors.join("; ")}`,
      };
    }

    // 2. Criar registro do import
    const { data: importRecord, error: importError } = await supabase
      .from("ofx_imports")
      .insert({
        org_id: orgId,
        store_id: data.storeId,
        bank_account_id: data.bankAccountId,
        file_name: data.fileName,
        status: "processing",
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        source_type: "import",
        source_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (importError) {
      return { success: false, error: `Erro ao criar import: ${importError.message}` };
    }

    const imp = importRecord as OfxImport;
    let inserted = 0;
    let skippedDuplicates = 0;
    const lineErrors: string[] = [];

    // 3. Inserir linhas individualmente (idempotência por fitid/hash_key)
    for (const tx of parsed.transactions) {
      const fitid = tx.fitid || null;
      const hashKey = fitid
        ? null
        : generateTxHashKey(data.bankAccountId, tx.date, tx.amount, tx.description);

      // Verificar duplicata
      let isDuplicate = false;

      if (fitid) {
        const { data: existing } = await supabase
          .from("ofx_lines")
          .select("id")
          .eq("bank_account_id", data.bankAccountId)
          .eq("fitid", fitid)
          .limit(1);
        isDuplicate = (existing?.length ?? 0) > 0;
      } else if (hashKey) {
        const { data: existing } = await supabase
          .from("ofx_lines")
          .select("id")
          .eq("bank_account_id", data.bankAccountId)
          .eq("hash_key", hashKey)
          .limit(1);
        isDuplicate = (existing?.length ?? 0) > 0;
      }

      if (isDuplicate) {
        skippedDuplicates++;
        continue;
      }

      const { error: lineError } = await supabase.from("ofx_lines").insert({
        org_id: orgId,
        ofx_import_id: imp.id,
        bank_account_id: data.bankAccountId,
        fitid,
        hash_key: hashKey,
        transaction_date: tx.date,
        amount: tx.amount,
        description: tx.description,
        memo: tx.memo,
        type_code: tx.typeCode,
        status: "pending",
        raw_data: { rawDate: tx.rawDate, typeCode: tx.typeCode },
      });

      if (lineError) {
        lineErrors.push(`FITID ${fitid ?? hashKey}: ${lineError.message}`);
      } else {
        inserted++;
      }
    }

    // 4. Atualizar contadores do import
    const finalStatus = lineErrors.length > 0 ? "partial" : "imported";
    await supabase
      .from("ofx_imports")
      .update({
        status: finalStatus,
        total_lines: parsed.transactions.length,
        pending_lines: inserted,
        matched_lines: 0,
        ignored_lines: 0,
        imported_at: new Date().toISOString(),
      })
      .eq("id", imp.id);

    // 5. Audit log
    await supabase.rpc("fn_audit_log", {
      p_org_id: orgId,
      p_action: "ofx_import",
      p_table_name: "ofx_imports",
      p_record_id: imp.id,
      p_old_data: null,
      p_new_data: {
        file_name: data.fileName,
        total_parsed: parsed.transactions.length,
        inserted,
        skipped: skippedDuplicates,
        errors: lineErrors.length,
      },
      p_store_id: data.storeId,
    });

    // Refresh updated import
    const { data: updatedImport } = await supabase
      .from("ofx_imports")
      .select("*")
      .eq("id", imp.id)
      .single();

    revalidatePath("/conciliacao");
    return {
      success: true,
      data: {
        import: (updatedImport ?? imp) as OfxImport,
        totalParsed: parsed.transactions.length,
        inserted,
        skippedDuplicates,
        errors: [...parsed.errors, ...lineErrors],
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro na importação OFX",
    };
  }
}
