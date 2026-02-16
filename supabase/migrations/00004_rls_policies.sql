-- =============================================
-- Vitaliano ERP — Migração 00004
-- Row Level Security (RLS) policies
-- Regra: NENHUMA tabela sem RLS habilitado
-- =============================================

-- ===================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ===================
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- ===================
-- ORGS — Apenas a org do usuário
-- ===================
CREATE POLICY "orgs_select_own"
  ON public.orgs FOR SELECT
  USING (id = auth.org_id());

-- INSERT bloqueado para usuários normais (criação via sistema/seed)
-- UPDATE apenas owner
CREATE POLICY "orgs_update_owner"
  ON public.orgs FOR UPDATE
  USING (id = auth.org_id() AND auth.is_owner())
  WITH CHECK (id = auth.org_id() AND auth.is_owner());

-- DELETE bloqueado (sem política = negado)

-- ===================
-- STORES — Mesma org, filtrado por acesso
-- ===================
CREATE POLICY "stores_select_own_org"
  ON public.stores FOR SELECT
  USING (org_id = auth.org_id());

-- INSERT apenas owner
CREATE POLICY "stores_insert_owner"
  ON public.stores FOR INSERT
  WITH CHECK (org_id = auth.org_id() AND auth.is_owner());

-- UPDATE apenas owner ou admin
CREATE POLICY "stores_update_admin"
  ON public.stores FOR UPDATE
  USING (org_id = auth.org_id() AND auth.is_admin())
  WITH CHECK (org_id = auth.org_id() AND auth.is_admin());

-- DELETE bloqueado (soft-delete via is_active)

-- ===================
-- PROFILES — Mesma org
-- ===================
CREATE POLICY "profiles_select_own_org"
  ON public.profiles FOR SELECT
  USING (org_id = auth.org_id());

-- INSERT via trigger (fn_handle_new_user), não diretamente
-- UPDATE: próprio perfil OU admin
CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  USING (
    org_id = auth.org_id()
    AND (id = auth.uid() OR auth.is_admin())
  )
  WITH CHECK (
    org_id = auth.org_id()
    AND (id = auth.uid() OR auth.is_admin())
  );

-- DELETE bloqueado (soft-delete via is_active)

-- ===================
-- USER_STORE_ACCESS — Próprios acessos ou admin gerencia
-- ===================
CREATE POLICY "user_store_access_select"
  ON public.user_store_access FOR SELECT
  USING (
    org_id = auth.org_id()
    AND (user_id = auth.uid() OR auth.is_admin())
  );

CREATE POLICY "user_store_access_insert_admin"
  ON public.user_store_access FOR INSERT
  WITH CHECK (org_id = auth.org_id() AND auth.is_admin());

CREATE POLICY "user_store_access_update_admin"
  ON public.user_store_access FOR UPDATE
  USING (org_id = auth.org_id() AND auth.is_admin())
  WITH CHECK (org_id = auth.org_id() AND auth.is_admin());

CREATE POLICY "user_store_access_delete_admin"
  ON public.user_store_access FOR DELETE
  USING (org_id = auth.org_id() AND auth.is_admin());

-- ===================
-- MODULE_PERMISSIONS — Próprias permissões ou admin gerencia
-- ===================
CREATE POLICY "module_permissions_select"
  ON public.module_permissions FOR SELECT
  USING (
    org_id = auth.org_id()
    AND (user_id = auth.uid() OR auth.is_admin())
  );

CREATE POLICY "module_permissions_insert_admin"
  ON public.module_permissions FOR INSERT
  WITH CHECK (org_id = auth.org_id() AND auth.is_admin());

CREATE POLICY "module_permissions_update_admin"
  ON public.module_permissions FOR UPDATE
  USING (org_id = auth.org_id() AND auth.is_admin())
  WITH CHECK (org_id = auth.org_id() AND auth.is_admin());

CREATE POLICY "module_permissions_delete_admin"
  ON public.module_permissions FOR DELETE
  USING (org_id = auth.org_id() AND auth.is_admin());
