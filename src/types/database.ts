/**
 * Vitaliano ERP — Tipos das tabelas do banco de dados.
 * Espelha a modelagem SQL (FASE 1).
 * Será substituído por tipos gerados automaticamente quando
 * o Supabase CLI estiver configurado (supabase gen types).
 */

import type {
  AccessLevel,
  AppModule,
  AppRole,
  DocumentType,
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
