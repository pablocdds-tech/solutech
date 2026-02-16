/**
 * Vitaliano ERP — Serviço de Auditoria.
 * Todas as ações críticas DEVEM passar por este serviço.
 * Regra: audit_logs são imutáveis (sem UPDATE/DELETE).
 */

import type { SourceType } from "@/types";
import type { AuditLogInsert } from "@/types/database";

interface AuditEntry {
  orgId: string;
  storeId?: string | null;
  userId?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  sourceType?: SourceType;
  sourceId?: string | null;
}

/**
 * Prepara um registro de auditoria para inserção.
 * Usado tanto em Server Actions quanto em Edge Functions.
 */
export function buildAuditLog(entry: AuditEntry): AuditLogInsert {
  return {
    org_id: entry.orgId,
    store_id: entry.storeId ?? null,
    user_id: entry.userId ?? null,
    action: entry.action,
    table_name: entry.tableName ?? null,
    record_id: entry.recordId ?? null,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
    source_type: entry.sourceType ?? "user",
    source_id: entry.sourceId ?? null,
    ip_address: null, // Preenchido pelo servidor/edge
    user_agent: null, // Preenchido pelo servidor/edge
  };
}

/**
 * Insere um registro de auditoria via Supabase client.
 * Para uso em Server Components / Route Handlers.
 */
export async function insertAuditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entry: AuditEntry
): Promise<void> {
  const log = buildAuditLog(entry);

  const { error } = await supabase.from("audit_logs").insert(log);

  if (error) {
    console.error("[AUDIT] Falha ao registrar auditoria:", error);
    // Em produção, enviar para Sentry
    throw new Error(`Falha na auditoria: ${error.message}`);
  }
}
