-- =============================================
-- Vitaliano ERP — Migração 00011
-- FASE 6: CD→Loja + Banco Virtual (fluxo completo)
--
-- CONTRATOS DO ACTION CATALOG:
-- cd.create_internal_order (draft)
-- cd.confirm_internal_order (atômica: estoque OUT CD + IN loja + cupom + débito ledger)
-- cd.settle_virtual_balance_with_real_payment (atômica: bank OUT loja + baixa AP + abatimento ledger)
-- cd.adjust_virtual_balance_admin (exceção, notificação crítica)
--
-- INVARIANTES:
-- - Pedido CD→Loja gera OUT CD + IN loja + débito ledger ATÔMICO
-- - Pagamento real com dinheiro da loja baixa AP + gera bank_tx + abate ledger ATÔMICO
-- - Ajuste admin é exceção e gera audit log crítico
-- =============================================

-- ===========================================
-- 1. ENUM
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.internal_order_status AS ENUM ('draft', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: internal_orders (pedidos CD→Loja)
-- ===========================================

CREATE TABLE public.internal_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  source_store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  destination_store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  status              public.internal_order_status NOT NULL DEFAULT 'draft',
  order_date          date NOT NULL DEFAULT CURRENT_DATE,
  total_amount        numeric(15,2) NOT NULL DEFAULT 0,

  notes               text,

  confirmed_at        timestamptz,
  confirmed_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  source_type         public.source_type NOT NULL DEFAULT 'user',
  source_id           text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_io_org_status ON public.internal_orders(org_id, status);
CREATE INDEX idx_io_org_date ON public.internal_orders(org_id, created_at DESC);
CREATE INDEX idx_io_source ON public.internal_orders(source_store_id);
CREATE INDEX idx_io_dest ON public.internal_orders(destination_store_id);

CREATE TRIGGER trg_io_updated_at BEFORE UPDATE ON public.internal_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: internal_order_items
-- ===========================================

CREATE TABLE public.internal_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  internal_order_id   uuid NOT NULL REFERENCES public.internal_orders(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity            numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(15,4) NOT NULL DEFAULT 0,
  total_cost          numeric(15,4) NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  unit_id             uuid REFERENCES public.units(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ioi_order ON public.internal_order_items(internal_order_id);
CREATE INDEX idx_ioi_item ON public.internal_order_items(item_id);

CREATE TRIGGER trg_ioi_updated_at BEFORE UPDATE ON public.internal_order_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. RLS
-- ===========================================

ALTER TABLE public.internal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "io_select" ON public.internal_orders FOR SELECT
  USING (org_id = public.get_my_org_id());

CREATE POLICY "io_insert" ON public.internal_orders FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "io_update" ON public.internal_orders FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ioi_select" ON public.internal_order_items FOR SELECT
  USING (org_id = public.get_my_org_id());

CREATE POLICY "ioi_insert" ON public.internal_order_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ioi_update" ON public.internal_order_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ioi_delete" ON public.internal_order_items FOR DELETE
  USING (org_id = public.get_my_org_id());

-- ===========================================
-- 5. FUNÇÃO ATÔMICA: fn_confirm_internal_order
-- Estoque OUT CD + IN loja + débito ledger + audit
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_confirm_internal_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       internal_orders%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_items_ct    int;
  v_total       numeric;
  v_inv_out_ct  int;
  v_inv_in_ct   int;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- 1. Lock pedido
  SELECT * INTO v_order FROM internal_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido interno não encontrado';
  END IF;
  IF v_order.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Idempotência
  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Pedido já confirmado');
  END IF;

  IF v_order.status != 'draft' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser confirmados. Status: %', v_order.status;
  END IF;

  -- 2. Validações
  SELECT count(*), COALESCE(sum(total_cost), 0)
  INTO v_items_ct, v_total
  FROM internal_order_items WHERE internal_order_id = p_order_id;

  IF v_items_ct = 0 THEN
    RAISE EXCEPTION 'Pedido não possui itens';
  END IF;

  -- 3. Atualizar pedido
  UPDATE internal_orders
  SET status = 'confirmed',
      total_amount = v_total,
      confirmed_at = now(),
      confirmed_by = v_user_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- 4. Estoque OUT no CD (source_store_id)
  INSERT INTO inventory_moves (
    org_id, store_id, item_id, move_type, quantity, unit_cost,
    reference_type, reference_id, source_type, source_id, created_by
  )
  SELECT
    v_order.org_id, v_order.source_store_id, ioi.item_id,
    'OUT', ioi.quantity, ioi.unit_cost,
    'internal_order', v_order.id, 'system', v_order.id::text, v_user_id
  FROM internal_order_items ioi
  WHERE ioi.internal_order_id = p_order_id;

  GET DIAGNOSTICS v_inv_out_ct = ROW_COUNT;

  -- 5. Estoque IN na loja destino (destination_store_id)
  INSERT INTO inventory_moves (
    org_id, store_id, item_id, move_type, quantity, unit_cost,
    reference_type, reference_id, source_type, source_id, created_by
  )
  SELECT
    v_order.org_id, v_order.destination_store_id, ioi.item_id,
    'IN', ioi.quantity, ioi.unit_cost,
    'internal_order', v_order.id, 'system', v_order.id::text, v_user_id
  FROM internal_order_items ioi
  WHERE ioi.internal_order_id = p_order_id;

  GET DIAGNOSTICS v_inv_in_ct = ROW_COUNT;

  -- 6. Débito no banco virtual (loja destino deve ao CD)
  INSERT INTO virtual_ledger_entries (
    org_id, store_id, entry_type, amount, description,
    reference_type, reference_id, source_type, source_id, created_by
  ) VALUES (
    v_order.org_id,
    v_order.destination_store_id,
    'DEBIT',
    v_total,
    'Pedido interno #' || left(p_order_id::text, 8),
    'internal_order',
    v_order.id,
    'system',
    v_order.id::text,
    v_user_id
  );

  -- 7. Audit
  PERFORM fn_audit_log(
    v_order.org_id, v_order.source_store_id, v_user_id,
    'confirm_internal_order', 'internal_orders', p_order_id,
    NULL,
    jsonb_build_object(
      'status', 'confirmed',
      'source_store_id', v_order.source_store_id,
      'destination_store_id', v_order.destination_store_id,
      'total_amount', v_total,
      'inv_out', v_inv_out_ct, 'inv_in', v_inv_in_ct
    ),
    'system', v_order.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_amount', v_total,
    'inventory_out', v_inv_out_ct,
    'inventory_in', v_inv_in_ct,
    'message', 'Pedido confirmado: estoque transferido + débito virtual gerado'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_internal_order IS
  'Confirma pedido CD→Loja atomicamente: OUT CD + IN loja + DEBIT ledger + audit. Idempotente.';

-- ===========================================
-- 6. FUNÇÃO ATÔMICA: fn_settle_virtual_balance
-- Pagamento real abate saldo virtual
-- bank OUT loja + baixa AP (se houver) + CREDIT ledger
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_settle_virtual_balance(
  p_store_id uuid,
  p_bank_account_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'Liquidação banco virtual',
  p_ap_payable_id uuid DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_org_id      uuid;
  v_bank_tx_id  uuid;
  v_store       stores%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- Validações
  SELECT * INTO v_store FROM stores WHERE id = p_store_id;
  IF v_store IS NULL OR v_store.org_id != v_org_id THEN
    RAISE EXCEPTION 'Loja não encontrada ou acesso negado';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  -- 1. Gerar bank_transaction DEBIT na loja (dinheiro saindo da loja para pagar CD)
  INSERT INTO bank_transactions (
    org_id, store_id, bank_account_id, type, amount, description,
    transaction_date, reference_type, reference_id,
    source_type, source_id, created_by
  ) VALUES (
    v_org_id, p_store_id, p_bank_account_id, 'debit', p_amount,
    p_description,
    p_transaction_date, 'virtual_settlement', p_store_id,
    'system', p_store_id::text, v_user_id
  ) RETURNING id INTO v_bank_tx_id;

  -- 2. Baixar AP vinculado (se informado)
  IF p_ap_payable_id IS NOT NULL THEN
    UPDATE ap_payables
    SET status = 'paid',
        paid_amount = amount,
        paid_at = now(),
        bank_transaction_id = v_bank_tx_id,
        updated_at = now()
    WHERE id = p_ap_payable_id AND org_id = v_org_id;
  END IF;

  -- 3. CREDIT no banco virtual (abate débito da loja)
  INSERT INTO virtual_ledger_entries (
    org_id, store_id, entry_type, amount, description,
    reference_type, reference_id, source_type, source_id, created_by
  ) VALUES (
    v_org_id,
    p_store_id,
    'CREDIT',
    p_amount,
    p_description,
    'virtual_settlement',
    v_bank_tx_id,
    'system',
    v_bank_tx_id::text,
    v_user_id
  );

  -- 4. Audit
  PERFORM fn_audit_log(
    v_org_id, p_store_id, v_user_id,
    'settle_virtual_balance', 'virtual_ledger_entries', v_bank_tx_id,
    NULL,
    jsonb_build_object(
      'store_id', p_store_id,
      'amount', p_amount,
      'bank_transaction_id', v_bank_tx_id,
      'ap_payable_id', p_ap_payable_id
    ),
    'system', v_bank_tx_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'bank_transaction_id', v_bank_tx_id,
    'amount', p_amount,
    'message', 'Saldo virtual abatido com pagamento real'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_settle_virtual_balance IS
  'Liquida saldo virtual com pagamento real. Atômica: bank_tx DEBIT + CREDIT ledger + baixa AP + audit.';

-- ===========================================
-- 7. FUNÇÃO: fn_adjust_virtual_balance_admin
-- Exceção: ajuste admin com notificação crítica
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_adjust_virtual_balance_admin(
  p_store_id uuid,
  p_amount numeric,
  p_description text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_org_id    uuid;
  v_entry_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- Apenas admins
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem fazer ajustes no banco virtual';
  END IF;

  -- ADJUST no ledger (pode ser + ou -)
  INSERT INTO virtual_ledger_entries (
    org_id, store_id, entry_type, amount, description, notes,
    reference_type, source_type, source_id, created_by
  ) VALUES (
    v_org_id, p_store_id, 'ADJUST', p_amount, p_description, p_notes,
    'admin_adjustment', 'user', v_user_id::text, v_user_id
  ) RETURNING id INTO v_entry_id;

  -- Audit CRÍTICO
  PERFORM fn_audit_log(
    v_org_id, p_store_id, v_user_id,
    'CRITICAL:adjust_virtual_balance_admin', 'virtual_ledger_entries', v_entry_id,
    NULL,
    jsonb_build_object(
      'store_id', p_store_id,
      'amount', p_amount,
      'description', p_description,
      'notes', p_notes,
      'WARNING', 'Ajuste administrativo excepcional no banco virtual'
    ),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'amount', p_amount,
    'message', 'Ajuste admin aplicado. Ação registrada como CRÍTICA.'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_adjust_virtual_balance_admin IS
  'Ajuste excepcional admin no banco virtual. Gera audit CRITICAL. Somente admins.';

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
  RAISE NOTICE 'Tabelas: % (esperado: 31) | Views: % (esperado: 3)', t_count, v_count;
END $$;
