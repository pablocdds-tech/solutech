"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseNfeXml, nfeToReceivingDraft } from "@/lib/parsers/nfe-xml-parser";
import type { Receiving, ReceivingItem } from "@/types/database";

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
 * purchases.ai_extract_invoice_draft — parseia XML de NF-e e cria draft de recebimento.
 *
 * Fluxo:
 * 1. Parse do XML
 * 2. Verifica idempotência por invoice_key (chave de acesso 44 dígitos)
 * 3. Tenta identificar fornecedor pelo CNPJ
 * 4. Cria receiving (draft) + receiving_items
 * 5. Se houver duplicatas, retorna match parcial com tentativa de match por nome normalizado
 * 6. Cria plano de pagamento a partir das duplicatas da NF
 */
export async function importNfeXml(data: {
  storeId: string;
  billedStoreId: string;
  xmlContent: string;
  fileName: string;
}): Promise<
  ActionResult<{
    receiving: Receiving;
    items: ReceivingItem[];
    draft: ReturnType<typeof nfeToReceivingDraft>;
    parseErrors: string[];
    supplierMatched: boolean;
    itemsAutoMatched: number;
  }>
> {
  try {
    const { supabase, userId, orgId } = await getContext();

    // 1. Parse XML
    const nfe = parseNfeXml(data.xmlContent);
    const draft = nfeToReceivingDraft(nfe);

    if (!draft.invoiceKey && nfe.errors.length > 0) {
      return {
        success: false,
        error: `Erro no parse XML: ${nfe.errors.join("; ")}`,
      };
    }

    // 2. Verificar idempotência por chave de acesso
    if (draft.invoiceKey) {
      const { data: existing } = await supabase
        .from("receivings")
        .select("id, status")
        .eq("org_id", orgId)
        .eq("invoice_key", draft.invoiceKey)
        .limit(1);

      if (existing && existing.length > 0) {
        const existingRec = existing[0] as { id: string; status: string };
        return {
          success: false,
          error: `NF-e já importada (chave ${draft.invoiceKey}). Recebimento existente: ${existingRec.id} (${existingRec.status})`,
        };
      }
    }

    // 3. Tentar match de fornecedor por CNPJ
    let supplierId: string | null = null;
    let supplierMatched = false;
    if (draft.supplierCnpj) {
      const cnpjClean = draft.supplierCnpj.replace(/[^\d]/g, "");
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("cnpj", cnpjClean)
        .eq("is_active", true)
        .limit(1);

      if (suppliers && suppliers.length > 0) {
        const supplier = suppliers[0] as { id: string; name: string };
        supplierId = supplier.id;
        supplierMatched = true;
      }
    }

    // 4. Criar receiving draft
    const { data: receiving, error: recError } = await supabase
      .from("receivings")
      .insert({
        org_id: orgId,
        store_id: data.storeId,
        billed_store_id: data.billedStoreId,
        supplier_id: supplierId,
        status: "draft",
        invoice_key: draft.invoiceKey,
        invoice_number: draft.invoiceNumber,
        invoice_series: draft.invoiceSeries,
        invoice_date: draft.issueDate,
        total_products: draft.totalAmount - (draft.freight ?? 0) - (draft.otherCharges ?? 0) + (draft.discount ?? 0),
        freight_amount: draft.freight ?? 0,
        discount_amount: draft.discount ?? 0,
        other_costs: draft.otherCharges ?? 0,
        total_amount: draft.totalAmount,
        notes: `Importado de XML: ${data.fileName}`,
        source_type: "ai",
        source_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (recError) {
      return { success: false, error: `Erro ao criar recebimento: ${recError.message}` };
    }

    const rec = receiving as Receiving;

    // 5. Criar itens do receiving + tentar auto-match por nome normalizado
    let itemsAutoMatched = 0;
    const createdItems: ReceivingItem[] = [];

    for (const item of draft.items) {
      // Tentar match por nome/código
      let matchedItemId: string | null = null;
      let matchedStatus = "pending";

      if (item.ean) {
        const { data: catalogItems } = await supabase
          .from("items")
          .select("id")
          .eq("org_id", orgId)
          .eq("barcode", item.ean)
          .eq("is_active", true)
          .limit(1);
        if (catalogItems && catalogItems.length > 0) {
          matchedItemId = (catalogItems[0] as { id: string }).id;
          matchedStatus = "matched";
          itemsAutoMatched++;
        }
      }

      if (!matchedItemId && item.description) {
        // Buscar por nome normalizado (similarity)
        const normalized = item.description
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

        const { data: catalogItems } = await supabase
          .from("items")
          .select("id, normalized_name")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .limit(20);

        if (catalogItems) {
          for (const ci of catalogItems) {
            const catItem = ci as { id: string; normalized_name: string };
            if (catItem.normalized_name === normalized) {
              matchedItemId = catItem.id;
              matchedStatus = "matched";
              itemsAutoMatched++;
              break;
            }
          }
        }
      }

      const { data: recItem, error: itemError } = await supabase
        .from("receiving_items")
        .insert({
          org_id: orgId,
          receiving_id: rec.id,
          supplier_item_code: item.code ?? null,
          supplier_item_name: item.description,
          ncm: item.ncm ?? null,
          cfop: item.cfop ?? null,
          quantity: item.quantity,
          unit_cost: item.unitPrice,
          discount: 0,
          item_id: matchedItemId,
          unit_id: null,
          matched_status: matchedStatus,
          ai_confidence: matchedItemId ? 0.9 : null,
          notes: null,
        })
        .select()
        .single();

      if (!itemError && recItem) {
        createdItems.push(recItem as ReceivingItem);
      }
    }

    // 6. Criar plano de pagamento a partir das duplicatas
    if (draft.paymentPlan.length > 0) {
      const payments = draft.paymentPlan.map((p) => ({
        org_id: orgId,
        receiving_id: rec.id,
        installment: parseInt(p.installment) || 1,
        due_date: p.dueDate ?? nfe.dataEmissao ?? new Date().toISOString().slice(0, 10),
        amount: p.amount,
        payment_method_id: null,
        notes: null,
      }));

      await supabase.from("receiving_payments").insert(payments);
    }

    // 7. Upload do XML como documento
    const { data: doc } = await supabase
      .from("documents")
      .insert({
        org_id: orgId,
        type: "invoice_xml",
        file_name: data.fileName,
        file_path: `nfe/${rec.id}/${data.fileName}`,
        file_size: data.xmlContent.length,
        mime_type: "application/xml",
        metadata: {
          chave_acesso: draft.invoiceKey,
          emitente_cnpj: draft.supplierCnpj,
          numero: draft.invoiceNumber,
        },
        uploaded_by: userId,
      })
      .select()
      .single();

    if (doc) {
      await supabase.from("document_links").insert({
        org_id: orgId,
        document_id: (doc as { id: string }).id,
        linked_table: "receivings",
        linked_id: rec.id,
      });
    }

    // 8. Audit
    await supabase.rpc("fn_audit_log", {
      p_org_id: orgId,
      p_action: "import_nfe_xml",
      p_table_name: "receivings",
      p_record_id: rec.id,
      p_old_data: null,
      p_new_data: {
        file_name: data.fileName,
        invoice_key: draft.invoiceKey,
        total_items: draft.items.length,
        auto_matched: itemsAutoMatched,
        supplier_matched: supplierMatched,
      },
      p_store_id: data.storeId,
    });

    revalidatePath("/compras");
    return {
      success: true,
      data: {
        receiving: rec,
        items: createdItems,
        draft,
        parseErrors: nfe.errors,
        supplierMatched,
        itemsAutoMatched,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro na importação NF-e",
    };
  }
}
