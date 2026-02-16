-- =============================================
-- Vitaliano ERP — Seed CD→Loja Teste
--
-- Cria dados de teste para o módulo CD→Loja:
-- - 2 itens extras (se não existirem)
-- - Tabela de preços CD→Loja para lojas NB e Praça
-- - 1 pedido rascunho de teste com 2 itens
-- =============================================

DO $$
DECLARE
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_cd_id   uuid := '00000000-0000-0000-0000-000000000003'; -- CD Vitaliano
  v_nb_id   uuid := '00000000-0000-0000-0000-000000000002'; -- Vitaliano NB
  v_praca_id uuid := '00000000-0000-0000-0000-000000000004'; -- Vitaliano Praça
  v_unit_kg uuid := '00000000-0000-0000-0001-000000000001';  -- kg
  v_unit_un uuid := '00000000-0000-0000-0001-000000000003';  -- unidade

  v_item1   uuid;
  v_item2   uuid;
  v_item3   uuid;
  v_item4   uuid;
  v_order_id uuid;
BEGIN

  -- Pegar IDs dos itens existentes do seed
  SELECT id INTO v_item1 FROM items WHERE org_id = v_org_id AND name = 'Filé Mignon' LIMIT 1;
  SELECT id INTO v_item2 FROM items WHERE org_id = v_org_id AND name = 'Picanha' LIMIT 1;

  -- Criar itens extras se não existirem
  IF NOT EXISTS (SELECT 1 FROM items WHERE org_id = v_org_id AND name = 'Pão de Hambúrguer') THEN
    INSERT INTO items (org_id, name, type, default_unit_id, min_stock, max_stock, is_active, settings)
    VALUES (v_org_id, 'Pão de Hambúrguer', 'ingredient', v_unit_un, 50, 500, true, '{}')
    RETURNING id INTO v_item3;
    RAISE NOTICE 'Item criado: Pão de Hambúrguer = %', v_item3;
  ELSE
    SELECT id INTO v_item3 FROM items WHERE org_id = v_org_id AND name = 'Pão de Hambúrguer' LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM items WHERE org_id = v_org_id AND name = 'Queijo Cheddar') THEN
    INSERT INTO items (org_id, name, type, default_unit_id, min_stock, max_stock, is_active, settings)
    VALUES (v_org_id, 'Queijo Cheddar', 'ingredient', v_unit_kg, 5, 30, true, '{}')
    RETURNING id INTO v_item4;
    RAISE NOTICE 'Item criado: Queijo Cheddar = %', v_item4;
  ELSE
    SELECT id INTO v_item4 FROM items WHERE org_id = v_org_id AND name = 'Queijo Cheddar' LIMIT 1;
  END IF;

  -- Criar tabela de preços para a loja NB (se não existir)
  IF v_item1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item1 AND store_id = v_nb_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_nb_id, v_item1, 89.90, 62.00, true, '2025-01-01');
    RAISE NOTICE 'Preço criado: Filé Mignon -> NB';
  END IF;

  IF v_item2 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item2 AND store_id = v_nb_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_nb_id, v_item2, 79.90, 55.00, true, '2025-01-01');
    RAISE NOTICE 'Preço criado: Picanha -> NB';
  END IF;

  IF v_item3 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item3 AND store_id = v_nb_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_nb_id, v_item3, 1.50, 0.80, true, '2025-01-01');
    RAISE NOTICE 'Preço criado: Pão de Hambúrguer -> NB';
  END IF;

  IF v_item4 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item4 AND store_id = v_nb_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_nb_id, v_item4, 45.00, 32.00, true, '2025-01-01');
    RAISE NOTICE 'Preço criado: Queijo Cheddar -> NB';
  END IF;

  -- Preços para Praça
  IF v_item1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item1 AND store_id = v_praca_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_praca_id, v_item1, 89.90, 62.00, true, '2025-01-01');
  END IF;

  IF v_item2 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item2 AND store_id = v_praca_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_praca_id, v_item2, 79.90, 55.00, true, '2025-01-01');
  END IF;

  IF v_item3 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item3 AND store_id = v_praca_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_praca_id, v_item3, 1.50, 0.80, true, '2025-01-01');
  END IF;

  IF v_item4 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM item_prices WHERE org_id = v_org_id AND item_id = v_item4 AND store_id = v_praca_id
  ) THEN
    INSERT INTO item_prices (org_id, store_id, item_id, price, cost_price, is_active, valid_from)
    VALUES (v_org_id, v_praca_id, v_item4, 45.00, 32.00, true, '2025-01-01');
  END IF;

  -- Criar 1 pedido rascunho de teste (CD → NB) com 2 itens
  IF NOT EXISTS (
    SELECT 1 FROM internal_orders WHERE org_id = v_org_id AND notes = 'Pedido de teste CD→NB'
  ) THEN
    INSERT INTO internal_orders (
      org_id, source_store_id, destination_store_id,
      status, order_date, total_amount, notes,
      source_type, source_id
    ) VALUES (
      v_org_id, v_cd_id, v_nb_id,
      'draft', CURRENT_DATE, 0, 'Pedido de teste CD→NB',
      'system', 'seed'
    ) RETURNING id INTO v_order_id;

    -- Item 1: Filé Mignon 10kg a R$62/kg = R$620
    IF v_item1 IS NOT NULL THEN
      INSERT INTO internal_order_items (org_id, internal_order_id, item_id, quantity, unit_cost, unit_id, notes)
      VALUES (v_org_id, v_order_id, v_item1, 10, 62.00, v_unit_kg, 'Filé para o final de semana');
    END IF;

    -- Item 2: Pão de Hambúrguer 100un a R$0.80/un = R$80
    IF v_item3 IS NOT NULL THEN
      INSERT INTO internal_order_items (org_id, internal_order_id, item_id, quantity, unit_cost, unit_id, notes)
      VALUES (v_org_id, v_order_id, v_item3, 100, 0.80, v_unit_un, 'Pães para hambúrguer');
    END IF;

    RAISE NOTICE 'Pedido rascunho criado: % com 2 itens', v_order_id;
  ELSE
    RAISE NOTICE 'Pedido de teste já existe, ignorando';
  END IF;

END $$;

-- VERIFICAÇÃO
SELECT
  io.id,
  io.status,
  io.order_date,
  s1.name as origem,
  s2.name as destino,
  io.total_amount,
  (SELECT count(*) FROM internal_order_items WHERE internal_order_id = io.id) as itens,
  io.notes
FROM internal_orders io
JOIN stores s1 ON s1.id = io.source_store_id
JOIN stores s2 ON s2.id = io.destination_store_id
WHERE io.org_id = '00000000-0000-0000-0000-000000000001'
ORDER BY io.created_at DESC
LIMIT 5;
