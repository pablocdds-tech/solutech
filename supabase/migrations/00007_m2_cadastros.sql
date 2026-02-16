-- =============================================
-- Vitaliano ERP — Migração 00007
-- FASE 2: Cadastros (M2)
-- 6 novos enums + 12 tabelas + RLS + helper
-- =============================================

-- ===========================================
-- ENUMS M2
-- ===========================================

CREATE TYPE public.item_type AS ENUM ('product', 'ingredient', 'supply');
CREATE TYPE public.finance_category_type AS ENUM ('revenue', 'expense');
CREATE TYPE public.payment_method_type AS ENUM (
  'cash', 'credit_card', 'debit_card', 'pix',
  'bank_transfer', 'boleto', 'check', 'voucher', 'other'
);
CREATE TYPE public.sales_channel_type AS ENUM (
  'store', 'ifood', 'rappi', 'uber_eats',
  'whatsapp', 'phone', 'website', 'other'
);
CREATE TYPE public.adjustment_direction AS ENUM ('positive', 'negative', 'both');
CREATE TYPE public.bank_account_type AS ENUM ('checking', 'savings', 'investment');

-- ===========================================
-- HELPER: verificar permissão de edição em módulo
-- ===========================================

CREATE OR REPLACE FUNCTION public.can_edit_module(p_module public.app_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.module_permissions
    WHERE user_id = auth.uid()
      AND module = p_module
      AND access_level = 'edit'
  );
$$;

-- ===========================================
-- 1. GRUPOS DE INGREDIENTES
-- ===========================================

CREATE TABLE public.ingredient_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_groups_org_name_unique UNIQUE (org_id, name)
);
CREATE INDEX idx_ingredient_groups_org ON public.ingredient_groups(org_id);
CREATE TRIGGER trg_ingredient_groups_updated_at BEFORE UPDATE ON public.ingredient_groups
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 2. UNIDADES DE MEDIDA
-- ===========================================

CREATE TABLE public.units (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  abbreviation  text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_org_abbr_unique UNIQUE (org_id, abbreviation)
);
CREATE INDEX idx_units_org ON public.units(org_id);
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. ITENS (Produtos / Ingredientes / Insumos)
-- ===========================================

CREATE TABLE public.items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name                text NOT NULL,
  normalized_name     text NOT NULL GENERATED ALWAYS AS (lower(trim(name))) STORED,
  sku                 text,
  barcode             text,
  description         text,
  type                public.item_type NOT NULL DEFAULT 'ingredient',
  ingredient_group_id uuid REFERENCES public.ingredient_groups(id) ON DELETE SET NULL,
  default_unit_id     uuid REFERENCES public.units(id) ON DELETE SET NULL,
  min_stock           numeric(15,4),
  max_stock           numeric(15,4),
  image_url           text,
  is_active           boolean NOT NULL DEFAULT true,
  settings            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_org_name_unique UNIQUE (org_id, normalized_name)
);
CREATE UNIQUE INDEX idx_items_org_sku ON public.items(org_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_items_org_barcode ON public.items(org_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_items_org ON public.items(org_id);
CREATE INDEX idx_items_type ON public.items(org_id, type);
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. FORNECEDORES
-- ===========================================

CREATE TABLE public.suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  normalized_name text NOT NULL GENERATED ALWAYS AS (lower(trim(name))) STORED,
  cnpj            text,
  cpf             text,
  email           text,
  phone           text,
  address         text,
  city            text,
  state           text,
  zip_code        text,
  contact_name    text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_org_name_unique UNIQUE (org_id, normalized_name)
);
CREATE UNIQUE INDEX idx_suppliers_org_cnpj ON public.suppliers(org_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_suppliers_org ON public.suppliers(org_id);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 5. CATEGORIAS FINANCEIRAS
-- ===========================================

CREATE TABLE public.finance_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  type        public.finance_category_type NOT NULL,
  parent_id   uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_categories_org_name_type_unique UNIQUE (org_id, name, type)
);
CREATE INDEX idx_finance_categories_org ON public.finance_categories(org_id);
CREATE TRIGGER trg_finance_categories_updated_at BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 6. FORMAS DE PAGAMENTO
-- ===========================================

CREATE TABLE public.payment_methods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  type            public.payment_method_type NOT NULL DEFAULT 'other',
  days_to_receive int NOT NULL DEFAULT 0,
  fee_percent     numeric(5,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_org_name_unique UNIQUE (org_id, name)
);
CREATE INDEX idx_payment_methods_org ON public.payment_methods(org_id);
CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 7. CANAIS DE VENDA
-- ===========================================

CREATE TABLE public.sales_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  type          public.sales_channel_type NOT NULL DEFAULT 'store',
  fee_percent   numeric(5,2) NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_channels_org_name_unique UNIQUE (org_id, name)
);
CREATE INDEX idx_sales_channels_org ON public.sales_channels(org_id);
CREATE TRIGGER trg_sales_channels_updated_at BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 8. CENTROS DE CUSTO
-- ===========================================

CREATE TABLE public.cost_centers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  name        text NOT NULL,
  code        text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_centers_org_name_unique UNIQUE (org_id, name)
);
CREATE INDEX idx_cost_centers_org ON public.cost_centers(org_id);
CREATE TRIGGER trg_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 9. CONTAS BANCÁRIAS
-- ===========================================

CREATE TABLE public.bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  bank_name       text,
  agency          text,
  account_number  text,
  account_type    public.bank_account_type NOT NULL DEFAULT 'checking',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_accounts_org_store_name_unique UNIQUE (org_id, store_id, name)
);
CREATE INDEX idx_bank_accounts_org ON public.bank_accounts(org_id);
CREATE INDEX idx_bank_accounts_store ON public.bank_accounts(org_id, store_id);
CREATE TRIGGER trg_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 10. CONVERSÕES DE UNIDADES
-- ===========================================

CREATE TABLE public.unit_conversions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  from_unit_id  uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  to_unit_id    uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  factor        numeric(15,6) NOT NULL,
  item_id       uuid REFERENCES public.items(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_conversions_unique UNIQUE (org_id, from_unit_id, to_unit_id, item_id),
  CONSTRAINT unit_conversions_different_units CHECK (from_unit_id != to_unit_id)
);
CREATE INDEX idx_unit_conversions_org ON public.unit_conversions(org_id);

-- ===========================================
-- 11. PREÇOS POR LOJA (Tabela de Preços)
-- ===========================================

CREATE TABLE public.item_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  price       numeric(15,2) NOT NULL DEFAULT 0,
  cost_price  numeric(15,2),
  is_active   boolean NOT NULL DEFAULT true,
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_prices_store_item_unique UNIQUE (org_id, store_id, item_id)
);
CREATE INDEX idx_item_prices_org ON public.item_prices(org_id);
CREATE INDEX idx_item_prices_item ON public.item_prices(item_id);
CREATE TRIGGER trg_item_prices_updated_at BEFORE UPDATE ON public.item_prices
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 12. MOTIVOS DE AJUSTE
-- ===========================================

CREATE TABLE public.adjustment_reasons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  direction         public.adjustment_direction NOT NULL DEFAULT 'both',
  requires_approval boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adjustment_reasons_org_name_unique UNIQUE (org_id, name)
);
CREATE INDEX idx_adjustment_reasons_org ON public.adjustment_reasons(org_id);
CREATE TRIGGER trg_adjustment_reasons_updated_at BEFORE UPDATE ON public.adjustment_reasons
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- RLS PARA TODAS AS TABELAS M2
-- Padrão: SELECT = mesma org | INSERT/UPDATE = mesma org + admin ou M2 edit
-- ===========================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'ingredient_groups', 'units', 'items', 'suppliers',
      'finance_categories', 'payment_methods', 'sales_channels',
      'cost_centers', 'bank_accounts', 'unit_conversions',
      'item_prices', 'adjustment_reasons'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (org_id = public.get_my_org_id())',
      tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY "%s_insert" ON public.%I FOR INSERT WITH CHECK (org_id = public.get_my_org_id() AND public.can_edit_module(''M2''))',
      tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY "%s_update" ON public.%I FOR UPDATE USING (org_id = public.get_my_org_id() AND public.can_edit_module(''M2'')) WITH CHECK (org_id = public.get_my_org_id() AND public.can_edit_module(''M2''))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ===========================================
-- VERIFICAÇÃO
-- ===========================================
DO $$
DECLARE t_count int;
BEGIN
  SELECT count(*) INTO t_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  RAISE NOTICE 'Total de tabelas em public: % (esperado: 20)', t_count;
END $$;
