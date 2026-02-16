-- =============================================
-- Vitaliano ERP — Migração 00012
-- FASE 7: Produção + Custo Real + CMV (M4 profundo)
--
-- CONTRATOS DO ACTION CATALOG:
-- production.create_recipe
-- production.create_order / production.start_order
-- production.register_consumption / production.register_loss
-- production.finalize_order (atômica: OUT insumos + IN produto + custo real + perdas)
-- cmv.compute_for_sales_period (CMV derivado, nunca digitado)
--
-- INVARIANTES:
-- - CMV = derivado de inventory_moves, NUNCA digitado
-- - Custo real = soma dos consumos + perdas na ordem de produção
-- - Finalizar OP: OUT insumos + IN produto acabado + custo real, ATÔMICO
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.production_order_status AS ENUM ('draft', 'in_progress', 'finalized', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: recipes (Fichas Técnicas)
-- ===========================================

CREATE TABLE public.recipes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid REFERENCES public.stores(id) ON DELETE SET NULL,

  name            text NOT NULL,
  description     text,
  output_item_id  uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  output_quantity numeric(15,4) NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
  output_unit_id  uuid REFERENCES public.units(id) ON DELETE SET NULL,

  is_active       boolean NOT NULL DEFAULT true,
  notes           text,

  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_org ON public.recipes(org_id);
CREATE INDEX idx_recipe_output ON public.recipes(output_item_id);
CREATE UNIQUE INDEX idx_recipe_name_org ON public.recipes(org_id, lower(name)) WHERE is_active = true;

CREATE TRIGGER trg_recipe_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: recipe_items (Insumos da Ficha)
-- ===========================================

CREATE TABLE public.recipe_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  recipe_id       uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity        numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_id         uuid REFERENCES public.units(id) ON DELETE SET NULL,
  loss_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (loss_percentage >= 0 AND loss_percentage <= 100),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ri_recipe ON public.recipe_items(recipe_id);
CREATE INDEX idx_ri_item ON public.recipe_items(item_id);
CREATE UNIQUE INDEX idx_ri_unique ON public.recipe_items(recipe_id, item_id);

CREATE TRIGGER trg_ri_updated_at BEFORE UPDATE ON public.recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: production_orders (Ordens de Produção)
-- ===========================================

CREATE TABLE public.production_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  recipe_id         uuid NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,

  status            public.production_order_status NOT NULL DEFAULT 'draft',
  planned_quantity  numeric(15,4) NOT NULL CHECK (planned_quantity > 0),
  actual_quantity   numeric(15,4),
  planned_date      date NOT NULL DEFAULT CURRENT_DATE,

  total_input_cost  numeric(15,4) NOT NULL DEFAULT 0,
  total_loss_cost   numeric(15,4) NOT NULL DEFAULT 0,
  real_unit_cost    numeric(15,4) NOT NULL DEFAULT 0,

  notes             text,

  started_at        timestamptz,
  started_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at      timestamptz,
  finalized_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  source_type       public.source_type NOT NULL DEFAULT 'user',
  source_id         text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_org_status ON public.production_orders(org_id, status);
CREATE INDEX idx_po_store ON public.production_orders(store_id);
CREATE INDEX idx_po_recipe ON public.production_orders(recipe_id);
CREATE INDEX idx_po_date ON public.production_orders(org_id, planned_date DESC);

CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 5. TABELA: production_consumptions (Consumos registrados)
-- ===========================================

CREATE TABLE public.production_consumptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity            numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(15,4) NOT NULL DEFAULT 0,
  total_cost          numeric(15,4) NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  unit_id             uuid REFERENCES public.units(id) ON DELETE SET NULL,
  notes               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pc_order ON public.production_consumptions(production_order_id);
CREATE INDEX idx_pc_item ON public.production_consumptions(item_id);

-- ===========================================
-- 6. TABELA: production_losses (Perdas registradas)
-- ===========================================

CREATE TABLE public.production_losses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity            numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(15,4) NOT NULL DEFAULT 0,
  total_cost          numeric(15,4) NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  unit_id             uuid REFERENCES public.units(id) ON DELETE SET NULL,
  reason              text,
  reason_id           uuid REFERENCES public.reasons_adjustment(id) ON DELETE SET NULL,
  notes               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_order ON public.production_losses(production_order_id);
CREATE INDEX idx_pl_item ON public.production_losses(item_id);

-- ===========================================
-- 7. RLS
-- ===========================================

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_losses ENABLE ROW LEVEL SECURITY;

-- recipes
CREATE POLICY "recipe_select" ON public.recipes FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "recipe_insert" ON public.recipes FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "recipe_update" ON public.recipes FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- recipe_items
CREATE POLICY "ri_select" ON public.recipe_items FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ri_insert" ON public.recipe_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ri_update" ON public.recipe_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ri_delete" ON public.recipe_items FOR DELETE
  USING (org_id = public.get_my_org_id());

-- production_orders
CREATE POLICY "po_select" ON public.production_orders FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "po_insert" ON public.production_orders FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "po_update" ON public.production_orders FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- production_consumptions (imutáveis como inventory_moves: apenas SELECT + INSERT)
CREATE POLICY "pc_select" ON public.production_consumptions FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "pc_insert" ON public.production_consumptions FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

-- production_losses (imutáveis: apenas SELECT + INSERT)
CREATE POLICY "pl_select" ON public.production_losses FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "pl_insert" ON public.production_losses FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

-- ===========================================
-- 8. FUNÇÃO ATÔMICA: fn_finalize_production_order
-- OUT insumos + IN produto acabado + custo real + perdas + audit
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_finalize_production_order(
  p_order_id uuid,
  p_actual_quantity numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order             production_orders%ROWTYPE;
  v_user_id           uuid;
  v_org_id            uuid;
  v_total_input_cost  numeric := 0;
  v_total_loss_cost   numeric := 0;
  v_actual_qty        numeric;
  v_real_unit_cost    numeric;
  v_out_count         int := 0;
  v_recipe            recipes%ROWTYPE;
  r_cons              RECORD;
  r_loss              RECORD;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- 1. Lock ordem
  SELECT * INTO v_order FROM production_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada';
  END IF;
  IF v_order.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Idempotência
  IF v_order.status = 'finalized' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Ordem já finalizada');
  END IF;

  IF v_order.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Somente ordens em rascunho ou em andamento podem ser finalizadas. Status: %', v_order.status;
  END IF;

  v_actual_qty := COALESCE(p_actual_quantity, v_order.planned_quantity);

  -- Buscar receita
  SELECT * INTO v_recipe FROM recipes WHERE id = v_order.recipe_id;

  -- 2. Processar consumos → gerar inventory_moves OUT
  FOR r_cons IN
    SELECT item_id, SUM(quantity) as qty, AVG(unit_cost) as avg_cost
    FROM production_consumptions
    WHERE production_order_id = p_order_id
    GROUP BY item_id
  LOOP
    INSERT INTO inventory_moves (
      org_id, store_id, item_id, move_type, quantity, unit_cost,
      reference_type, reference_id, source_type, source_id, created_by
    ) VALUES (
      v_order.org_id, v_order.store_id, r_cons.item_id,
      'OUT', r_cons.qty, r_cons.avg_cost,
      'production_order', v_order.id, 'system', v_order.id::text, v_user_id
    );
    v_out_count := v_out_count + 1;
    v_total_input_cost := v_total_input_cost + (r_cons.qty * r_cons.avg_cost);
  END LOOP;

  -- 3. Processar perdas → gerar inventory_moves OUT (perda)
  FOR r_loss IN
    SELECT item_id, SUM(quantity) as qty, AVG(unit_cost) as avg_cost
    FROM production_losses
    WHERE production_order_id = p_order_id
    GROUP BY item_id
  LOOP
    INSERT INTO inventory_moves (
      org_id, store_id, item_id, move_type, quantity, unit_cost,
      reference_type, reference_id, notes, source_type, source_id, created_by
    ) VALUES (
      v_order.org_id, v_order.store_id, r_loss.item_id,
      'OUT', r_loss.qty, r_loss.avg_cost,
      'production_loss', v_order.id, 'Perda em produção',
      'system', v_order.id::text, v_user_id
    );
    v_total_loss_cost := v_total_loss_cost + (r_loss.qty * r_loss.avg_cost);
  END LOOP;

  -- 4. Custo real unitário
  IF v_actual_qty > 0 THEN
    v_real_unit_cost := (v_total_input_cost + v_total_loss_cost) / v_actual_qty;
  ELSE
    v_real_unit_cost := 0;
  END IF;

  -- 5. Gerar inventory_moves IN (produto acabado)
  INSERT INTO inventory_moves (
    org_id, store_id, item_id, move_type, quantity, unit_cost,
    reference_type, reference_id, source_type, source_id, created_by
  ) VALUES (
    v_order.org_id, v_order.store_id, v_recipe.output_item_id,
    'IN', v_actual_qty, v_real_unit_cost,
    'production_order', v_order.id, 'system', v_order.id::text, v_user_id
  );

  -- 6. Atualizar ordem
  UPDATE production_orders
  SET status = 'finalized',
      actual_quantity = v_actual_qty,
      total_input_cost = v_total_input_cost,
      total_loss_cost = v_total_loss_cost,
      real_unit_cost = v_real_unit_cost,
      finalized_at = now(),
      finalized_by = v_user_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- 7. Audit
  PERFORM fn_audit_log(
    v_order.org_id, v_order.store_id, v_user_id,
    'finalize_production_order', 'production_orders', p_order_id,
    NULL,
    jsonb_build_object(
      'status', 'finalized',
      'actual_quantity', v_actual_qty,
      'total_input_cost', v_total_input_cost,
      'total_loss_cost', v_total_loss_cost,
      'real_unit_cost', v_real_unit_cost,
      'output_item_id', v_recipe.output_item_id,
      'consumptions_out', v_out_count
    ),
    'system', v_order.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'actual_quantity', v_actual_qty,
    'total_input_cost', v_total_input_cost,
    'total_loss_cost', v_total_loss_cost,
    'real_unit_cost', v_real_unit_cost,
    'message', 'Ordem finalizada: insumos OUT + produto IN + custo real calculado'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_finalize_production_order IS
  'Finaliza OP atomicamente: OUT insumos + OUT perdas + IN produto acabado com custo real. Idempotente.';

-- ===========================================
-- 9. VIEW: CMV derivado
-- CMV = custo dos produtos vendidos num período
-- Calculado a partir de inventory_moves (OUT com ref venda/produção)
-- ===========================================

CREATE OR REPLACE VIEW public.v_cmv_by_period AS
SELECT
  im.org_id,
  im.store_id,
  date_trunc('month', im.created_at) AS period,
  im.item_id,
  SUM(CASE WHEN im.move_type = 'OUT' AND im.reference_type IN ('sale', 'production_order')
      THEN im.quantity * im.unit_cost ELSE 0 END) AS cmv_total,
  SUM(CASE WHEN im.move_type = 'OUT' AND im.reference_type IN ('sale', 'production_order')
      THEN im.quantity ELSE 0 END) AS qty_out,
  SUM(CASE WHEN im.move_type = 'OUT' AND im.reference_type = 'production_loss'
      THEN im.quantity * im.unit_cost ELSE 0 END) AS loss_total
FROM public.inventory_moves im
WHERE im.move_type = 'OUT'
GROUP BY im.org_id, im.store_id, date_trunc('month', im.created_at), im.item_id;

COMMENT ON VIEW public.v_cmv_by_period IS
  'CMV derivado por período/loja/item. NUNCA digitado. Calculado a partir de inventory_moves.';

-- ===========================================
-- 10. FUNÇÃO RPC: fn_compute_cmv_for_period
-- Retorna CMV consolidado para um período
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_compute_cmv_for_period(
  p_store_id uuid DEFAULT NULL,
  p_date_from date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  store_id uuid,
  item_id uuid,
  cmv_total numeric,
  qty_out numeric,
  loss_total numeric,
  total_cost numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();

  RETURN QUERY
  SELECT
    im.store_id,
    im.item_id,
    SUM(CASE WHEN im.reference_type IN ('sale', 'production_order')
        THEN im.quantity * im.unit_cost ELSE 0 END) AS cmv_total,
    SUM(CASE WHEN im.reference_type IN ('sale', 'production_order')
        THEN im.quantity ELSE 0 END) AS qty_out,
    SUM(CASE WHEN im.reference_type = 'production_loss'
        THEN im.quantity * im.unit_cost ELSE 0 END) AS loss_total,
    SUM(im.quantity * im.unit_cost) AS total_cost
  FROM inventory_moves im
  WHERE im.org_id = v_org_id
    AND im.move_type = 'OUT'
    AND im.created_at >= p_date_from
    AND im.created_at < (p_date_to + interval '1 day')
    AND (p_store_id IS NULL OR im.store_id = p_store_id)
  GROUP BY im.store_id, im.item_id;
END;
$$;

COMMENT ON FUNCTION public.fn_compute_cmv_for_period IS
  'Retorna CMV derivado por loja/item para um período. CMV NUNCA é digitado.';

-- ===========================================
-- VERIFICAÇÃO
-- ===========================================
DO $$
DECLARE t_count int; v_count int;
BEGIN
  SELECT count(*) INTO t_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT count(*) INTO v_count FROM information_schema.views
  WHERE table_schema = 'public';
  RAISE NOTICE 'Tabelas: % (esperado: 36) | Views: % (esperado: 4)', t_count, v_count;
END $$;
