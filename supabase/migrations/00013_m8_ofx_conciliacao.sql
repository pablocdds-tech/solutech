-- =============================================
-- Vitaliano ERP — Migração 00013
-- FASE 8: OFX/Conciliação (M9)
--
-- CONTRATOS DO ACTION CATALOG:
-- bank.ofx_upload_document
-- bank.ofx_import_parse (staging idempotente por fitid/hash)
-- bank.ofx_detect_matches (sugere, não aplica)
-- bank.reconcile_apply_match (link OU create; opcional baixa AP/AR)
-- bank.reconcile_apply_split (pagamento em lote; soma allocations = linha)
-- bank.reconcile_mark_ignored
-- bank.reconcile_unmatch (rollback controlado)
--
-- INVARIANTES:
-- - OFX: unique por (bank_account_id, fitid) ou hash_key
-- - Reprocessar batch não duplica: staging idempotente
-- - Unmatch reversível com auditoria
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.ofx_import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ofx_line_status AS ENUM ('pending', 'matched', 'split', 'ignored', 'created');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: ofx_imports (batches de importação)
-- ===========================================

CREATE TABLE public.ofx_imports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  bank_account_id   uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,

  status            public.ofx_import_status NOT NULL DEFAULT 'pending',
  file_name         text NOT NULL,
  document_id       uuid REFERENCES public.documents(id) ON DELETE SET NULL,

  total_lines       int NOT NULL DEFAULT 0,
  matched_lines     int NOT NULL DEFAULT 0,
  ignored_lines     int NOT NULL DEFAULT 0,
  pending_lines     int NOT NULL DEFAULT 0,

  period_start      date,
  period_end        date,
  imported_at       timestamptz,
  notes             text,

  source_type       public.source_type NOT NULL DEFAULT 'import',
  source_id         text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ofx_imp_org ON public.ofx_imports(org_id);
CREATE INDEX idx_ofx_imp_account ON public.ofx_imports(bank_account_id);
CREATE INDEX idx_ofx_imp_status ON public.ofx_imports(org_id, status);

CREATE TRIGGER trg_ofx_imp_updated_at BEFORE UPDATE ON public.ofx_imports
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: ofx_lines (linhas do extrato OFX)
-- Unique por (bank_account_id, fitid) ou (bank_account_id, hash_key)
-- ===========================================

CREATE TABLE public.ofx_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  ofx_import_id     uuid NOT NULL REFERENCES public.ofx_imports(id) ON DELETE CASCADE,
  bank_account_id   uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,

  fitid             text,
  hash_key          text,
  transaction_date  date NOT NULL,
  amount            numeric(15,2) NOT NULL,
  description       text,
  memo              text,
  type_code         text,

  status            public.ofx_line_status NOT NULL DEFAULT 'pending',
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,

  raw_data          jsonb,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Anti-duplicidade: unique por fitid
CREATE UNIQUE INDEX idx_ofx_line_fitid
  ON public.ofx_lines(bank_account_id, fitid)
  WHERE fitid IS NOT NULL;

-- Anti-duplicidade: unique por hash_key (fallback)
CREATE UNIQUE INDEX idx_ofx_line_hash
  ON public.ofx_lines(bank_account_id, hash_key)
  WHERE hash_key IS NOT NULL AND fitid IS NULL;

CREATE INDEX idx_ofx_line_import ON public.ofx_lines(ofx_import_id);
CREATE INDEX idx_ofx_line_status ON public.ofx_lines(ofx_import_id, status);
CREATE INDEX idx_ofx_line_date ON public.ofx_lines(bank_account_id, transaction_date);

CREATE TRIGGER trg_ofx_line_updated_at BEFORE UPDATE ON public.ofx_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: reconciliation_matches (log de conciliações)
-- Rastreabilidade + reversibilidade
-- ===========================================

CREATE TABLE public.reconciliation_matches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  ofx_line_id         uuid NOT NULL REFERENCES public.ofx_lines(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  ap_payable_id       uuid REFERENCES public.ap_payables(id) ON DELETE SET NULL,
  ar_receivable_id    uuid REFERENCES public.ar_receivables(id) ON DELETE SET NULL,

  match_type          text NOT NULL CHECK (match_type IN ('link', 'create', 'split', 'ignore')),
  amount              numeric(15,2) NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,

  matched_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at          timestamptz NOT NULL DEFAULT now(),
  unmatched_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  unmatched_at        timestamptz,
  unmatch_reason      text,

  source_type         public.source_type NOT NULL DEFAULT 'user',
  source_id           text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rm_ofx_line ON public.reconciliation_matches(ofx_line_id);
CREATE INDEX idx_rm_bank_tx ON public.reconciliation_matches(bank_transaction_id);
CREATE INDEX idx_rm_org ON public.reconciliation_matches(org_id, is_active);

-- ===========================================
-- 5. RLS
-- ===========================================

ALTER TABLE public.ofx_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofx_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ofx_imp_select" ON public.ofx_imports FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ofx_imp_insert" ON public.ofx_imports FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ofx_imp_update" ON public.ofx_imports FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "ofx_line_select" ON public.ofx_lines FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ofx_line_insert" ON public.ofx_lines FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ofx_line_update" ON public.ofx_lines FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "rm_select" ON public.reconciliation_matches FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "rm_insert" ON public.reconciliation_matches FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "rm_update" ON public.reconciliation_matches FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- ===========================================
-- 6. FUNÇÃO: fn_ofx_import_parse
-- Insere linhas em staging idempotente por fitid/hash
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_ofx_import_parse(
  p_import_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import      ofx_imports%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_line        jsonb;
  v_inserted    int := 0;
  v_skipped     int := 0;
  v_total       int := 0;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_import FROM ofx_imports WHERE id = p_import_id FOR UPDATE;

  IF v_import IS NULL THEN
    RAISE EXCEPTION 'Importação OFX não encontrada';
  END IF;
  IF v_import.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_total := jsonb_array_length(p_lines);

  FOR i IN 0 .. v_total - 1 LOOP
    v_line := p_lines->i;

    BEGIN
      INSERT INTO ofx_lines (
        org_id, ofx_import_id, bank_account_id,
        fitid, hash_key, transaction_date, amount,
        description, memo, type_code, raw_data
      ) VALUES (
        v_org_id, p_import_id, v_import.bank_account_id,
        v_line->>'fitid',
        v_line->>'hash_key',
        (v_line->>'transaction_date')::date,
        (v_line->>'amount')::numeric,
        v_line->>'description',
        v_line->>'memo',
        v_line->>'type_code',
        v_line
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  -- Atualizar contadores do import
  UPDATE ofx_imports
  SET status = 'completed',
      total_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id),
      pending_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status = 'pending'),
      matched_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status IN ('matched', 'split', 'created')),
      ignored_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status = 'ignored'),
      imported_at = now(),
      updated_at = now()
  WHERE id = p_import_id;

  PERFORM fn_audit_log(
    v_org_id, v_import.store_id, v_user_id,
    'ofx_import_parse', 'ofx_imports', p_import_id,
    NULL,
    jsonb_build_object(
      'total_sent', v_total,
      'inserted', v_inserted,
      'skipped_duplicates', v_skipped
    ),
    'import', p_import_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'import_id', p_import_id,
    'total_sent', v_total,
    'inserted', v_inserted,
    'skipped_duplicates', v_skipped,
    'message', 'Importação OFX processada com idempotência'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_ofx_import_parse IS
  'Parse OFX: insere linhas em staging. Idempotente por fitid/hash_key. Duplicatas são ignoradas.';

-- ===========================================
-- 7. FUNÇÃO: fn_reconcile_apply_match
-- Link OU create bank_tx + opcional baixa AP/AR
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_reconcile_apply_match(
  p_ofx_line_id uuid,
  p_bank_transaction_id uuid DEFAULT NULL,
  p_ap_payable_id uuid DEFAULT NULL,
  p_ar_receivable_id uuid DEFAULT NULL,
  p_create_bank_tx boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line        ofx_lines%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_bank_tx_id  uuid;
  v_match_type  text;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_line FROM ofx_lines WHERE id = p_ofx_line_id FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Linha OFX não encontrada';
  END IF;
  IF v_line.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_line.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'Linha já conciliada ou ignorada. Status: %', v_line.status;
  END IF;

  -- Determinar tipo: link existente ou criar nova
  IF p_create_bank_tx THEN
    -- Criar bank_transaction a partir da linha OFX
    INSERT INTO bank_transactions (
      org_id, store_id, bank_account_id, type, amount, description,
      transaction_date, reference_type, reference_id,
      source_type, source_id, created_by
    )
    SELECT
      v_org_id, imp.store_id, v_line.bank_account_id,
      CASE WHEN v_line.amount >= 0 THEN 'credit' ELSE 'debit' END,
      ABS(v_line.amount),
      COALESCE(v_line.description, v_line.memo, 'OFX import'),
      v_line.transaction_date, 'ofx_import', v_line.ofx_import_id,
      'import', v_line.id::text, v_user_id
    FROM ofx_imports imp WHERE imp.id = v_line.ofx_import_id
    RETURNING id INTO v_bank_tx_id;

    v_match_type := 'create';
  ELSE
    v_bank_tx_id := p_bank_transaction_id;
    v_match_type := 'link';

    IF v_bank_tx_id IS NULL THEN
      RAISE EXCEPTION 'bank_transaction_id obrigatório para link';
    END IF;
  END IF;

  -- Atualizar linha OFX
  UPDATE ofx_lines
  SET status = 'matched',
      bank_transaction_id = v_bank_tx_id,
      updated_at = now()
  WHERE id = p_ofx_line_id;

  -- Registrar match
  INSERT INTO reconciliation_matches (
    org_id, ofx_line_id, bank_transaction_id,
    ap_payable_id, ar_receivable_id,
    match_type, amount, matched_by, source_type, source_id
  ) VALUES (
    v_org_id, p_ofx_line_id, v_bank_tx_id,
    p_ap_payable_id, p_ar_receivable_id,
    v_match_type, ABS(v_line.amount), v_user_id,
    'user', v_user_id::text
  );

  -- Baixar AP se informado
  IF p_ap_payable_id IS NOT NULL THEN
    UPDATE ap_payables
    SET status = 'paid',
        paid_amount = amount,
        paid_at = now(),
        bank_transaction_id = v_bank_tx_id,
        updated_at = now()
    WHERE id = p_ap_payable_id AND org_id = v_org_id;
  END IF;

  -- Baixar AR se informado
  IF p_ar_receivable_id IS NOT NULL THEN
    UPDATE ar_receivables
    SET status = 'received',
        received_amount = amount,
        received_at = now(),
        bank_transaction_id = v_bank_tx_id,
        updated_at = now()
    WHERE id = p_ar_receivable_id AND org_id = v_org_id;
  END IF;

  -- Atualizar contadores do import
  PERFORM fn_update_ofx_import_counts(v_line.ofx_import_id);

  -- Audit
  PERFORM fn_audit_log(
    v_org_id, NULL, v_user_id,
    'reconcile_apply_match', 'reconciliation_matches', p_ofx_line_id,
    NULL,
    jsonb_build_object(
      'match_type', v_match_type,
      'bank_transaction_id', v_bank_tx_id,
      'ap_payable_id', p_ap_payable_id,
      'ar_receivable_id', p_ar_receivable_id,
      'amount', v_line.amount
    ),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'match_type', v_match_type,
    'bank_transaction_id', v_bank_tx_id,
    'message', 'Conciliação aplicada'
  );
END;
$$;

-- ===========================================
-- 8. FUNÇÃO: fn_reconcile_apply_split
-- Pagamento em lote: soma allocations = linha OFX
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_reconcile_apply_split(
  p_ofx_line_id uuid,
  p_allocations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line        ofx_lines%ROWTYPE;
  v_user_id     uuid;
  v_org_id      uuid;
  v_alloc       jsonb;
  v_total_alloc numeric := 0;
  v_count       int := 0;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_line FROM ofx_lines WHERE id = p_ofx_line_id FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Linha OFX não encontrada';
  END IF;
  IF v_line.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_line.status != 'pending' THEN
    RAISE EXCEPTION 'Linha já conciliada. Status: %', v_line.status;
  END IF;

  -- Validar soma
  FOR i IN 0 .. jsonb_array_length(p_allocations) - 1 LOOP
    v_alloc := p_allocations->i;
    v_total_alloc := v_total_alloc + ABS((v_alloc->>'amount')::numeric);
  END LOOP;

  IF ABS(v_total_alloc - ABS(v_line.amount)) > 0.01 THEN
    RAISE EXCEPTION 'Soma das alocações (%) difere do valor da linha OFX (%)',
      v_total_alloc, ABS(v_line.amount);
  END IF;

  -- Processar cada alocação
  FOR i IN 0 .. jsonb_array_length(p_allocations) - 1 LOOP
    v_alloc := p_allocations->i;

    INSERT INTO reconciliation_matches (
      org_id, ofx_line_id, bank_transaction_id,
      ap_payable_id, ar_receivable_id,
      match_type, amount, matched_by, source_type, source_id
    ) VALUES (
      v_org_id, p_ofx_line_id,
      (v_alloc->>'bank_transaction_id')::uuid,
      (v_alloc->>'ap_payable_id')::uuid,
      (v_alloc->>'ar_receivable_id')::uuid,
      'split',
      ABS((v_alloc->>'amount')::numeric),
      v_user_id, 'user', v_user_id::text
    );

    -- Baixar AP se informado
    IF v_alloc->>'ap_payable_id' IS NOT NULL THEN
      UPDATE ap_payables
      SET status = 'paid',
          paid_amount = amount,
          paid_at = now(),
          bank_transaction_id = (v_alloc->>'bank_transaction_id')::uuid,
          updated_at = now()
      WHERE id = (v_alloc->>'ap_payable_id')::uuid AND org_id = v_org_id;
    END IF;

    -- Baixar AR se informado
    IF v_alloc->>'ar_receivable_id' IS NOT NULL THEN
      UPDATE ar_receivables
      SET status = 'received',
          received_amount = amount,
          received_at = now(),
          bank_transaction_id = (v_alloc->>'bank_transaction_id')::uuid,
          updated_at = now()
      WHERE id = (v_alloc->>'ar_receivable_id')::uuid AND org_id = v_org_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- Atualizar linha OFX
  UPDATE ofx_lines
  SET status = 'split',
      updated_at = now()
  WHERE id = p_ofx_line_id;

  PERFORM fn_update_ofx_import_counts(v_line.ofx_import_id);

  PERFORM fn_audit_log(
    v_org_id, NULL, v_user_id,
    'reconcile_apply_split', 'reconciliation_matches', p_ofx_line_id,
    NULL,
    jsonb_build_object('allocations', v_count, 'total', v_total_alloc),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'allocations', v_count,
    'total', v_total_alloc,
    'message', 'Split aplicado com sucesso'
  );
END;
$$;

-- ===========================================
-- 9. FUNÇÃO: fn_reconcile_mark_ignored
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_reconcile_mark_ignored(
  p_ofx_line_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line    ofx_lines%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_line FROM ofx_lines WHERE id = p_ofx_line_id FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Linha OFX não encontrada';
  END IF;
  IF v_line.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_line.status != 'pending' THEN
    RAISE EXCEPTION 'Linha já conciliada. Status: %', v_line.status;
  END IF;

  UPDATE ofx_lines
  SET status = 'ignored',
      notes = COALESCE(p_reason, notes),
      updated_at = now()
  WHERE id = p_ofx_line_id;

  INSERT INTO reconciliation_matches (
    org_id, ofx_line_id, match_type, amount,
    matched_by, source_type, source_id
  ) VALUES (
    v_org_id, p_ofx_line_id, 'ignore', ABS(v_line.amount),
    v_user_id, 'user', v_user_id::text
  );

  PERFORM fn_update_ofx_import_counts(v_line.ofx_import_id);

  PERFORM fn_audit_log(
    v_org_id, NULL, v_user_id,
    'reconcile_mark_ignored', 'ofx_lines', p_ofx_line_id,
    NULL,
    jsonb_build_object('reason', p_reason, 'amount', v_line.amount),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Linha marcada como ignorada');
END;
$$;

-- ===========================================
-- 10. FUNÇÃO: fn_reconcile_unmatch (rollback controlado)
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_reconcile_unmatch(
  p_ofx_line_id uuid,
  p_reason text DEFAULT 'Desconciliação manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line    ofx_lines%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
  v_match   RECORD;
  v_count   int := 0;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_line FROM ofx_lines WHERE id = p_ofx_line_id FOR UPDATE;

  IF v_line IS NULL THEN
    RAISE EXCEPTION 'Linha OFX não encontrada';
  END IF;
  IF v_line.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_line.status = 'pending' THEN
    RAISE EXCEPTION 'Linha não está conciliada';
  END IF;

  -- Desativar matches ativos
  FOR v_match IN
    SELECT * FROM reconciliation_matches
    WHERE ofx_line_id = p_ofx_line_id AND is_active = true
    FOR UPDATE
  LOOP
    UPDATE reconciliation_matches
    SET is_active = false,
        unmatched_by = v_user_id,
        unmatched_at = now(),
        unmatch_reason = p_reason
    WHERE id = v_match.id;

    -- Reverter AP se foi baixado
    IF v_match.ap_payable_id IS NOT NULL THEN
      UPDATE ap_payables
      SET status = 'pending',
          paid_amount = 0,
          paid_at = NULL,
          bank_transaction_id = NULL,
          updated_at = now()
      WHERE id = v_match.ap_payable_id AND org_id = v_org_id;
    END IF;

    -- Reverter AR se foi baixado
    IF v_match.ar_receivable_id IS NOT NULL THEN
      UPDATE ar_receivables
      SET status = 'pending',
          received_amount = 0,
          received_at = NULL,
          bank_transaction_id = NULL,
          updated_at = now()
      WHERE id = v_match.ar_receivable_id AND org_id = v_org_id;
    END IF;

    -- Se bank_tx foi criado pelo match (type='create'), deletar
    IF v_match.match_type = 'create' AND v_match.bank_transaction_id IS NOT NULL THEN
      DELETE FROM bank_transactions WHERE id = v_match.bank_transaction_id AND org_id = v_org_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- Voltar linha OFX para pending
  UPDATE ofx_lines
  SET status = 'pending',
      bank_transaction_id = NULL,
      updated_at = now()
  WHERE id = p_ofx_line_id;

  PERFORM fn_update_ofx_import_counts(v_line.ofx_import_id);

  PERFORM fn_audit_log(
    v_org_id, NULL, v_user_id,
    'reconcile_unmatch', 'ofx_lines', p_ofx_line_id,
    NULL,
    jsonb_build_object('reason', p_reason, 'matches_reverted', v_count),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'matches_reverted', v_count,
    'message', 'Desconciliação aplicada com rollback controlado'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_reconcile_unmatch IS
  'Desconcilia linha OFX: reverte matches, AP, AR, bank_tx criados. Auditado.';

-- ===========================================
-- 11. HELPER: fn_update_ofx_import_counts
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_update_ofx_import_counts(p_import_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ofx_imports
  SET total_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id),
      pending_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status = 'pending'),
      matched_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status IN ('matched', 'split', 'created')),
      ignored_lines = (SELECT count(*) FROM ofx_lines WHERE ofx_import_id = p_import_id AND status = 'ignored'),
      updated_at = now()
  WHERE id = p_import_id;
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
  RAISE NOTICE 'Tabelas: % (esperado: 39) | Views: % (esperado: 4)', t_count, v_count;
END $$;
