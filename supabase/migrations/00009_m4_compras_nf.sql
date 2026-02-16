-- =============================================
-- Vitaliano ERP — Migração 00009
-- FASE 4: NF/Compras com Action Catalog (M3)
--
-- INVARIANTES:
-- - confirm_receiving é ATÔMICA (ou tudo, ou nada)
-- - confirm_receiving é IDEMPOTENTE (re-confirmar não duplica)
-- - NF unique por invoice_key; fallback (org_id, supplier_id, invoice_number, invoice_date)
-- - AP gerado apenas na loja faturada (billed_store_id)
-- - Estoque IN gerado na loja destino (store_id, geralmente CD)
-- - Todos os registros críticos geram audit_logs
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

CREATE TYPE public.receiving_status AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE public.receiving_item_match AS ENUM ('pending', 'matched', 'created', 'ignored');
CREATE TYPE public.payable_status AS ENUM ('pending', 'partial', 'paid', 'cancelled');

-- ===========================================
-- 2. TABELA: receivings (cabeçalho de recebimento)
-- ===========================================

CREATE TABLE public.receivings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  billed_store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  supplier_id       uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,

  status            public.receiving_status NOT NULL DEFAULT 'draft',

  -- Dados da NF
  invoice_key       text,
  invoice_number    text,
  invoice_series    text,
  invoice_date      date,

  -- Valores
  total_products    numeric(15,2) NOT NULL DEFAULT 0,
  freight_amount    numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount   numeric(15,2) NOT NULL DEFAULT 0,
  other_costs       numeric(15,2) NOT NULL DEFAULT 0,
  total_amount      numeric(15,2) NOT NULL DEFAULT 0,

  notes             text,

  -- Confirmação/cancelamento
  confirmed_at      timestamptz,
  confirmed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Rastreabilidade
  source_type       public.source_type NOT NULL DEFAULT 'user',
  source_id         text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique: chave NF-e (quando disponível)
CREATE UNIQUE INDEX uq_receiving_invoice_key
  ON public.receivings(org_id, invoice_key)
  WHERE invoice_key IS NOT NULL;

-- Unique fallback: fornecedor + número + data (quando sem chave NF-e)
CREATE UNIQUE INDEX uq_receiving_supplier_number_date
  ON public.receivings(org_id, supplier_id, invoice_number, invoice_date)
  WHERE invoice_key IS NULL
    AND supplier_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND invoice_date IS NOT NULL;

CREATE INDEX idx_receivings_org_status ON public.receivings(org_id, status);
CREATE INDEX idx_receivings_org_date ON public.receivings(org_id, created_at DESC);
CREATE INDEX idx_receivings_supplier ON public.receivings(supplier_id);

CREATE TRIGGER trg_receivings_updated_at BEFORE UPDATE ON public.receivings
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: receiving_items (linhas do recebimento)
-- ===========================================

CREATE TABLE public.receiving_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  receiving_id        uuid NOT NULL REFERENCES public.receivings(id) ON DELETE CASCADE,

  -- Dados originais da NF
  supplier_item_code  text,
  supplier_item_name  text NOT NULL,
  ncm                 text,
  cfop                text,

  -- Quantidades e valores
  quantity            numeric(15,4) NOT NULL DEFAULT 0,
  unit_cost           numeric(15,4) NOT NULL DEFAULT 0,
  total_cost          numeric(15,4) NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  discount            numeric(15,2) NOT NULL DEFAULT 0,

  -- Match com cadastro
  item_id             uuid REFERENCES public.items(id) ON DELETE SET NULL,
  unit_id             uuid REFERENCES public.units(id) ON DELETE SET NULL,
  matched_status      public.receiving_item_match NOT NULL DEFAULT 'pending',

  -- Sugestão IA
  ai_confidence       numeric(5,2),
  ai_suggested_item   jsonb,

  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_receiving_items_receiving ON public.receiving_items(receiving_id);
CREATE INDEX idx_receiving_items_item ON public.receiving_items(item_id) WHERE item_id IS NOT NULL;

CREATE TRIGGER trg_receiving_items_updated_at BEFORE UPDATE ON public.receiving_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: receiving_payments (plano de pagamento)
-- ===========================================

CREATE TABLE public.receiving_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  receiving_id        uuid NOT NULL REFERENCES public.receivings(id) ON DELETE CASCADE,
  installment         int NOT NULL DEFAULT 1,
  due_date            date NOT NULL,
  amount              numeric(15,2) NOT NULL,
  payment_method_id   uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_receiving_payments_receiving ON public.receiving_payments(receiving_id);

-- ===========================================
-- 5. TABELA: ap_payables (contas a pagar)
-- ===========================================

CREATE TABLE public.ap_payables (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  supplier_id         uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,

  -- Referência ao recebimento (quando gerado por NF)
  receiving_id        uuid REFERENCES public.receivings(id) ON DELETE SET NULL,

  status              public.payable_status NOT NULL DEFAULT 'pending',
  description         text NOT NULL,
  amount              numeric(15,2) NOT NULL,
  paid_amount         numeric(15,2) NOT NULL DEFAULT 0,
  due_date            date NOT NULL,
  paid_at             timestamptz,

  payment_method_id   uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  finance_category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  cost_center_id      uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,

  -- Referência ao pagamento real (bank_transaction — será criada na FASE 5)
  bank_transaction_id uuid,

  installment         int DEFAULT 1,
  total_installments  int DEFAULT 1,

  notes               text,
  source_type         public.source_type NOT NULL DEFAULT 'user',
  source_id           text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ap_org_status ON public.ap_payables(org_id, status);
CREATE INDEX idx_ap_org_due ON public.ap_payables(org_id, due_date);
CREATE INDEX idx_ap_store_status ON public.ap_payables(store_id, status);
CREATE INDEX idx_ap_supplier ON public.ap_payables(supplier_id);
CREATE INDEX idx_ap_receiving ON public.ap_payables(receiving_id) WHERE receiving_id IS NOT NULL;

CREATE TRIGGER trg_ap_payables_updated_at BEFORE UPDATE ON public.ap_payables
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 6. RLS
-- ===========================================

ALTER TABLE public.receivings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_payables ENABLE ROW LEVEL SECURITY;

-- receivings
CREATE POLICY "receivings_select" ON public.receivings FOR SELECT
  USING (org_id = public.get_my_org_id());

CREATE POLICY "receivings_insert" ON public.receivings FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "receivings_update" ON public.receivings FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- receiving_items
CREATE POLICY "receiving_items_select" ON public.receiving_items FOR SELECT
  USING (org_id = public.get_my_org_id());

CREATE POLICY "receiving_items_insert" ON public.receiving_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "receiving_items_update" ON public.receiving_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "receiving_items_delete" ON public.receiving_items FOR DELETE
  USING (org_id = public.get_my_org_id());

-- receiving_payments
CREATE POLICY "receiving_payments_select" ON public.receiving_payments FOR SELECT
  USING (org_id = public.get_my_org_id());

CREATE POLICY "receiving_payments_insert" ON public.receiving_payments FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "receiving_payments_update" ON public.receiving_payments FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "receiving_payments_delete" ON public.receiving_payments FOR DELETE
  USING (org_id = public.get_my_org_id());

-- ap_payables
CREATE POLICY "ap_select" ON public.ap_payables FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

CREATE POLICY "ap_insert" ON public.ap_payables FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ap_update" ON public.ap_payables FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- ===========================================
-- 7. FUNÇÃO ATÔMICA: fn_confirm_receiving
-- Transacional + Idempotente
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_confirm_receiving(p_receiving_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec         receivings%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_pending_ct  int;
  v_items_ct    int;
  v_payments_ct int;
  v_inv_ct      int;
  v_ap_ct       int;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  -- 1. Lock receiving para evitar race condition
  SELECT * INTO v_rec
  FROM receivings
  WHERE id = p_receiving_id
  FOR UPDATE;

  IF v_rec IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado: %', p_receiving_id;
  END IF;

  IF v_rec.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- 2. IDEMPOTÊNCIA: se já confirmado, retorna sucesso sem duplicar
  IF v_rec.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Recebimento já confirmado anteriormente',
      'receiving_id', p_receiving_id
    );
  END IF;

  IF v_rec.status != 'draft' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser confirmados. Status atual: %', v_rec.status;
  END IF;

  -- 3. Validações
  SELECT count(*) INTO v_items_ct FROM receiving_items WHERE receiving_id = p_receiving_id;
  IF v_items_ct = 0 THEN
    RAISE EXCEPTION 'Recebimento não possui itens';
  END IF;

  SELECT count(*) INTO v_pending_ct
  FROM receiving_items
  WHERE receiving_id = p_receiving_id AND matched_status = 'pending';
  IF v_pending_ct > 0 THEN
    RAISE EXCEPTION 'Existem % item(ns) pendente(s) de resolução', v_pending_ct;
  END IF;

  SELECT count(*) INTO v_payments_ct FROM receiving_payments WHERE receiving_id = p_receiving_id;
  IF v_payments_ct = 0 THEN
    RAISE EXCEPTION 'Plano de pagamento não definido';
  END IF;

  -- 4. Atualizar status do recebimento
  UPDATE receivings
  SET status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = v_user_id,
      updated_at = now()
  WHERE id = p_receiving_id;

  -- 5. Gerar inventory_moves IN para cada item matched/created
  INSERT INTO inventory_moves (
    org_id, store_id, item_id, move_type, quantity, unit_cost,
    reference_type, reference_id, source_type, source_id, created_by
  )
  SELECT
    v_rec.org_id,
    v_rec.store_id,
    ri.item_id,
    'IN',
    ri.quantity,
    ri.unit_cost,
    'receiving',
    v_rec.id,
    'system',
    v_rec.id::text,
    v_user_id
  FROM receiving_items ri
  WHERE ri.receiving_id = p_receiving_id
    AND ri.matched_status IN ('matched', 'created')
    AND ri.item_id IS NOT NULL
    AND ri.quantity > 0;

  GET DIAGNOSTICS v_inv_ct = ROW_COUNT;

  -- 6. Gerar AP na loja faturada (billed_store_id) para cada parcela
  INSERT INTO ap_payables (
    org_id, store_id, supplier_id, receiving_id,
    status, description, amount, due_date,
    payment_method_id, installment, total_installments,
    source_type, source_id, created_by
  )
  SELECT
    v_rec.org_id,
    v_rec.billed_store_id,
    v_rec.supplier_id,
    v_rec.id,
    'pending',
    'NF ' || COALESCE(v_rec.invoice_number, 'S/N') ||
      CASE WHEN v_payments_ct > 1
        THEN ' - Parcela ' || rp.installment || '/' || v_payments_ct
        ELSE ''
      END,
    rp.amount,
    rp.due_date,
    rp.payment_method_id,
    rp.installment,
    v_payments_ct,
    'system',
    v_rec.id::text,
    v_user_id
  FROM receiving_payments rp
  WHERE rp.receiving_id = p_receiving_id
  ORDER BY rp.installment;

  GET DIAGNOSTICS v_ap_ct = ROW_COUNT;

  -- 7. Audit log
  PERFORM fn_audit_log(
    v_rec.org_id,
    v_rec.store_id,
    v_user_id,
    'confirm_receiving',
    'receivings',
    p_receiving_id,
    NULL,
    jsonb_build_object(
      'status', 'confirmed',
      'store_id', v_rec.store_id,
      'billed_store_id', v_rec.billed_store_id,
      'supplier_id', v_rec.supplier_id,
      'total_amount', v_rec.total_amount,
      'inventory_moves_created', v_inv_ct,
      'ap_payables_created', v_ap_ct
    ),
    'system',
    v_rec.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'receiving_id', p_receiving_id,
    'inventory_moves_created', v_inv_ct,
    'ap_payables_created', v_ap_ct,
    'message', 'Recebimento confirmado com sucesso'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_receiving IS
  'Confirma recebimento de NF atomicamente: status + inventory IN + AP + audit. Idempotente.';

-- ===========================================
-- 8. FUNÇÃO: fn_cancel_receiving_draft
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_cancel_receiving_draft(p_receiving_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec     receivings%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_rec FROM receivings WHERE id = p_receiving_id FOR UPDATE;

  IF v_rec IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;
  IF v_rec.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_rec.status != 'draft' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser cancelados. Status: %', v_rec.status;
  END IF;

  UPDATE receivings
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id,
      updated_at = now()
  WHERE id = p_receiving_id;

  PERFORM fn_audit_log(
    v_rec.org_id, v_rec.store_id, v_user_id,
    'cancel_receiving_draft', 'receivings', p_receiving_id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'cancelled'),
    'user', NULL
  );

  RETURN jsonb_build_object('success', true, 'receiving_id', p_receiving_id);
END;
$$;

-- ===========================================
-- 9. FUNÇÃO: fn_validate_receiving_draft
-- Retorna lista de problemas (vazia = válido)
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_validate_receiving_draft(p_receiving_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec         receivings%ROWTYPE;
  v_issues      jsonb := '[]'::jsonb;
  v_pending_ct  int;
  v_items_ct    int;
  v_payments_ct int;
  v_pay_total   numeric;
BEGIN
  SELECT * INTO v_rec FROM receivings WHERE id = p_receiving_id;

  IF v_rec IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'issues', '["Recebimento não encontrado"]'::jsonb);
  END IF;

  IF v_rec.status != 'draft' THEN
    RETURN jsonb_build_object('valid', false, 'issues', '["Recebimento não está em rascunho"]'::jsonb);
  END IF;

  -- Itens
  SELECT count(*) INTO v_items_ct FROM receiving_items WHERE receiving_id = p_receiving_id;
  IF v_items_ct = 0 THEN
    v_issues := v_issues || '"Nenhum item no recebimento"'::jsonb;
  END IF;

  SELECT count(*) INTO v_pending_ct FROM receiving_items
  WHERE receiving_id = p_receiving_id AND matched_status = 'pending';
  IF v_pending_ct > 0 THEN
    v_issues := v_issues || ('"' || v_pending_ct || ' item(ns) pendente(s) de resolução"')::jsonb;
  END IF;

  -- Fornecedor
  IF v_rec.supplier_id IS NULL THEN
    v_issues := v_issues || '"Fornecedor não informado"'::jsonb;
  END IF;

  -- Plano de pagamento
  SELECT count(*), COALESCE(sum(amount), 0) INTO v_payments_ct, v_pay_total
  FROM receiving_payments WHERE receiving_id = p_receiving_id;

  IF v_payments_ct = 0 THEN
    v_issues := v_issues || '"Plano de pagamento não definido"'::jsonb;
  ELSIF abs(v_pay_total - v_rec.total_amount) > 0.01 THEN
    v_issues := v_issues || ('"Soma das parcelas (' || v_pay_total || ') difere do total (' || v_rec.total_amount || ')"')::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'valid', jsonb_array_length(v_issues) = 0,
    'issues', v_issues
  );
END;
$$;

-- ===========================================
-- VERIFICAÇÃO
-- ===========================================
DO $$
DECLARE t_count int;
BEGIN
  SELECT count(*) INTO t_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  RAISE NOTICE 'Total de tabelas: % (esperado: 26)', t_count;
END $$;
