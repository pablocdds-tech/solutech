/**
 * Vitaliano ERP — Tipos das tabelas do banco de dados.
 * Espelha a modelagem SQL (FASE 1).
 * Será substituído por tipos gerados automaticamente quando
 * o Supabase CLI estiver configurado (supabase gen types).
 */

import type {
  AccessLevel,
  AdjustmentDirection,
  AppModule,
  AppRole,
  BankAccountType,
  DocumentType,
  FinanceCategoryType,
  InventoryMoveType,
  ItemType,
  PaymentMethodType,
  SalesChannelType,
  SourceType,
  StoreType,
  VirtualLedgerType,
} from "./index";

// === Tabelas Core (FASE 1) ===

export interface Org {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  type: StoreType;
  cnpj: string | null;
  address: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // = auth.users.id
  org_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserStoreAccess {
  id: string;
  org_id: string;
  user_id: string;
  store_id: string;
  created_at: string;
}

export interface ModulePermission {
  id: string;
  org_id: string;
  user_id: string;
  module: AppModule;
  access_level: AccessLevel;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  store_id: string | null;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  source_type: SourceType;
  source_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  org_id: string;
  store_id: string | null;
  type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocumentLink {
  id: string;
  org_id: string;
  document_id: string;
  linked_table: string;
  linked_id: string;
  created_at: string;
}

// === Tabelas M2 — Cadastros ===

export interface IngredientGroup {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  org_id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  org_id: string;
  name: string;
  normalized_name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  type: ItemType;
  ingredient_group_id: string | null;
  default_unit_id: string | null;
  min_stock: number | null;
  max_stock: number | null;
  image_url: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  normalized_name: string;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategory {
  id: string;
  org_id: string;
  name: string;
  type: FinanceCategoryType;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  org_id: string;
  name: string;
  type: PaymentMethodType;
  days_to_receive: number;
  fee_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesChannel {
  id: string;
  org_id: string;
  name: string;
  type: SalesChannelType;
  fee_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CostCenter {
  id: string;
  org_id: string;
  store_id: string | null;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  org_id: string;
  store_id: string;
  name: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  account_type: BankAccountType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitConversion {
  id: string;
  org_id: string;
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  item_id: string | null;
  created_at: string;
}

export interface ItemPrice {
  id: string;
  org_id: string;
  store_id: string;
  item_id: string;
  price: number;
  cost_price: number | null;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentReason {
  id: string;
  org_id: string;
  name: string;
  direction: AdjustmentDirection;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === Tabelas FASE 3 — Estoque + Banco Virtual ===

export interface InventoryMove {
  id: string;
  org_id: string;
  store_id: string;
  item_id: string;
  move_type: InventoryMoveType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  reason_id: string | null;
  batch_id: string | null;
  notes: string | null;
  source_type: SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VirtualLedgerEntry {
  id: string;
  org_id: string;
  store_id: string;
  entry_type: VirtualLedgerType;
  amount: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  source_type: SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
}

// View types (read-only, derived)
export interface InventoryBalance {
  org_id: string;
  store_id: string;
  store_name: string;
  item_id: string;
  item_name: string;
  item_type: ItemType;
  sku: string | null;
  unit_abbr: string | null;
  balance: number;
  total_cost_value: number;
  avg_unit_cost: number;
  min_stock: number | null;
  max_stock: number | null;
  last_move_at: string | null;
  total_moves: number;
}

export interface VirtualLedgerBalance {
  org_id: string;
  store_id: string;
  store_name: string;
  store_type: StoreType;
  balance: number;
  total_debits: number;
  total_credits: number;
  total_adjustments: number;
  total_entries: number;
  last_entry_at: string | null;
}

export interface VirtualLedgerStatement {
  id: string;
  entry_type: VirtualLedgerType;
  amount: number;
  description: string;
  reference_type: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  running_balance: number;
}

// === Tabelas FASE 4 — Compras / NF (M3) ===

export interface Receiving {
  id: string;
  org_id: string;
  store_id: string;
  billed_store_id: string;
  supplier_id: string | null;
  status: import("./index").ReceivingStatus;
  invoice_key: string | null;
  invoice_number: string | null;
  invoice_series: string | null;
  invoice_date: string | null;
  total_products: number;
  freight_amount: number;
  discount_amount: number;
  other_costs: number;
  total_amount: number;
  notes: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivingItem {
  id: string;
  org_id: string;
  receiving_id: string;
  supplier_item_code: string | null;
  supplier_item_name: string;
  ncm: string | null;
  cfop: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  discount: number;
  item_id: string | null;
  unit_id: string | null;
  matched_status: import("./index").ReceivingItemMatch;
  ai_confidence: number | null;
  ai_suggested_item: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivingPayment {
  id: string;
  org_id: string;
  receiving_id: string;
  installment: number;
  due_date: string;
  amount: number;
  payment_method_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApPayable {
  id: string;
  org_id: string;
  store_id: string;
  supplier_id: string | null;
  receiving_id: string | null;
  status: import("./index").PayableStatus;
  description: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  paid_at: string | null;
  payment_method_id: string | null;
  finance_category_id: string | null;
  cost_center_id: string | null;
  bank_transaction_id: string | null;
  installment: number;
  total_installments: number;
  notes: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// === Tipos para INSERT (sem campos auto-gerados) ===

export type OrgInsert = Omit<Org, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type StoreInsert = Omit<Store, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type ProfileInsert = Omit<Profile, "created_at" | "updated_at">;

export type UserStoreAccessInsert = Omit<
  UserStoreAccess,
  "id" | "created_at"
> & {
  id?: string;
};

export type ModulePermissionInsert = Omit<
  ModulePermission,
  "id" | "created_at"
> & {
  id?: string;
};

export type AuditLogInsert = Omit<AuditLog, "id" | "created_at"> & {
  id?: string;
};

export type DocumentInsert = Omit<Document, "id" | "created_at"> & {
  id?: string;
};

export type DocumentLinkInsert = Omit<DocumentLink, "id" | "created_at"> & {
  id?: string;
};

export type IngredientGroupInsert = Omit<
  IngredientGroup,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type UnitInsert = Omit<Unit, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type ItemInsert = Omit<
  Item,
  "id" | "created_at" | "updated_at" | "normalized_name"
> & {
  id?: string;
};

export type SupplierInsert = Omit<
  Supplier,
  "id" | "created_at" | "updated_at" | "normalized_name"
> & {
  id?: string;
};

export type FinanceCategoryInsert = Omit<
  FinanceCategory,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type PaymentMethodInsert = Omit<
  PaymentMethod,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type SalesChannelInsert = Omit<
  SalesChannel,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type CostCenterInsert = Omit<
  CostCenter,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type BankAccountInsert = Omit<
  BankAccount,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type UnitConversionInsert = Omit<UnitConversion, "id" | "created_at"> & {
  id?: string;
};

export type ItemPriceInsert = Omit<
  ItemPrice,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

export type AdjustmentReasonInsert = Omit<
  AdjustmentReason,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
};

// === Tabelas FASE 5 — Financeiro base (M5) ===

export interface BankTransaction {
  id: string;
  org_id: string;
  store_id: string;
  bank_account_id: string;
  type: import("./index").BankTxType;
  amount: number;
  description: string;
  transaction_date: string;
  fitid: string | null;
  hash_key: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArReceivable {
  id: string;
  org_id: string;
  store_id: string;
  status: import("./index").ArReceivableStatus;
  description: string;
  amount: number;
  received_amount: number;
  due_date: string;
  received_at: string | null;
  sales_channel_id: string | null;
  payment_method_id: string | null;
  finance_category_id: string | null;
  cost_center_id: string | null;
  bank_transaction_id: string | null;
  cash_session_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  installment: number;
  total_installments: number;
  notes: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashSession {
  id: string;
  org_id: string;
  store_id: string;
  status: import("./index").CashSessionStatus;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  opened_by: string | null;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankBalance {
  org_id: string;
  store_id: string;
  store_name: string;
  bank_account_id: string;
  account_name: string;
  bank_name: string | null;
  account_type: import("./index").BankAccountType;
  total_credits: number;
  total_debits: number;
  balance: number;
  total_transactions: number;
  pending_reconciliation: number;
  last_transaction_date: string | null;
}

export type InventoryMoveInsert = Omit<InventoryMove, "id" | "created_at" | "total_cost"> & {
  id?: string;
};
export type VirtualLedgerEntryInsert = Omit<VirtualLedgerEntry, "id" | "created_at"> & {
  id?: string;
};

export type ReceivingInsert = Omit<
  Receiving,
  "id" | "created_at" | "updated_at" | "confirmed_at" | "confirmed_by" | "cancelled_at" | "cancelled_by"
> & { id?: string };

export type ReceivingItemInsert = Omit<ReceivingItem, "id" | "created_at" | "updated_at" | "total_cost"> & {
  id?: string;
};

export type ReceivingPaymentInsert = Omit<ReceivingPayment, "id" | "created_at"> & {
  id?: string;
};

export type ApPayableInsert = Omit<ApPayable, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type BankTransactionInsert = Omit<BankTransaction, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type ArReceivableInsert = Omit<ArReceivable, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export type CashSessionInsert = Omit<CashSession, "id" | "created_at" | "updated_at" | "closed_at" | "closed_by"> & {
  id?: string;
};

// === Tabelas FASE 6 — CD→Loja + Banco Virtual ===

export interface InternalOrder {
  id: string;
  org_id: string;
  source_store_id: string;
  destination_store_id: string;
  status: import("./index").InternalOrderStatus;
  order_date: string;
  total_amount: number;
  notes: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalOrderItem {
  id: string;
  org_id: string;
  internal_order_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InternalOrderInsert = Omit<
  InternalOrder,
  "id" | "created_at" | "updated_at" | "confirmed_at" | "confirmed_by" | "cancelled_at" | "cancelled_by" | "total_amount"
> & { id?: string };

export type InternalOrderItemInsert = Omit<InternalOrderItem, "id" | "created_at" | "updated_at" | "total_cost"> & {
  id?: string;
};

// === Tabelas FASE 7 — Produção + Custo Real + CMV ===

export interface Recipe {
  id: string;
  org_id: string;
  store_id: string | null;
  name: string;
  description: string | null;
  output_item_id: string;
  output_quantity: number;
  output_unit_id: string | null;
  is_active: boolean;
  notes: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: string;
  org_id: string;
  recipe_id: string;
  item_id: string;
  quantity: number;
  unit_id: string | null;
  loss_percentage: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrder {
  id: string;
  org_id: string;
  store_id: string;
  recipe_id: string;
  status: import("./index").ProductionOrderStatus;
  planned_quantity: number;
  actual_quantity: number | null;
  planned_date: string;
  total_input_cost: number;
  total_loss_cost: number;
  real_unit_cost: number;
  notes: string | null;
  started_at: string | null;
  started_by: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionConsumption {
  id: string;
  org_id: string;
  production_order_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProductionLoss {
  id: string;
  org_id: string;
  production_order_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit_id: string | null;
  reason: string | null;
  reason_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CmvResult {
  store_id: string;
  item_id: string;
  cmv_total: number;
  qty_out: number;
  loss_total: number;
  total_cost: number;
}

export type RecipeInsert = Omit<Recipe, "id" | "created_at" | "updated_at"> & { id?: string };

export type RecipeItemInsert = Omit<RecipeItem, "id" | "created_at" | "updated_at"> & { id?: string };

export type ProductionOrderInsert = Omit<
  ProductionOrder,
  "id" | "created_at" | "updated_at" | "actual_quantity" | "total_input_cost" | "total_loss_cost" | "real_unit_cost" | "started_at" | "started_by" | "finalized_at" | "finalized_by" | "cancelled_at" | "cancelled_by"
> & { id?: string };

export type ProductionConsumptionInsert = Omit<ProductionConsumption, "id" | "created_at" | "total_cost"> & { id?: string };

export type ProductionLossInsert = Omit<ProductionLoss, "id" | "created_at" | "total_cost"> & { id?: string };

// === Tabelas FASE 8 — OFX/Conciliação ===

export interface OfxImport {
  id: string;
  org_id: string;
  store_id: string;
  bank_account_id: string;
  status: import("./index").OfxImportStatus;
  file_name: string;
  document_id: string | null;
  total_lines: number;
  matched_lines: number;
  ignored_lines: number;
  pending_lines: number;
  period_start: string | null;
  period_end: string | null;
  imported_at: string | null;
  notes: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfxLine {
  id: string;
  org_id: string;
  ofx_import_id: string;
  bank_account_id: string;
  fitid: string | null;
  hash_key: string | null;
  transaction_date: string;
  amount: number;
  description: string | null;
  memo: string | null;
  type_code: string | null;
  status: import("./index").OfxLineStatus;
  bank_transaction_id: string | null;
  raw_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationMatch {
  id: string;
  org_id: string;
  ofx_line_id: string;
  bank_transaction_id: string | null;
  ap_payable_id: string | null;
  ar_receivable_id: string | null;
  match_type: import("./index").ReconciliationMatchType;
  amount: number;
  is_active: boolean;
  matched_by: string | null;
  matched_at: string;
  unmatched_by: string | null;
  unmatched_at: string | null;
  unmatch_reason: string | null;
  source_type: import("./index").SourceType;
  source_id: string | null;
  created_at: string;
}

export type OfxImportInsert = Omit<OfxImport, "id" | "created_at" | "updated_at" | "total_lines" | "matched_lines" | "ignored_lines" | "pending_lines" | "imported_at"> & { id?: string };

export type OfxLineInsert = Omit<OfxLine, "id" | "created_at" | "updated_at"> & { id?: string };
