-- =============================================
-- Vitaliano ERP — Migração 00008
-- FASE 3: Estoque base (M4) + Banco Virtual (M1)
--
-- INVARIANTES:
-- - Saldo de estoque = SUM(inventory_moves). Não existe saldo editável.
-- - Saldo virtual = SUM(virtual_ledger_entries). Não existe saldo editável.
-- - Ambas as tabelas são IMUTÁVEIS (sem UPDATE/DELETE).
-- - Toda alteração de saldo é via INSERT de novo movimento/lançamento.
-- =============================================

-- ===========================================
-- 1. MOVIMENTOS DE ESTOQUE (SSOT do estoque)
-- ===========================================

CREATE TABLE public.inventory_moves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  item_id         uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  move_type       public.inventory_move_type NOT NULL,
  quantity        numeric(15,4) NOT NULL,
  unit_cost       numeric(15,4) NOT NULL DEFAULT 0,
  total_cost      numeric(15,4) NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  reference_type  text,
  reference_id    uuid,
  reason_id       uuid REFERENCES public.adjustment_reasons(id) ON DELETE SET NULL,
  batch_id        uuid,
  notes           text,
  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- IN e OUT devem ter quantidade > 0; ADJUST pode ser + ou -
  CONSTRAINT inventory_moves_qty_check CHECK (
    (move_type IN ('IN', 'OUT') AND quantity > 0)
    OR (move_type = 'ADJUST')
  ),
  -- OUT deve ter quantidade positiva (será subtraída na view)
  CONSTRAINT inventory_moves_out_positive CHECK (
    move_type != 'OUT' OR quantity > 0
  )
);

-- Índices para consultas frequentes
CREATE INDEX idx_inv_moves_org_store_item ON public.inventory_moves(org_id, store_id, item_id);
CREATE INDEX idx_inv_moves_org_created ON public.inventory_moves(org_id, created_at DESC);
CREATE INDEX idx_inv_moves_reference ON public.inventory_moves(reference_type, reference_id);
CREATE INDEX idx_inv_moves_store_item ON public.inventory_moves(store_id, item_id);
CREATE INDEX idx_inv_moves_batch ON public.inventory_moves(batch_id) WHERE batch_id IS NOT NULL;

COMMENT ON TABLE public.inventory_moves IS
  'SSOT do estoque. IMUTÁVEL. Saldo = SUM(moves). Sem UPDATE/DELETE.';

-- ===========================================
-- 2. LANÇAMENTOS DO BANCO VIRTUAL (SSOT)
-- ===========================================

CREATE TABLE public.virtual_ledger_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  entry_type      public.virtual_ledger_type NOT NULL,
  amount          numeric(15,2) NOT NULL,
  description     text NOT NULL,
  reference_type  text,
  reference_id    uuid,
  notes           text,
  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- DEBIT e CREDIT devem ter valor > 0; ADJUST pode ser + ou -
  CONSTRAINT vle_amount_check CHECK (
    (entry_type IN ('DEBIT', 'CREDIT') AND amount > 0)
    OR (entry_type = 'ADJUST')
  )
);

CREATE INDEX idx_vle_org_store ON public.virtual_ledger_entries(org_id, store_id);
CREATE INDEX idx_vle_org_created ON public.virtual_ledger_entries(org_id, created_at DESC);
CREATE INDEX idx_vle_store_created ON public.virtual_ledger_entries(store_id, created_at DESC);
CREATE INDEX idx_vle_reference ON public.virtual_ledger_entries(reference_type, reference_id);

COMMENT ON TABLE public.virtual_ledger_entries IS
  'SSOT do banco virtual CD↔Lojas. IMUTÁVEL. Saldo = SUM(entries). Sem UPDATE/DELETE. '
  'DEBIT = loja deve ao CD. CREDIT = pagamento abate débito. ADJUST = correção admin.';

-- ===========================================
-- 3. RLS — IMUTÁVEL (SELECT + INSERT apenas)
-- ===========================================

ALTER TABLE public.inventory_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_ledger_entries ENABLE ROW LEVEL SECURITY;

-- inventory_moves: SELECT com store access
CREATE POLICY "inv_moves_select" ON public.inventory_moves FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

-- inventory_moves: INSERT apenas (via actions/RPCs)
CREATE POLICY "inv_moves_insert" ON public.inventory_moves FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

-- SEM UPDATE/DELETE em inventory_moves (imutável)

-- virtual_ledger_entries: SELECT com store access
CREATE POLICY "vle_select" ON public.virtual_ledger_entries FOR SELECT
  USING (org_id = public.get_my_org_id() AND public.has_store_access(store_id));

-- virtual_ledger_entries: INSERT apenas (via actions/RPCs)
CREATE POLICY "vle_insert" ON public.virtual_ledger_entries FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());

-- SEM UPDATE/DELETE em virtual_ledger_entries (imutável)

-- ===========================================
-- 4. VIEW: Saldo de estoque por loja/item
-- security_invoker = true para respeitar RLS do usuário
-- ===========================================

CREATE VIEW public.v_inventory_balance
WITH (security_invoker = true)
AS
SELECT
  im.org_id,
  im.store_id,
  s.name AS store_name,
  im.item_id,
  i.name AS item_name,
  i.type AS item_type,
  i.sku,
  u.abbreviation AS unit_abbr,
  -- Saldo: IN soma, OUT subtrai, ADJUST é delta direto
  SUM(
    CASE
      WHEN im.move_type = 'IN' THEN im.quantity
      WHEN im.move_type = 'OUT' THEN -im.quantity
      WHEN im.move_type = 'ADJUST' THEN im.quantity
    END
  ) AS balance,
  -- Custo total em estoque
  SUM(
    CASE
      WHEN im.move_type = 'IN' THEN im.total_cost
      WHEN im.move_type = 'OUT' THEN -im.total_cost
      WHEN im.move_type = 'ADJUST' THEN im.total_cost
    END
  ) AS total_cost_value,
  -- Custo médio ponderado
  CASE
    WHEN SUM(
      CASE
        WHEN im.move_type = 'IN' THEN im.quantity
        WHEN im.move_type = 'OUT' THEN -im.quantity
        WHEN im.move_type = 'ADJUST' THEN im.quantity
      END
    ) > 0
    THEN SUM(
      CASE
        WHEN im.move_type = 'IN' THEN im.total_cost
        WHEN im.move_type = 'OUT' THEN -im.total_cost
        WHEN im.move_type = 'ADJUST' THEN im.total_cost
      END
    ) / NULLIF(SUM(
      CASE
        WHEN im.move_type = 'IN' THEN im.quantity
        WHEN im.move_type = 'OUT' THEN -im.quantity
        WHEN im.move_type = 'ADJUST' THEN im.quantity
      END
    ), 0)
    ELSE 0
  END AS avg_unit_cost,
  -- Limites de estoque
  i.min_stock,
  i.max_stock,
  -- Último movimento
  MAX(im.created_at) AS last_move_at,
  COUNT(*) AS total_moves
FROM public.inventory_moves im
JOIN public.items i ON i.id = im.item_id
JOIN public.stores s ON s.id = im.store_id
LEFT JOIN public.units u ON u.id = i.default_unit_id
GROUP BY im.org_id, im.store_id, s.name, im.item_id, i.name, i.type, i.sku,
         u.abbreviation, i.min_stock, i.max_stock;

COMMENT ON VIEW public.v_inventory_balance IS
  'Saldo de estoque derivado (SSOT). balance = SUM(IN) - SUM(OUT) + SUM(ADJUST).';

-- ===========================================
-- 5. VIEW: Saldo do banco virtual por loja
-- ===========================================

CREATE VIEW public.v_virtual_ledger_balance
WITH (security_invoker = true)
AS
SELECT
  vle.org_id,
  vle.store_id,
  s.name AS store_name,
  s.type AS store_type,
  -- Saldo: DEBIT = loja deve, CREDIT = pago, ADJUST = correção
  SUM(
    CASE
      WHEN vle.entry_type = 'DEBIT' THEN vle.amount
      WHEN vle.entry_type = 'CREDIT' THEN -vle.amount
      WHEN vle.entry_type = 'ADJUST' THEN vle.amount
    END
  ) AS balance,
  -- Totais por tipo
  SUM(CASE WHEN vle.entry_type = 'DEBIT' THEN vle.amount ELSE 0 END) AS total_debits,
  SUM(CASE WHEN vle.entry_type = 'CREDIT' THEN vle.amount ELSE 0 END) AS total_credits,
  SUM(CASE WHEN vle.entry_type = 'ADJUST' THEN vle.amount ELSE 0 END) AS total_adjustments,
  COUNT(*) AS total_entries,
  MAX(vle.created_at) AS last_entry_at
FROM public.virtual_ledger_entries vle
JOIN public.stores s ON s.id = vle.store_id
GROUP BY vle.org_id, vle.store_id, s.name, s.type;

COMMENT ON VIEW public.v_virtual_ledger_balance IS
  'Saldo do banco virtual derivado. balance > 0 = loja deve ao CD. Saldo = DEBIT - CREDIT + ADJUST.';

-- ===========================================
-- 6. RPC: Extrato do banco virtual com paginação
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_virtual_ledger_statement(
  p_store_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  entry_type public.virtual_ledger_type,
  amount numeric,
  description text,
  reference_type text,
  notes text,
  created_by_name text,
  created_at timestamptz,
  running_balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH entries AS (
    SELECT
      vle.id,
      vle.entry_type,
      vle.amount,
      vle.description,
      vle.reference_type,
      vle.notes,
      p.full_name AS created_by_name,
      vle.created_at,
      SUM(
        CASE
          WHEN vle.entry_type = 'DEBIT' THEN vle.amount
          WHEN vle.entry_type = 'CREDIT' THEN -vle.amount
          WHEN vle.entry_type = 'ADJUST' THEN vle.amount
        END
      ) OVER (ORDER BY vle.created_at, vle.id) AS running_balance
    FROM public.virtual_ledger_entries vle
    LEFT JOIN public.profiles p ON p.id = vle.created_by
    WHERE vle.store_id = p_store_id
      AND vle.org_id = public.get_my_org_id()
    ORDER BY vle.created_at DESC, vle.id DESC
  )
  SELECT * FROM entries
  LIMIT p_limit OFFSET p_offset;
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
  RAISE NOTICE 'Tabelas: % (esperado: 22) | Views: % (esperado: 2)', t_count, v_count;
END $$;
