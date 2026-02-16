-- =============================================
-- Vitaliano ERP — Migração 00003
-- Helper functions para RLS e segurança
-- TODAS em PUBLIC (Supabase não permite custom functions em auth)
-- SECURITY DEFINER: executam com privilégios do owner
-- =============================================

-- Retorna o org_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Retorna o role do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Verifica se o user tem acesso à loja
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

-- Trigger: criar profile automaticamente ao signup
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();
