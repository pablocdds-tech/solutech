-- =============================================
-- Vitaliano ERP — Migração 00014
-- FASE 9: Vendas & Recebíveis (M6)
--
-- 9.1 Registro de vendas por canal e forma de pagamento
-- 9.2 Geração de recebíveis (AR) por prazo
-- 9.3 Sem PDV lojas por enquanto (apenas CD→lojas já coberto)
--
-- INVARIANTES:
-- - Venda gera inventory_moves OUT (estoque) quando confirmada
-- - Recebíveis gerados por prazo da forma de pagamento
-- - Não existe PDV das lojas ainda; registro manual ou via integração
-- - Vendas por canal (loja, iFood, Rappi, etc.) e forma de pagamento
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.sale_status AS ENUM ('draft', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: sales (registro de vendas)
-- ===========================================

CREATE TABLE public.sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  status            public.sale_status NOT NULL DEFAULT 'draft',
  sale_date         date NOT NULL DEFAULT CURRENT_DATE,
  sales_channel_id  uuid REFERENCES public.sales_channels(id) ON DELETE SET NULL,

  subtotal          numeric(15,2) NOT NULL DEFAULT 0,
  discount          numeric(15,2) NOT NULL DEFAULT 0,
  total_amount      numeric(15,2) NOT NULL DEFAULT 0,

  customer_name     text,
  customer_doc      text,
  external_id       text,
  notes             text,

  confirmed_at      timestamptz,
  confirmed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  source_type       public.source_type NOT NULL DEFAULT 'user',
  source_id         text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_org_status ON public.sales(org_id, status);
CREATE INDEX idx_sale_store ON public.sales(store_id);
CREATE INDEX idx_sale_date ON public.sales(org_id, sale_date DESC);
CREATE INDEX idx_sale_channel ON public.sales(sales_channel_id);

-- Anti-duplicidade para integrações (iFood, etc.)
CREATE UNIQUE INDEX idx_sale_external ON public.sales(org_id, store_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TRIGGER trg_sale_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: sale_items (itens da venda)
-- ===========================================

CREATE TABLE public.sale_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  sale_id         uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,

  quantity        numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_price      numeric(15,4) NOT NULL DEFAULT 0,
  discount        numeric(15,4) NOT NULL DEFAULT 0,
  total_price     numeric(15,4) NOT NULL GENERATED ALWAYS AS ((quantity * unit_price) - discount) STORED,
  unit_id         uuid REFERENCES public.units(id) ON DELETE SET NULL,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_si_sale ON public.sale_items(sale_id);
CREATE INDEX idx_si_item ON public.sale_items(item_id);

CREATE TRIGGER trg_si_updated_at BEFORE UPDATE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: sale_payments (formas de pagamento da venda)
-- ===========================================

CREATE TABLE public.sale_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  sale_id             uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method_id   uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,

  amount              numeric(15,2) NOT NULL CHECK (amount > 0),
  installments        int NOT NULL DEFAULT 1 CHECK (installments >= 1),
  days_to_receive     int NOT NULL DEFAULT 0 CHECK (days_to_receive >= 0),
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sp_sale ON public.sale_payments(sale_id);

-- ===========================================
-- 5. RLS
-- ===========================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_select" ON public.sales FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "sale_insert" ON public.sales FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "sale_update" ON public.sales FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "si_select" ON public.sale_items FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "si_insert" ON public.sale_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "si_update" ON public.sale_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "si_delete" ON public.sale_items FOR DELETE
  USING (org_id = public.get_my_org_id());

CREATE POLICY "sp_select" ON public.sale_payments FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "sp_insert" ON public.sale_payments FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "sp_delete" ON public.sale_payments FOR DELETE
  USING (org_id = public.get_my_org_id());

-- ===========================================
-- 6. FUNÇÃO ATÔMICA: fn_confirm_sale
-- Confirma venda: estoque OUT + gera AR por prazo + audit
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_confirm_sale(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale        sales%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_items_ct    int;
  v_total       numeric;
  v_pay_total   numeric;
  v_inv_out_ct  int;
  v_ar_ct       int := 0;
  r_pay         RECORD;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- 1. Lock venda
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;
  IF v_sale.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Idempotência
  IF v_sale.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Venda já confirmada');
  END IF;

  IF v_sale.status != 'draft' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser confirmados. Status: %', v_sale.status;
  END IF;

  -- 2. Validações
  SELECT count(*), COALESCE(sum(total_price), 0)
  INTO v_items_ct, v_total
  FROM sale_items WHERE sale_id = p_sale_id;

  IF v_items_ct = 0 THEN
    RAISE EXCEPTION 'Venda não possui itens';
  END IF;

  SELECT COALESCE(sum(amount), 0)
  INTO v_pay_total
  FROM sale_payments WHERE sale_id = p_sale_id;

  IF ABS(v_pay_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Total dos pagamentos (%) difere do total da venda (%)', v_pay_total, v_total;
  END IF;

  -- 3. Atualizar venda
  UPDATE sales
  SET status = 'confirmed',
      subtotal = v_total + v_sale.discount,
      total_amount = v_total,
      confirmed_at = now(),
      confirmed_by = v_user_id,
      updated_at = now()
  WHERE id = p_sale_id;

  -- 4. Estoque OUT na loja
  INSERT INTO inventory_moves (
    org_id, store_id, item_id, move_type, quantity, unit_cost,
    reference_type, reference_id, source_type, source_id, created_by
  )
  SELECT
    v_sale.org_id, v_sale.store_id, si.item_id,
    'OUT', si.quantity, si.unit_price,
    'sale', v_sale.id, 'system', v_sale.id::text, v_user_id
  FROM sale_items si
  WHERE si.sale_id = p_sale_id;

  GET DIAGNOSTICS v_inv_out_ct = ROW_COUNT;

  -- 5. Gerar AR por prazo (para cada forma de pagamento com prazo > 0)
  FOR r_pay IN
    SELECT * FROM sale_payments WHERE sale_id = p_sale_id AND days_to_receive > 0
  LOOP
    -- Gerar parcelas
    FOR i IN 1 .. r_pay.installments LOOP
      INSERT INTO ar_receivables (
        org_id, store_id, description, amount, due_date,
        reference_type, reference_id,
        source_type, source_id, created_by
      ) VALUES (
        v_sale.org_id,
        v_sale.store_id,
        'Venda #' || left(p_sale_id::text, 8) || ' parcela ' || i || '/' || r_pay.installments,
        r_pay.amount / r_pay.installments,
        v_sale.sale_date + (r_pay.days_to_receive * i),
        'sale',
        v_sale.id,
        'system',
        v_sale.id::text,
        v_user_id
      );
      v_ar_ct := v_ar_ct + 1;
    END LOOP;
  END LOOP;

  -- 6. Audit
  PERFORM fn_audit_log(
    v_sale.org_id, v_sale.store_id, v_user_id,
    'confirm_sale', 'sales', p_sale_id,
    NULL,
    jsonb_build_object(
      'status', 'confirmed',
      'total_amount', v_total,
      'inventory_out', v_inv_out_ct,
      'ar_generated', v_ar_ct,
      'sale_date', v_sale.sale_date,
      'channel', v_sale.sales_channel_id
    ),
    'system', v_sale.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'total_amount', v_total,
    'inventory_out', v_inv_out_ct,
    'ar_generated', v_ar_ct,
    'message', 'Venda confirmada: estoque OUT + recebíveis gerados'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_sale IS
  'Confirma venda atomicamente: OUT estoque + gera AR por prazo + audit. Idempotente.';

-- ===========================================
-- 7. FUNÇÃO: fn_cancel_sale
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_cancel_sale(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale    sales%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;
  IF v_sale.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Venda já cancelada');
  END IF;

  IF v_sale.status != 'draft' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser cancelados diretamente. Vendas confirmadas requerem estorno.';
  END IF;

  UPDATE sales
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id,
      updated_at = now()
  WHERE id = p_sale_id;

  PERFORM fn_audit_log(
    v_sale.org_id, v_sale.store_id, v_user_id,
    'cancel_sale', 'sales', p_sale_id,
    NULL,
    jsonb_build_object('status', 'cancelled'),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Venda cancelada');
END;
$$;

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
  RAISE NOTICE 'Tabelas: % (esperado: 42) | Views: % (esperado: 4)', t_count, v_count;
END $$;
