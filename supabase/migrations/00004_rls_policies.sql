-- =============================================
-- Vitaliano ERP — Migração 00004
-- RLS policies (usando public.get_my_org_id, public.is_admin, etc.)
-- =============================================

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

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
