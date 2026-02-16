-- =============================================
-- Vitaliano ERP — Migração 00002
-- Tabelas core: orgs, stores, profiles,
-- user_store_access, module_permissions
-- =============================================

-- ===================
-- ORGANIZAÇÕES (TENANT)
-- ===================
CREATE TABLE public.orgs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orgs IS 'Organizações/tenants do sistema. Todo dado pertence a uma org.';

-- ===================
-- LOJAS / UNIDADES
-- ===================
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

COMMENT ON TABLE public.stores IS 'Lojas e centros de distribuição. type=cd para CD Vitaliano.';

-- ===================
-- PERFIS DE USUÁRIOS
-- ===================
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

COMMENT ON TABLE public.profiles IS 'Perfis de usuários. PK = auth.users.id. Role define nível RBAC.';

-- ===================
-- ACESSO A LOJAS
-- ===================
CREATE TABLE public.user_store_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_store_access_unique UNIQUE (user_id, store_id)
);

CREATE INDEX idx_user_store_access_org_user ON public.user_store_access(org_id, user_id);

COMMENT ON TABLE public.user_store_access IS 'Define quais lojas cada usuário pode acessar. RLS depende desta tabela.';

-- ===================
-- PERMISSÕES POR MÓDULO
-- ===================
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

COMMENT ON TABLE public.module_permissions IS 'Nível de acesso por módulo por usuário: hidden, view ou edit.';

-- ===================
-- TRIGGER: updated_at automático
-- ===================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em tabelas com updated_at
CREATE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
