-- FIX: Corrige v_dashboard_summary (destination_store_id → store_id)
-- Dropa view e recria; RPCs não dependem da view, então ficam intactos.

DROP VIEW IF EXISTS public.v_dashboard_summary CASCADE;

CREATE OR REPLACE VIEW public.v_dashboard_summary AS
SELECT
  o.id AS org_id,
  s.id AS store_id,
  s.name AS store_name,

  (SELECT COALESCE(SUM(ap.amount - COALESCE(ap.paid_amount, 0)), 0)
   FROM ap_payables ap WHERE ap.org_id = o.id AND ap.store_id = s.id
   AND ap.status IN ('pending', 'partial')) AS ap_pending,

  (SELECT COALESCE(SUM(ar.amount - COALESCE(ar.received_amount, 0)), 0)
   FROM ar_receivables ar WHERE ar.org_id = o.id AND ar.store_id = s.id
   AND ar.status IN ('pending', 'partial')) AS ar_pending,

  (SELECT COALESCE(SUM(sa.total_amount), 0)
   FROM sales sa WHERE sa.org_id = o.id AND sa.store_id = s.id
   AND sa.status = 'confirmed'
   AND sa.sale_date >= date_trunc('month', CURRENT_DATE)) AS sales_month,

  (SELECT COALESCE(SUM(r.total_amount), 0)
   FROM receivings r WHERE r.org_id = o.id AND r.store_id = s.id
   AND r.status = 'confirmed'
   AND r.created_at >= date_trunc('month', CURRENT_DATE)) AS purchases_month,

  (SELECT COUNT(DISTINCT ib.item_id)
   FROM v_inventory_balance ib WHERE ib.org_id = o.id AND ib.store_id = s.id
   AND ib.balance > 0) AS items_in_stock,

  (SELECT COUNT(*)
   FROM production_orders po WHERE po.org_id = o.id AND po.store_id = s.id
   AND po.status IN ('draft', 'in_progress')) AS open_production_orders,

  (SELECT COUNT(*)
   FROM checklist_tasks ct WHERE ct.org_id = o.id AND ct.store_id = s.id
   AND ct.status IN ('pending', 'in_progress')) AS pending_checklists,

  (SELECT COUNT(*)
   FROM inventory_counts ic WHERE ic.org_id = o.id AND ic.store_id = s.id
   AND ic.status IN ('open', 'counting', 'review')) AS open_counts

FROM orgs o
CROSS JOIN stores s
WHERE s.org_id = o.id AND s.is_active = true;

-- Agora recriar as RPCs (que podem ter falhado na execução anterior)

CREATE OR REPLACE FUNCTION public.fn_report_dre(
  p_store_id uuid DEFAULT NULL,
  p_date_from date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (category text, description text, amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid; v_revenue numeric; v_cmv numeric; v_expenses numeric; v_losses numeric;
BEGIN
  v_org_id := public.get_my_org_id();

  SELECT COALESCE(SUM(sa.total_amount), 0) INTO v_revenue
  FROM sales sa WHERE sa.org_id = v_org_id AND sa.status = 'confirmed'
    AND sa.sale_date >= p_date_from AND sa.sale_date <= p_date_to
    AND (p_store_id IS NULL OR sa.store_id = p_store_id);

  SELECT COALESCE(SUM(im.quantity * im.unit_cost), 0) INTO v_cmv
  FROM inventory_moves im WHERE im.org_id = v_org_id AND im.move_type = 'OUT'
    AND im.reference_type IN ('sale', 'production_order')
    AND im.created_at >= p_date_from AND im.created_at < (p_date_to + interval '1 day')
    AND (p_store_id IS NULL OR im.store_id = p_store_id);

  SELECT COALESCE(SUM(ap.paid_amount), 0) INTO v_expenses
  FROM ap_payables ap WHERE ap.org_id = v_org_id AND ap.status = 'paid'
    AND ap.paid_at >= p_date_from AND ap.paid_at < (p_date_to + interval '1 day')
    AND (p_store_id IS NULL OR ap.store_id = p_store_id);

  SELECT COALESCE(SUM(im.quantity * im.unit_cost), 0) INTO v_losses
  FROM inventory_moves im WHERE im.org_id = v_org_id AND im.move_type = 'OUT'
    AND im.reference_type = 'production_loss'
    AND im.created_at >= p_date_from AND im.created_at < (p_date_to + interval '1 day')
    AND (p_store_id IS NULL OR im.store_id = p_store_id);

  RETURN QUERY VALUES
    ('receita'::text, 'Receita Bruta (Vendas)'::text, v_revenue),
    ('cmv', 'CMV (Custo Mercadoria Vendida)', -v_cmv),
    ('lucro_bruto', 'Lucro Bruto', v_revenue - v_cmv),
    ('perdas', 'Perdas de Produção', -v_losses),
    ('despesas', 'Despesas Operacionais (AP pagos)', -v_expenses),
    ('resultado', 'Resultado Operacional', v_revenue - v_cmv - v_losses - v_expenses);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_cash_flow(
  p_store_id uuid DEFAULT NULL,
  p_date_from date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (category text, description text, amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid; v_inflows numeric; v_outflows numeric;
BEGIN
  v_org_id := public.get_my_org_id();

  SELECT COALESCE(SUM(bt.amount), 0) INTO v_inflows
  FROM bank_transactions bt WHERE bt.org_id = v_org_id AND bt.type = 'credit'
    AND bt.transaction_date >= p_date_from AND bt.transaction_date <= p_date_to
    AND (p_store_id IS NULL OR bt.store_id = p_store_id);

  SELECT COALESCE(SUM(bt.amount), 0) INTO v_outflows
  FROM bank_transactions bt WHERE bt.org_id = v_org_id AND bt.type = 'debit'
    AND bt.transaction_date >= p_date_from AND bt.transaction_date <= p_date_to
    AND (p_store_id IS NULL OR bt.store_id = p_store_id);

  RETURN QUERY VALUES
    ('entradas'::text, 'Entradas (Créditos Bancários)'::text, v_inflows),
    ('saidas', 'Saídas (Débitos Bancários)', -v_outflows),
    ('saldo_periodo', 'Saldo do Período', v_inflows - v_outflows);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_aging_ap(p_store_id uuid DEFAULT NULL)
RETURNS TABLE (aging_bucket text, count bigint, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT
    CASE
      WHEN ap.due_date > CURRENT_DATE THEN 'A vencer'
      WHEN CURRENT_DATE - ap.due_date <= 30 THEN 'Vencido 1-30 dias'
      WHEN CURRENT_DATE - ap.due_date <= 60 THEN 'Vencido 31-60 dias'
      WHEN CURRENT_DATE - ap.due_date <= 90 THEN 'Vencido 61-90 dias'
      ELSE 'Vencido +90 dias'
    END,
    COUNT(*),
    SUM(ap.amount - COALESCE(ap.paid_amount, 0))
  FROM ap_payables ap WHERE ap.org_id = v_org_id AND ap.status IN ('pending', 'partial')
    AND (p_store_id IS NULL OR ap.store_id = p_store_id)
  GROUP BY 1 ORDER BY
    CASE WHEN 1 = 1 THEN
      CASE
        WHEN ap.due_date > CURRENT_DATE THEN 1
        WHEN CURRENT_DATE - ap.due_date <= 30 THEN 2
        WHEN CURRENT_DATE - ap.due_date <= 60 THEN 3
        WHEN CURRENT_DATE - ap.due_date <= 90 THEN 4
        ELSE 5
      END
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_aging_ar(p_store_id uuid DEFAULT NULL)
RETURNS TABLE (aging_bucket text, count bigint, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT
    CASE
      WHEN ar.due_date > CURRENT_DATE THEN 'A vencer'
      WHEN CURRENT_DATE - ar.due_date <= 30 THEN 'Vencido 1-30 dias'
      WHEN CURRENT_DATE - ar.due_date <= 60 THEN 'Vencido 31-60 dias'
      WHEN CURRENT_DATE - ar.due_date <= 90 THEN 'Vencido 61-90 dias'
      ELSE 'Vencido +90 dias'
    END,
    COUNT(*),
    SUM(ar.amount - COALESCE(ar.received_amount, 0))
  FROM ar_receivables ar WHERE ar.org_id = v_org_id AND ar.status IN ('pending', 'partial')
    AND (p_store_id IS NULL OR ar.store_id = p_store_id)
  GROUP BY 1 ORDER BY
    CASE WHEN 1 = 1 THEN
      CASE
        WHEN ar.due_date > CURRENT_DATE THEN 1
        WHEN CURRENT_DATE - ar.due_date <= 30 THEN 2
        WHEN CURRENT_DATE - ar.due_date <= 60 THEN 3
        WHEN CURRENT_DATE - ar.due_date <= 90 THEN 4
        ELSE 5
      END
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_stock_valuation(p_store_id uuid DEFAULT NULL)
RETURNS TABLE (store_id uuid, item_id uuid, balance numeric, avg_cost numeric, total_value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT ib.store_id, ib.item_id, ib.balance, ib.avg_cost, (ib.balance * ib.avg_cost)
  FROM v_inventory_balance ib WHERE ib.org_id = v_org_id AND ib.balance > 0
    AND (p_store_id IS NULL OR ib.store_id = p_store_id)
  ORDER BY (ib.balance * ib.avg_cost) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_production_summary(
  p_store_id uuid DEFAULT NULL,
  p_date_from date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (recipe_id uuid, total_orders bigint, total_planned numeric, total_actual numeric,
  total_input_cost numeric, total_loss_cost numeric, avg_unit_cost numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT po.recipe_id, COUNT(*), SUM(po.planned_quantity), SUM(COALESCE(po.actual_quantity, 0)),
    SUM(po.total_input_cost), SUM(po.total_loss_cost),
    CASE WHEN SUM(COALESCE(po.actual_quantity, 0)) > 0
      THEN SUM(po.total_input_cost + po.total_loss_cost) / SUM(po.actual_quantity) ELSE 0 END
  FROM production_orders po WHERE po.org_id = v_org_id AND po.status = 'finalized'
    AND po.finalized_at >= p_date_from AND po.finalized_at < (p_date_to + interval '1 day')
    AND (p_store_id IS NULL OR po.store_id = p_store_id)
  GROUP BY po.recipe_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_virtual_bank_summary()
RETURNS TABLE (store_id uuid, total_debits numeric, total_credits numeric, total_adjusts numeric, balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT vl.store_id,
    SUM(CASE WHEN vl.entry_type = 'DEBIT' THEN vl.amount ELSE 0 END),
    SUM(CASE WHEN vl.entry_type = 'CREDIT' THEN vl.amount ELSE 0 END),
    SUM(CASE WHEN vl.entry_type = 'ADJUST' THEN vl.amount ELSE 0 END),
    SUM(CASE WHEN vl.entry_type = 'DEBIT' THEN vl.amount WHEN vl.entry_type = 'CREDIT' THEN -vl.amount ELSE vl.amount END)
  FROM virtual_ledger_entries vl WHERE vl.org_id = v_org_id GROUP BY vl.store_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_report_checklist_ranking(
  p_date_from date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS TABLE (store_id uuid, total_tasks bigint, completed_tasks bigint, avg_score numeric, total_nok bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id();
  RETURN QUERY
  SELECT ct.store_id, COUNT(*), COUNT(CASE WHEN ct.status = 'completed' THEN 1 END),
    AVG(CASE WHEN ct.status = 'completed' THEN ct.score_pct END), SUM(ct.nok_items)
  FROM checklist_tasks ct WHERE ct.org_id = v_org_id
    AND ct.task_date >= p_date_from AND ct.task_date <= p_date_to
  GROUP BY ct.store_id ORDER BY avg_score DESC NULLS LAST;
END;
$$;

-- VERIFICAÇÃO
DO $$
DECLARE t_count int; v_count int; f_count int;
BEGIN
  SELECT count(*) INTO t_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT count(*) INTO v_count FROM information_schema.views
  WHERE table_schema = 'public';
  SELECT count(*) INTO f_count FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
  RAISE NOTICE 'Tabelas: % | Views: % (esperado: 5) | Funções: %', t_count, v_count, f_count;
END $$;
