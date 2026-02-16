-- =============================================
-- Vitaliano ERP — Migração 00015
-- FASE 10: Contagens (M11) + Checklists (M13) + Notificações
--
-- 10.1 Contagens via link com perfil mínimo; ajuste estoque via ADJUST;
--      validação IA (flag divergência)
-- 10.2 Checklists com templates, agendamento, evidências; painel e ranking
-- 10.3 Notificações: Inbox como fonte de verdade; WhatsApp/email como espelho
--
-- INVARIANTES:
-- - Contagens ajustam estoque SOMENTE via inventory_moves ADJUST
-- - Checklist NÃO altera estoque/financeiro; só gera não conformidade
-- - Contagens unique por tarefa+item; tarefas recorrentes unique por agenda+data+turno
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.inventory_count_status AS ENUM ('open', 'counting', 'review', 'approved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_status AS ENUM ('pending', 'in_progress', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_item_result AS ENUM ('ok', 'nok', 'na', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('inbox', 'email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: inventory_counts (contagens/inventários)
-- ===========================================

CREATE TABLE public.inventory_counts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,

  status          public.inventory_count_status NOT NULL DEFAULT 'open',
  count_date      date NOT NULL DEFAULT CURRENT_DATE,
  title           text NOT NULL,
  description     text,

  total_items     int NOT NULL DEFAULT 0,
  counted_items   int NOT NULL DEFAULT 0,
  divergent_items int NOT NULL DEFAULT 0,

  approved_at     timestamptz,
  approved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at    timestamptz,
  cancelled_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  access_token    text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ic_org_status ON public.inventory_counts(org_id, status);
CREATE INDEX idx_ic_store ON public.inventory_counts(store_id);
CREATE INDEX idx_ic_date ON public.inventory_counts(org_id, count_date DESC);
CREATE INDEX idx_ic_token ON public.inventory_counts(access_token);

CREATE TRIGGER trg_ic_updated_at BEFORE UPDATE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: inventory_count_items (itens contados)
-- Unique por contagem+item
-- ===========================================

CREATE TABLE public.inventory_count_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  inventory_count_id  uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,

  expected_quantity   numeric(15,4) NOT NULL DEFAULT 0,
  counted_quantity    numeric(15,4),
  difference          numeric(15,4) GENERATED ALWAYS AS (
    CASE WHEN counted_quantity IS NOT NULL THEN counted_quantity - expected_quantity ELSE NULL END
  ) STORED,
  is_divergent        boolean GENERATED ALWAYS AS (
    CASE WHEN counted_quantity IS NOT NULL AND ABS(counted_quantity - expected_quantity) > 0.001 THEN true ELSE false END
  ) STORED,

  counted_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  counted_at          timestamptz,
  unit_id             uuid REFERENCES public.units(id) ON DELETE SET NULL,
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ici_unique ON public.inventory_count_items(inventory_count_id, item_id);
CREATE INDEX idx_ici_count ON public.inventory_count_items(inventory_count_id);
CREATE INDEX idx_ici_item ON public.inventory_count_items(item_id);

CREATE TRIGGER trg_ici_updated_at BEFORE UPDATE ON public.inventory_count_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. TABELA: checklist_templates
-- ===========================================

CREATE TABLE public.checklist_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid REFERENCES public.stores(id) ON DELETE SET NULL,

  name            text NOT NULL,
  description     text,
  category        text,
  is_active       boolean NOT NULL DEFAULT true,

  schedule_type   text CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'manual')),
  schedule_config jsonb,

  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ct_org ON public.checklist_templates(org_id);
CREATE UNIQUE INDEX idx_ct_name_org ON public.checklist_templates(org_id, lower(name)) WHERE is_active = true;

CREATE TRIGGER trg_ct_updated_at BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 5. TABELA: checklist_template_items (itens do template)
-- ===========================================

CREATE TABLE public.checklist_template_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  template_id     uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,

  title           text NOT NULL,
  description     text,
  sort_order      int NOT NULL DEFAULT 0,
  requires_evidence boolean NOT NULL DEFAULT false,
  is_critical     boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cti_template ON public.checklist_template_items(template_id);
CREATE TRIGGER trg_cti_updated_at BEFORE UPDATE ON public.checklist_template_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 6. TABELA: checklist_tasks (instâncias de execução)
-- Unique por agenda+data+turno
-- ===========================================

CREATE TABLE public.checklist_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  template_id     uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,

  status          public.checklist_status NOT NULL DEFAULT 'pending',
  task_date       date NOT NULL DEFAULT CURRENT_DATE,
  shift           text,
  due_at          timestamptz,

  total_items     int NOT NULL DEFAULT 0,
  completed_items int NOT NULL DEFAULT 0,
  nok_items       int NOT NULL DEFAULT 0,
  score_pct       numeric(5,2) NOT NULL DEFAULT 0,

  started_at      timestamptz,
  completed_at    timestamptz,
  assigned_to     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           text,

  source_type     public.source_type NOT NULL DEFAULT 'user',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Unique por agenda+data+turno
CREATE UNIQUE INDEX idx_cht_unique ON public.checklist_tasks(template_id, store_id, task_date, COALESCE(shift, '__none__'));
CREATE INDEX idx_cht_org_status ON public.checklist_tasks(org_id, status);
CREATE INDEX idx_cht_store ON public.checklist_tasks(store_id);
CREATE INDEX idx_cht_date ON public.checklist_tasks(org_id, task_date DESC);

CREATE TRIGGER trg_cht_updated_at BEFORE UPDATE ON public.checklist_tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 7. TABELA: checklist_task_items (respostas)
-- Unique por tarefa+item template
-- ===========================================

CREATE TABLE public.checklist_task_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  task_id             uuid NOT NULL REFERENCES public.checklist_tasks(id) ON DELETE CASCADE,
  template_item_id    uuid NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,

  result              public.checklist_item_result NOT NULL DEFAULT 'pending',
  evidence_url        text,
  evidence_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  observation         text,
  responded_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at        timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_chti_unique ON public.checklist_task_items(task_id, template_item_id);
CREATE INDEX idx_chti_task ON public.checklist_task_items(task_id);

CREATE TRIGGER trg_chti_updated_at BEFORE UPDATE ON public.checklist_task_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 8. TABELA: notifications (Inbox como SSOT)
-- ===========================================

CREATE TABLE public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id        uuid REFERENCES public.stores(id) ON DELETE SET NULL,

  title           text NOT NULL,
  body            text,
  priority        public.notification_priority NOT NULL DEFAULT 'normal',
  channel         public.notification_channel NOT NULL DEFAULT 'inbox',

  reference_type  text,
  reference_id    uuid,

  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,

  sent_external   boolean NOT NULL DEFAULT false,
  sent_external_at timestamptz,

  source_type     public.source_type NOT NULL DEFAULT 'system',
  source_id       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notif_org ON public.notifications(org_id);
CREATE INDEX idx_notif_date ON public.notifications(user_id, created_at DESC);

-- ===========================================
-- 9. RLS
-- ===========================================

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- inventory_counts
CREATE POLICY "ic_select" ON public.inventory_counts FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ic_insert" ON public.inventory_counts FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ic_update" ON public.inventory_counts FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- inventory_count_items
CREATE POLICY "ici_select" ON public.inventory_count_items FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ici_insert" ON public.inventory_count_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ici_update" ON public.inventory_count_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- checklist_templates
CREATE POLICY "ct_select" ON public.checklist_templates FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ct_insert" ON public.checklist_templates FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ct_update" ON public.checklist_templates FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- checklist_template_items
CREATE POLICY "cti_select" ON public.checklist_template_items FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "cti_insert" ON public.checklist_template_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "cti_update" ON public.checklist_template_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "cti_delete" ON public.checklist_template_items FOR DELETE
  USING (org_id = public.get_my_org_id());

-- checklist_tasks
CREATE POLICY "cht_select" ON public.checklist_tasks FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "cht_insert" ON public.checklist_tasks FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "cht_update" ON public.checklist_tasks FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- checklist_task_items
CREATE POLICY "chti_select" ON public.checklist_task_items FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "chti_insert" ON public.checklist_task_items FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "chti_update" ON public.checklist_task_items FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- notifications (user vê apenas as suas)
CREATE POLICY "notif_select" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ===========================================
-- 10. FUNÇÃO: fn_approve_inventory_count
-- Gera inventory_moves ADJUST para divergências + audit
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_approve_inventory_count(p_count_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count     inventory_counts%ROWTYPE;
  v_user_id   uuid;
  v_org_id    uuid;
  v_adjust_ct int := 0;
  v_total     int;
  v_counted   int;
  v_divergent int;
  r_item      RECORD;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_count FROM inventory_counts WHERE id = p_count_id FOR UPDATE;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;
  IF v_count.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Idempotência
  IF v_count.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Contagem já aprovada');
  END IF;

  IF v_count.status NOT IN ('review', 'counting') THEN
    RAISE EXCEPTION 'Status não permite aprovação: %', v_count.status;
  END IF;

  -- Contadores
  SELECT count(*), count(CASE WHEN counted_quantity IS NOT NULL THEN 1 END),
         count(CASE WHEN is_divergent = true THEN 1 END)
  INTO v_total, v_counted, v_divergent
  FROM inventory_count_items WHERE inventory_count_id = p_count_id;

  -- Gerar ADJUST para cada divergência
  FOR r_item IN
    SELECT * FROM inventory_count_items
    WHERE inventory_count_id = p_count_id
      AND is_divergent = true
      AND counted_quantity IS NOT NULL
  LOOP
    INSERT INTO inventory_moves (
      org_id, store_id, item_id, move_type, quantity, unit_cost,
      reference_type, reference_id, notes,
      source_type, source_id, created_by
    ) VALUES (
      v_count.org_id, v_count.store_id, r_item.item_id,
      'ADJUST',
      r_item.difference,
      0,
      'inventory_count', v_count.id,
      'Ajuste por contagem #' || left(p_count_id::text, 8),
      'system', v_count.id::text, v_user_id
    );
    v_adjust_ct := v_adjust_ct + 1;
  END LOOP;

  -- Atualizar contagem
  UPDATE inventory_counts
  SET status = 'approved',
      total_items = v_total,
      counted_items = v_counted,
      divergent_items = v_divergent,
      approved_at = now(),
      approved_by = v_user_id,
      updated_at = now()
  WHERE id = p_count_id;

  -- Audit
  PERFORM fn_audit_log(
    v_count.org_id, v_count.store_id, v_user_id,
    'approve_inventory_count', 'inventory_counts', p_count_id,
    NULL,
    jsonb_build_object(
      'status', 'approved',
      'total_items', v_total,
      'counted_items', v_counted,
      'divergent_items', v_divergent,
      'adjustments_created', v_adjust_ct
    ),
    'system', v_count.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'count_id', p_count_id,
    'total_items', v_total,
    'counted_items', v_counted,
    'divergent_items', v_divergent,
    'adjustments_created', v_adjust_ct,
    'message', 'Contagem aprovada: ajustes de estoque gerados via ADJUST'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_approve_inventory_count IS
  'Aprova contagem: gera inventory_moves ADJUST para divergências. Idempotente. Estoque só via moves.';

-- ===========================================
-- 11. FUNÇÃO: fn_complete_checklist_task
-- Calcula score e marca como completada
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_complete_checklist_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task      checklist_tasks%ROWTYPE;
  v_user_id   uuid;
  v_org_id    uuid;
  v_total     int;
  v_completed int;
  v_nok       int;
  v_score     numeric;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_task FROM checklist_tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Tarefa de checklist não encontrada';
  END IF;
  IF v_task.org_id != v_org_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tarefa já completada');
  END IF;

  -- Calcular
  SELECT count(*),
         count(CASE WHEN result != 'pending' THEN 1 END),
         count(CASE WHEN result = 'nok' THEN 1 END)
  INTO v_total, v_completed, v_nok
  FROM checklist_task_items WHERE task_id = p_task_id;

  IF v_total > 0 THEN
    v_score := ((v_total - v_nok)::numeric / v_total) * 100;
  ELSE
    v_score := 100;
  END IF;

  UPDATE checklist_tasks
  SET status = 'completed',
      total_items = v_total,
      completed_items = v_completed,
      nok_items = v_nok,
      score_pct = v_score,
      completed_at = now(),
      completed_by = v_user_id,
      updated_at = now()
  WHERE id = p_task_id;

  -- Audit
  PERFORM fn_audit_log(
    v_task.org_id, v_task.store_id, v_user_id,
    'complete_checklist_task', 'checklist_tasks', p_task_id,
    NULL,
    jsonb_build_object(
      'status', 'completed',
      'total_items', v_total,
      'completed_items', v_completed,
      'nok_items', v_nok,
      'score_pct', v_score
    ),
    'system', v_task.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'score_pct', v_score,
    'nok_items', v_nok,
    'message', 'Checklist completado com score ' || round(v_score, 1) || '%'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_complete_checklist_task IS
  'Completa tarefa de checklist: calcula score %, conta NOK. Idempotente. Não altera estoque.';

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
  RAISE NOTICE 'Tabelas: % (esperado: 49) | Views: % (esperado: 4)', t_count, v_count;
END $$;
