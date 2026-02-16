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
  ItemType,
  PaymentMethodType,
  SalesChannelType,
  SourceType,
  StoreType,
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
