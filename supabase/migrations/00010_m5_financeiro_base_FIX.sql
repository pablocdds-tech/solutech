-- =============================================
-- Vitaliano ERP — Migração 00010 (CORRIGIDA)
-- FASE 5: Financeiro base (M5)
--
-- FIX: receivable_status já existe da FASE 1.
-- Adicionamos 'cancelled' ao enum existente e criamos
-- apenas os novos tipos.
-- =============================================

-- ===========================================
-- 1. ENUMS (com tratamento de existência)
-- ===========================================

-- bank_tx_type é novo
DO $$ BEGIN
  CREATE TYPE public.bank_tx_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- receivable_status já existe com (pending, partial, received, overdue)
-- Adicionamos 'cancelled' se não existir
DO $$ BEGIN
  ALTER TYPE public.receivable_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- cash_session_status é novo
DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: bank_transactions (SSOT do saldo bancário real)
-- ===========================================

CREATE TABLE public.bank_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  bank_account_id     uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,

  type                public.bank_tx_type NOT NULL,
  amount              numeric(15,2) NOT NULL CHECK (amount > 0),
  description         text NOT NULL,
  transaction_date    date NOT NULL DEFAULT CURRENT_DATE,

  fitid               text,
  hash_key            text,
  reconciled          boolean NOT NULL DEFAULT false,
  reconciled_at       timestamptz,

  reference_type      text,
  reference_id        uuid,

  notes               text,
  source_type         public.source_type NOT NULL DEFAULT 'user',
  source_id           text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_bank_tx_fitid
  ON public.bank_transactions(bank_account_id, fitid)
  WHERE fitid IS NOT NULL;

CREATE UNIQUE INDEX uq_bank_tx_hash
  ON public.bank_transactions(bank_account_id, hash_key)
  WHERE hash_key IS NOT NULL;

CREATE INDEX idx_bank_tx_org_account ON public.bank_transactions(org_id, bank_account_id);
CREATE INDEX idx_bank_tx_org_date ON public.bank_transactions(org_id, transaction_date DESC);
CREATE INDEX idx_bank_tx_store ON public.bank_transactions(store_id);
CREATE INDEX idx_bank_tx_reference ON public.bank_transactions(reference_type, reference_id);
CREATE INDEX idx_bank_tx_reconciled ON public.bank_transactions(bank_account_id, reconciled);

CREATE TRIGGER trg_bank_tx_updated_at BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

COMMENT ON TABLE public.bank_transactions IS
  'SSOT do saldo bancário real. Saldo = SUM(credit) - SUM(debit). Nunca editável diretamente.';

-- ===========================================
-- 3. TABELA: ar_receivables (contas a receber)
-- ===========================================

CREATE TABLE public.ar_receivables (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  status              public.receivable_status NOT NULL DEFAULT 'pending',
  description         text NOT NULL,
  amount              numeric(15,2) NOT NULL CHECK (amount > 0),
  received_amount     numeric(15,2) NOT NULL DEFAULT 0,
  due_date            date NOT NULL,
  received_at         timestamptz,

  sales_channel_id    uuid REFERENCES public.sales_channels(id) ON DELETE SET NULL,
  payment_method_id   uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  finance_category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  cost_center_id      uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,

  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  cash_session_id     uuid,

  reference_type      text,
  reference_id        uuid,

  installment         int DEFAULT 1,
  total_installments  int DEFAULT 1,

  notes               text,
  source_type         public.source_type NOT NULL DEFAULT 'user',
  source_id           text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_org_status ON public.ar_receivables(org_id, status);
CREATE INDEX idx_ar_org_due ON public.ar_receivables(org_id, due_date);
CREATE INDEX idx_ar_store_status ON public.ar_receivables(store_id, status);
CREATE INDEX idx_ar_reference ON public.ar_receivables(reference_type, reference_id);

CREATE TRIGGER trg_ar_receivables_updated_at BEFORE UPDATE ON public.ar_receivables
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: cash_sessions (sessões de caixa)
-- ===========================================

CREATE TABLE public.cash_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  status              public.cash_session_status NOT NULL DEFAULT 'open',
  opening_balance     numeric(15,2) NOT NULL DEFAULT 0,
  closing_balance     numeric(15,2),
  expected_balance    numeric(15,2),
  difference          numeric(15,2),

  opened_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at           timestamptz NOT NULL DEFAULT now(),
  closed_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at           timestamptz,

  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_cash_session_open
  ON public.cash_sessions(store_id)
  WHERE status = 'open';

CREATE INDEX idx_cash_sessions_org_store ON public.cash_sessions(org_id, store_id);
CREATE INDEX idx_cash_sessions_status ON public.cash_sessions(org_id, status);

CREATE TRIGGER trg_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Adicionar FK cash_session_id em ar_receivables
ALTER TABLE public.ar_receivables
  ADD CONSTRAINT fk_ar_cash_session FOREIGN KEY (cash_session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

-- ===========================================
-- 5. RLS
-- ===========================================

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_tx_select" ON public.bank_transactions FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

CREATE POLICY "bank_tx_insert" ON public.bank_transactions FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "bank_tx_update" ON public.bank_transactions FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ar_select" ON public.ar_receivables FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

CREATE POLICY "ar_insert" ON public.ar_receivables FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ar_update" ON public.ar_receivables FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "cash_select" ON public.cash_sessions FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

CREATE POLICY "cash_insert" ON public.cash_sessions FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "cash_update" ON public.cash_sessions FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- ===========================================
-- 6. VIEW: Saldo bancário por conta (SSOT)
-- ===========================================

CREATE VIEW public.v_bank_balance
WITH (security_invoker = true)
AS
SELECT
  bt.org_id,
  bt.store_id,
  s.name AS store_name,
  bt.bank_account_id,
  ba.name AS account_name,
  ba.bank_name,
  ba.account_type,
  SUM(CASE WHEN bt.type = 'credit' THEN bt.amount ELSE 0 END) AS total_credits,
  SUM(CASE WHEN bt.type = 'debit' THEN bt.amount ELSE 0 END) AS total_debits,
  SUM(CASE WHEN bt.type = 'credit' THEN bt.amount ELSE -bt.amount END) AS balance,
  COUNT(*) AS total_transactions,
  COUNT(*) FILTER (WHERE NOT bt.reconciled) AS pending_reconciliation,
  MAX(bt.transaction_date) AS last_transaction_date
FROM public.bank_transactions bt
JOIN public.bank_accounts ba ON ba.id = bt.bank_account_id
JOIN public.stores s ON s.id = bt.store_id
GROUP BY bt.org_id, bt.store_id, s.name, bt.bank_account_id, ba.name, ba.bank_name, ba.account_type;

COMMENT ON VIEW public.v_bank_balance IS
  'Saldo bancário derivado (SSOT). balance = SUM(credits) - SUM(debits).';

-- ===========================================
-- 7. FUNÇÃO ATÔMICA: fn_pay_ap
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_pay_ap(
  p_payable_id uuid,
  p_bank_account_id uuid,
  p_amount numeric,
  p_transaction_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap          ap_payables%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_bank_tx_id  uuid;
  v_new_paid    numeric;
  v_new_status  public.payable_status;
  v_ba          bank_accounts%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_ap FROM ap_payables WHERE id = p_payable_id FOR UPDATE;

  IF v_ap IS NULL THEN
    RAISE EXCEPTION 'Conta a pagar não encontrada';
  END IF;
  IF v_ap.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_ap.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Conta já está %', v_ap.status;
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento deve ser positivo';
  END IF;

  SELECT * INTO v_ba FROM bank_accounts WHERE id = p_bank_account_id;
  IF v_ba IS NULL THEN
    RAISE EXCEPTION 'Conta bancária não encontrada';
  END IF;

  v_new_paid := v_ap.paid_amount + p_amount;
  IF v_new_paid > v_ap.amount THEN
    RAISE EXCEPTION 'Pagamento excede o valor da conta (% + % > %)',
      v_ap.paid_amount, p_amount, v_ap.amount;
  END IF;

  IF v_new_paid >= v_ap.amount THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  INSERT INTO bank_transactions (
    org_id, store_id, bank_account_id, type, amount, description,
    transaction_date, reference_type, reference_id,
    source_type, source_id, created_by
  ) VALUES (
    v_org_id, v_ap.store_id, p_bank_account_id, 'debit', p_amount,
    'Pagamento AP: ' || v_ap.description,
    p_transaction_date, 'ap_payable', v_ap.id,
    'system', v_ap.id::text, v_user_id
  ) RETURNING id INTO v_bank_tx_id;

  UPDATE ap_payables
  SET status = v_new_status,
      paid_amount = v_new_paid,
      paid_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
      bank_transaction_id = v_bank_tx_id,
      updated_at = now()
  WHERE id = p_payable_id;

  PERFORM fn_audit_log(
    v_org_id, v_ap.store_id, v_user_id,
    'pay_ap', 'ap_payables', p_payable_id,
    jsonb_build_object('status', v_ap.status, 'paid_amount', v_ap.paid_amount),
    jsonb_build_object('status', v_new_status, 'paid_amount', v_new_paid,
      'bank_transaction_id', v_bank_tx_id, 'payment_amount', p_amount),
    'system', v_bank_tx_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'payable_id', p_payable_id,
    'bank_transaction_id', v_bank_tx_id,
    'new_status', v_new_status,
    'paid_amount', v_new_paid
  );
END;
$$;

COMMENT ON FUNCTION public.fn_pay_ap IS
  'Baixa conta a pagar COM evidência bank_transaction. Atômica: bank_tx + AP update + audit.';

-- ===========================================
-- 8. FUNÇÃO ATÔMICA: fn_receive_ar
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_receive_ar(
  p_receivable_id uuid,
  p_bank_account_id uuid,
  p_amount numeric,
  p_transaction_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ar          ar_receivables%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_bank_tx_id  uuid;
  v_new_received numeric;
  v_new_status  public.receivable_status;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_ar FROM ar_receivables WHERE id = p_receivable_id FOR UPDATE;

  IF v_ar IS NULL THEN
    RAISE EXCEPTION 'Conta a receber não encontrada';
  END IF;
  IF v_ar.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_ar.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'Conta já está %', v_ar.status;
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  v_new_received := v_ar.received_amount + p_amount;
  IF v_new_received > v_ar.amount THEN
    RAISE EXCEPTION 'Recebimento excede o valor (% + % > %)',
      v_ar.received_amount, p_amount, v_ar.amount;
  END IF;

  IF v_new_received >= v_ar.amount THEN
    v_new_status := 'received';
  ELSE
    v_new_status := 'partial';
  END IF;

  INSERT INTO bank_transactions (
    org_id, store_id, bank_account_id, type, amount, description,
    transaction_date, reference_type, reference_id,
    source_type, source_id, created_by
  ) VALUES (
    v_org_id, v_ar.store_id, p_bank_account_id, 'credit', p_amount,
    'Recebimento AR: ' || v_ar.description,
    p_transaction_date, 'ar_receivable', v_ar.id,
    'system', v_ar.id::text, v_user_id
  ) RETURNING id INTO v_bank_tx_id;

  UPDATE ar_receivables
  SET status = v_new_status,
      received_amount = v_new_received,
      received_at = CASE WHEN v_new_status = 'received' THEN now() ELSE received_at END,
      bank_transaction_id = v_bank_tx_id,
      updated_at = now()
  WHERE id = p_receivable_id;

  PERFORM fn_audit_log(
    v_org_id, v_ar.store_id, v_user_id,
    'receive_ar', 'ar_receivables', p_receivable_id,
    jsonb_build_object('status', v_ar.status, 'received_amount', v_ar.received_amount),
    jsonb_build_object('status', v_new_status, 'received_amount', v_new_received,
      'bank_transaction_id', v_bank_tx_id, 'received_payment', p_amount),
    'system', v_bank_tx_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'receivable_id', p_receivable_id,
    'bank_transaction_id', v_bank_tx_id,
    'new_status', v_new_status,
    'received_amount', v_new_received
  );
END;
$$;

COMMENT ON FUNCTION public.fn_receive_ar IS
  'Baixa conta a receber COM evidência bank_transaction. Atômica: bank_tx + AR update + audit.';

-- ===========================================
-- 9. FUNÇÃO: fn_open_cash_session
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_open_cash_session(
  p_store_id uuid,
  p_opening_balance numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
  v_session_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  IF EXISTS (SELECT 1 FROM cash_sessions WHERE store_id = p_store_id AND status = 'open') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto para esta loja';
  END IF;

  INSERT INTO cash_sessions (org_id, store_id, opening_balance, opened_by)
  VALUES (v_org_id, p_store_id, p_opening_balance, v_user_id)
  RETURNING id INTO v_session_id;

  PERFORM fn_audit_log(
    v_org_id, p_store_id, v_user_id,
    'open_cash_session', 'cash_sessions', v_session_id,
    NULL,
    jsonb_build_object('opening_balance', p_opening_balance),
    'user', NULL
  );

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- ===========================================
-- 10. FUNÇÃO: fn_close_cash_session
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_close_cash_session(
  p_session_id uuid,
  p_closing_balance numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   cash_sessions%ROWTYPE;
  v_user_id   uuid;
  v_org_id    uuid;
  v_expected  numeric;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_session FROM cash_sessions WHERE id = p_session_id FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão de caixa não encontrada';
  END IF;
  IF v_session.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_session.status != 'open' THEN
    RAISE EXCEPTION 'Caixa já está fechado';
  END IF;

  v_expected := v_session.opening_balance;

  UPDATE cash_sessions
  SET status = 'closed',
      closing_balance = p_closing_balance,
      expected_balance = v_expected,
      difference = p_closing_balance - v_expected,
      closed_by = v_user_id,
      closed_at = now(),
      updated_at = now()
  WHERE id = p_session_id;

  PERFORM fn_audit_log(
    v_org_id, v_session.store_id, v_user_id,
    'close_cash_session', 'cash_sessions', p_session_id,
    jsonb_build_object('status', 'open', 'opening_balance', v_session.opening_balance),
    jsonb_build_object('status', 'closed', 'closing_balance', p_closing_balance,
      'expected', v_expected, 'difference', p_closing_balance - v_expected),
    'user', NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'closing_balance', p_closing_balance,
    'expected_balance', v_expected,
    'difference', p_closing_balance - v_expected
  );
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
  RAISE NOTICE 'Tabelas: % (esperado: 29) | Views: % (esperado: 3)', t_count, v_count;
END $$;
