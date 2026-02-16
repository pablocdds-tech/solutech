-- =============================================
-- VITALIANO ERP — RESET + REBUILD COMPLETO
-- Limpa qualquer migração parcial anterior e
-- recria tudo corretamente (functions em PUBLIC)
--
-- Cole INTEIRO no SQL Editor > Run
-- =============================================

-- ===========================================
-- ETAPA 1: LIMPAR TUDO (safe — usa IF EXISTS)
-- ===========================================

-- Dropar políticas RLS (não falha se não existirem)
DO $$ BEGIN
  -- document_links
  DROP POLICY IF EXISTS "document_links_select_own_org" ON public.document_links;
  DROP POLICY IF EXISTS "document_links_insert_own_org" ON public.document_links;
  DROP POLICY IF EXISTS "document_links_delete_admin" ON public.document_links;
  -- documents
  DROP POLICY IF EXISTS "documents_select_own_org" ON public.documents;
  DROP POLICY IF EXISTS "documents_insert_own_org" ON public.documents;
  DROP POLICY IF EXISTS "documents_update_owner_or_admin" ON public.documents;
  -- audit_logs
  DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
  DROP POLICY IF EXISTS "audit_logs_insert_own_org" ON public.audit_logs;
  -- module_permissions
  DROP POLICY IF EXISTS "module_permissions_select" ON public.module_permissions;
  DROP POLICY IF EXISTS "module_permissions_insert_admin" ON public.module_permissions;
  DROP POLICY IF EXISTS "module_permissions_update_admin" ON public.module_permissions;
  DROP POLICY IF EXISTS "module_permissions_delete_admin" ON public.module_permissions;
  -- user_store_access
  DROP POLICY IF EXISTS "user_store_access_select" ON public.user_store_access;
  DROP POLICY IF EXISTS "user_store_access_insert_admin" ON public.user_store_access;
  DROP POLICY IF EXISTS "user_store_access_update_admin" ON public.user_store_access;
  DROP POLICY IF EXISTS "user_store_access_delete_admin" ON public.user_store_access;
  -- profiles
  DROP POLICY IF EXISTS "profiles_select_own_org" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
  -- stores
  DROP POLICY IF EXISTS "stores_select_own_org" ON public.stores;
  DROP POLICY IF EXISTS "stores_insert_owner" ON public.stores;
  DROP POLICY IF EXISTS "stores_update_admin" ON public.stores;
  -- orgs
  DROP POLICY IF EXISTS "orgs_select_own" ON public.orgs;
  DROP POLICY IF EXISTS "orgs_update_owner" ON public.orgs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Dropar trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Dropar tabelas (CASCADE cuida de FKs)
DROP TABLE IF EXISTS public.document_links CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.module_permissions CASCADE;
DROP TABLE IF EXISTS public.user_store_access CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.orgs CASCADE;

-- Dropar functions (public + auth se existirem)
DROP FUNCTION IF EXISTS public.fn_audit_log;
DROP FUNCTION IF EXISTS public.fn_handle_new_user;
DROP FUNCTION IF EXISTS public.fn_set_updated_at;
DROP FUNCTION IF EXISTS public.get_my_org_id;
DROP FUNCTION IF EXISTS public.get_my_role;
DROP FUNCTION IF EXISTS public.has_store_access;
DROP FUNCTION IF EXISTS public.get_my_store_ids;
DROP FUNCTION IF EXISTS public.is_admin;
DROP FUNCTION IF EXISTS public.is_owner;
-- Tentar limpar do schema auth (pode falhar, tudo bem)
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.org_id();
  DROP FUNCTION IF EXISTS auth.user_role();
  DROP FUNCTION IF EXISTS auth.has_store_access(uuid);
  DROP FUNCTION IF EXISTS auth.user_store_ids();
  DROP FUNCTION IF EXISTS auth.is_admin();
  DROP FUNCTION IF EXISTS auth.is_owner();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Dropar enums
DROP TYPE IF EXISTS public.virtual_ledger_type CASCADE;
DROP TYPE IF EXISTS public.inventory_move_type CASCADE;
DROP TYPE IF EXISTS public.receivable_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.draft_status CASCADE;
DROP TYPE IF EXISTS public.source_type CASCADE;
DROP TYPE IF EXISTS public.doc_type CASCADE;
DROP TYPE IF EXISTS public.access_level CASCADE;
DROP TYPE IF EXISTS public.app_module CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.store_type CASCADE;

-- ===========================================
-- ETAPA 2: EXTENSIONS
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ===========================================
-- ETAPA 3: ENUMS DO DOMÍNIO
-- ===========================================

CREATE TYPE public.store_type AS ENUM ('store', 'cd');

CREATE TYPE public.app_role AS ENUM (
  'owner', 'admin', 'financial', 'purchasing',
  'stock_production', 'store_manager', 'cashier',
  'counter', 'checklist_executor', 'maintenance'
);

CREATE TYPE public.app_module AS ENUM (
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7',
  'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'M15'
);

CREATE TYPE public.access_level AS ENUM ('hidden', 'view', 'edit');

CREATE TYPE public.doc_type AS ENUM (
  'nf_xml', 'nf_pdf', 'nf_photo', 'ofx',
  'receipt', 'checklist_evidence', 'other'
);

CREATE TYPE public.source_type AS ENUM ('user', 'ai', 'system', 'import');
CREATE TYPE public.draft_status AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE public.receivable_status AS ENUM ('pending', 'partial', 'received', 'overdue');
CREATE TYPE public.inventory_move_type AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE public.virtual_ledger_type AS ENUM ('DEBIT', 'CREDIT', 'ADJUST');

-- ===========================================
-- ETAPA 4: TABELAS CORE
-- ===========================================

CREATE TABLE public.orgs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  slug        text NOT NULL,
  type        public.store_type NOT NULL DEFAULT 'store',
  cnpj        text,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stores_org_slug_unique UNIQUE (org_id, slug)
);
CREATE INDEX idx_stores_org_id ON public.stores(org_id);

CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  full_name   text NOT NULL,
  email       text NOT NULL,
  avatar_url  text,
  role        public.app_role NOT NULL DEFAULT 'cashier',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_org_email_unique UNIQUE (org_id, email)
);
CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);

CREATE TABLE public.user_store_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_store_access_unique UNIQUE (user_id, store_id)
);
CREATE INDEX idx_user_store_access_org_user ON public.user_store_access(org_id, user_id);

CREATE TABLE public.module_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module        public.app_module NOT NULL,
  access_level  public.access_level NOT NULL DEFAULT 'hidden',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_permissions_user_module_unique UNIQUE (user_id, module)
);
CREATE INDEX idx_module_permissions_org_user ON public.module_permissions(org_id, user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- ETAPA 5: AUDIT LOGS + DOCUMENTS
-- ===========================================

CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  table_name  text,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  source_type public.source_type NOT NULL DEFAULT 'user',
  source_id   text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_org_created ON public.audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

CREATE TABLE public.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  type        public.doc_type NOT NULL DEFAULT 'other',
  file_name   text NOT NULL,
  file_path   text NOT NULL,
  file_size   bigint,
  mime_type   text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_org_type ON public.documents(org_id, type);

CREATE TABLE public.document_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  linked_table  text NOT NULL,
  linked_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_links_unique UNIQUE (document_id, linked_table, linked_id)
);
CREATE INDEX idx_document_links_linked ON public.document_links(linked_table, linked_id);

-- ===========================================
-- ETAPA 6: HELPER FUNCTIONS (em PUBLIC, não auth)
-- ===========================================

-- Retorna org_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Retorna role do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Verifica se user tem acesso à loja
CREATE OR REPLACE FUNCTION public.has_store_access(check_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_store_access
    WHERE user_id = auth.uid() AND store_id = check_store_id
  );
$$;

-- Retorna array de store_ids acessíveis
CREATE OR REPLACE FUNCTION public.get_my_store_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(store_id), '{}'::uuid[])
  FROM public.user_store_access WHERE user_id = auth.uid();
$$;

-- Verifica se é admin (owner ou admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- Verifica se é owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

-- Insere audit log (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fn_audit_log(
  p_org_id uuid, p_store_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL,
  p_action text DEFAULT 'unknown', p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL, p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL, p_source_type public.source_type DEFAULT 'user',
  p_source_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    org_id, store_id, user_id, action, table_name, record_id,
    old_data, new_data, source_type, source_id
  ) VALUES (
    p_org_id, p_store_id, COALESCE(p_user_id, auth.uid()), p_action,
    p_table_name, p_record_id, p_old_data, p_new_data, p_source_type, p_source_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Trigger: criar profile no signup
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := (NEW.raw_user_meta_data ->> 'org_id')::uuid;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.orgs LIMIT 1;
  END IF;
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, org_id, full_name, email, role)
    VALUES (
      NEW.id, v_org_id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'cashier')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger no auth.users (referencia public function — permitido)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ===========================================
-- ETAPA 7: RLS + POLICIES (usando public.*)
-- ===========================================

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

-- ORGS
CREATE POLICY "orgs_select_own" ON public.orgs FOR SELECT
  USING (id = public.get_my_org_id());
CREATE POLICY "orgs_update_owner" ON public.orgs FOR UPDATE
  USING (id = public.get_my_org_id() AND public.is_owner())
  WITH CHECK (id = public.get_my_org_id() AND public.is_owner());

-- STORES
CREATE POLICY "stores_select_own_org" ON public.stores FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "stores_insert_owner" ON public.stores FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_owner());
CREATE POLICY "stores_update_admin" ON public.stores FOR UPDATE
  USING (org_id = public.get_my_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_admin());

-- PROFILES
CREATE POLICY "profiles_select_own_org" ON public.profiles FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE
  USING (org_id = public.get_my_org_id() AND (id = auth.uid() OR public.is_admin()))
  WITH CHECK (org_id = public.get_my_org_id() AND (id = auth.uid() OR public.is_admin()));

-- USER_STORE_ACCESS
CREATE POLICY "user_store_access_select" ON public.user_store_access FOR SELECT
  USING (org_id = public.get_my_org_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "user_store_access_insert_admin" ON public.user_store_access FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_admin());
CREATE POLICY "user_store_access_update_admin" ON public.user_store_access FOR UPDATE
  USING (org_id = public.get_my_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_admin());
CREATE POLICY "user_store_access_delete_admin" ON public.user_store_access FOR DELETE
  USING (org_id = public.get_my_org_id() AND public.is_admin());

-- MODULE_PERMISSIONS
CREATE POLICY "module_permissions_select" ON public.module_permissions FOR SELECT
  USING (org_id = public.get_my_org_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY "module_permissions_insert_admin" ON public.module_permissions FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_admin());
CREATE POLICY "module_permissions_update_admin" ON public.module_permissions FOR UPDATE
  USING (org_id = public.get_my_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.get_my_org_id() AND public.is_admin());
CREATE POLICY "module_permissions_delete_admin" ON public.module_permissions FOR DELETE
  USING (org_id = public.get_my_org_id() AND public.is_admin());

-- AUDIT_LOGS (imutável — sem UPDATE/DELETE)
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.is_admin());
CREATE POLICY "audit_logs_insert_own_org" ON public.audit_logs FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

-- DOCUMENTS
CREATE POLICY "documents_select_own_org" ON public.documents FOR SELECT
  USING (org_id = public.get_my_org_id() AND (store_id IS NULL OR public.has_store_access(store_id)));
CREATE POLICY "documents_insert_own_org" ON public.documents FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "documents_update_owner_or_admin" ON public.documents FOR UPDATE
  USING (org_id = public.get_my_org_id() AND (uploaded_by = auth.uid() OR public.is_admin()))
  WITH CHECK (org_id = public.get_my_org_id() AND (uploaded_by = auth.uid() OR public.is_admin()));

-- DOCUMENT_LINKS
CREATE POLICY "document_links_select_own_org" ON public.document_links FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "document_links_insert_own_org" ON public.document_links FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "document_links_delete_admin" ON public.document_links FOR DELETE
  USING (org_id = public.get_my_org_id() AND public.is_admin());

-- ===========================================
-- ETAPA 8: SEED DEV (Org + 3 Lojas)
-- ===========================================

INSERT INTO public.orgs (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Vitaliano', 'vitaliano',
  '{"timezone": "America/Fortaleza"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.stores (id, org_id, name, slug, type)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Vitaliano NB', 'nb', 'store'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Vitaliano Praça', 'praca', 'store'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'CD Vitaliano', 'cd', 'cd')
ON CONFLICT (org_id, slug) DO NOTHING;

-- ===========================================
-- VERIFICAÇÃO FINAL
-- ===========================================
DO $$
DECLARE
  t_count int;
  e_count int;
  f_count int;
BEGIN
  SELECT count(*) INTO t_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT count(*) INTO e_count FROM pg_type
  WHERE typnamespace = 'public'::regnamespace AND typtype = 'e';

  SELECT count(*) INTO f_count FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

  RAISE NOTICE '=== MIGRAÇÃO COMPLETA ===';
  RAISE NOTICE 'Tabelas criadas: %', t_count;
  RAISE NOTICE 'Enums criados: %', e_count;
  RAISE NOTICE 'Functions criadas: %', f_count;
  RAISE NOTICE 'Seed: org Vitaliano + 3 lojas (NB, Praça, CD)';
END $$;
