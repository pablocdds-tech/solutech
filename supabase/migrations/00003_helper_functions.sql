-- =============================================
-- Vitaliano ERP — Migração 00003
-- Helper functions para RLS e segurança
-- SECURITY DEFINER: executam com privilégios do owner
-- =============================================

-- ===================
-- auth.org_id() — Retorna o org_id do usuário logado
-- ===================
CREATE OR REPLACE FUNCTION auth.org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.org_id() IS 'Retorna o org_id do usuário autenticado.';

-- ===================
-- auth.user_role() — Retorna o role do usuário logado
-- ===================
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.user_role() IS 'Retorna a role (P0-P9) do usuário autenticado.';

-- ===================
-- auth.has_store_access(store_id) — Verifica se o user tem acesso à loja
-- ===================
CREATE OR REPLACE FUNCTION auth.has_store_access(check_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_store_access
    WHERE user_id = auth.uid()
      AND store_id = check_store_id
  );
$$;

COMMENT ON FUNCTION auth.has_store_access(uuid) IS 'Retorna true se o usuário tem acesso à loja especificada.';

-- ===================
-- auth.user_store_ids() — Retorna array de store_ids acessíveis
-- ===================
CREATE OR REPLACE FUNCTION auth.user_store_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(store_id),
    '{}'::uuid[]
  )
  FROM public.user_store_access
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION auth.user_store_ids() IS 'Retorna array de IDs das lojas acessíveis pelo usuário.';

-- ===================
-- auth.is_admin() — Verifica se o user é owner ou admin
-- ===================
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION auth.is_admin() IS 'Retorna true se o usuário é owner (P0) ou admin (P1).';

-- ===================
-- auth.is_owner() — Verifica se o user é owner
-- ===================
CREATE OR REPLACE FUNCTION auth.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'owner'
  );
$$;

COMMENT ON FUNCTION auth.is_owner() IS 'Retorna true se o usuário é owner (P0).';

-- ===================
-- Trigger: criar profile automaticamente ao signup
-- ===================
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Buscar org_id dos metadados do signup (raw_user_meta_data)
  v_org_id := (NEW.raw_user_meta_data ->> 'org_id')::uuid;

  -- Se não veio org_id no metadata, tentar a primeira org existente
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.orgs LIMIT 1;
  END IF;

  -- Só cria profile se tiver org_id
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, org_id, full_name, email, role)
    VALUES (
      NEW.id,
      v_org_id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'cashier')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger no auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

COMMENT ON FUNCTION public.fn_handle_new_user() IS 'Cria profile automaticamente ao signup. Lê org_id e role do metadata.';
