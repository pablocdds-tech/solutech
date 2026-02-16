-- =============================================
-- Vitaliano ERP — Migração 00017
-- IA EXECUTORA
--
-- Fluxo: Plan → Confirm → Execute
-- IA NUNCA escreve no banco diretamente: SÓ via Action Catalog
-- Todas as ações IA geram audit_logs + source_type='ai' + source_id
--
-- INVARIANTES:
-- - IA propõe plano (steps), humano confirma, sistema executa
-- - Cada step mapeia para uma action do Action Catalog
-- - Execução é atômica por step (chama a RPC/action correspondente)
-- - Rollback: se step falha, task vai para 'failed'
-- - Tudo rastreável: source_type='ai', source_id=task_id
-- =============================================

-- ===========================================
-- 1. ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE public.ai_task_status AS ENUM (
    'planning',      -- IA está montando o plano
    'pending_review', -- Plano pronto, aguardando confirmação humana
    'approved',       -- Humano aprovou, pronto para executar
    'executing',      -- Em execução
    'completed',      -- Todos os steps executados com sucesso
    'failed',         -- Algum step falhou
    'rejected',       -- Humano rejeitou o plano
    'cancelled'       -- Cancelado
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_step_status AS ENUM (
    'pending',    -- Aguardando execução
    'executing',  -- Em execução agora
    'completed',  -- Executado com sucesso
    'failed',     -- Falhou
    'skipped'     -- Pulado (ex: dependência falhou)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 2. TABELA: ai_tasks (tarefas da IA)
-- ===========================================

CREATE TABLE public.ai_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id        uuid REFERENCES public.stores(id) ON DELETE SET NULL,

  status          public.ai_task_status NOT NULL DEFAULT 'planning',
  title           text NOT NULL,
  description     text,
  intent          text NOT NULL,
  context         jsonb,

  -- Plano proposto pela IA
  plan_summary    text,
  total_steps     int NOT NULL DEFAULT 0,
  completed_steps int NOT NULL DEFAULT 0,
  failed_steps    int NOT NULL DEFAULT 0,

  -- Confirmação humana
  reviewed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  review_notes    text,

  -- Execução
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,

  -- Rastreabilidade
  ai_model        text,
  ai_session_id   text,
  source_type     public.source_type NOT NULL DEFAULT 'ai',
  source_id       text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ait_org_status ON public.ai_tasks(org_id, status);
CREATE INDEX idx_ait_store ON public.ai_tasks(store_id);
CREATE INDEX idx_ait_date ON public.ai_tasks(org_id, created_at DESC);

CREATE TRIGGER trg_ait_updated_at BEFORE UPDATE ON public.ai_tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 3. TABELA: ai_task_steps (passos do plano)
-- Cada step mapeia para uma action do Action Catalog
-- ===========================================

CREATE TABLE public.ai_task_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  ai_task_id      uuid NOT NULL REFERENCES public.ai_tasks(id) ON DELETE CASCADE,

  step_order      int NOT NULL,
  status          public.ai_step_status NOT NULL DEFAULT 'pending',

  -- Mapeamento para Action Catalog
  action_catalog  text NOT NULL,
  action_params   jsonb NOT NULL DEFAULT '{}',
  description     text NOT NULL,

  -- Resultado
  result          jsonb,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  duration_ms     int,

  -- Referências criadas
  created_records jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aits_task ON public.ai_task_steps(ai_task_id);
CREATE INDEX idx_aits_order ON public.ai_task_steps(ai_task_id, step_order);
CREATE UNIQUE INDEX idx_aits_unique_order ON public.ai_task_steps(ai_task_id, step_order);

CREATE TRIGGER trg_aits_updated_at BEFORE UPDATE ON public.ai_task_steps
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ===========================================
-- 4. RLS
-- ===========================================

ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ait_select" ON public.ai_tasks FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "ait_insert" ON public.ai_tasks FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "ait_update" ON public.ai_tasks FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

CREATE POLICY "aits_select" ON public.ai_task_steps FOR SELECT
  USING (org_id = public.get_my_org_id());
CREATE POLICY "aits_insert" ON public.ai_task_steps FOR INSERT
  WITH CHECK (org_id = public.get_my_org_id());
CREATE POLICY "aits_update" ON public.ai_task_steps FOR UPDATE
  USING (org_id = public.get_my_org_id())
  WITH CHECK (org_id = public.get_my_org_id());

-- ===========================================
-- 5. FUNÇÃO: fn_ai_approve_task
-- Humano aprova o plano → status = 'approved'
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_ai_approve_task(
  p_task_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task    ai_tasks%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_task FROM ai_tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN RAISE EXCEPTION 'Tarefa IA não encontrada'; END IF;
  IF v_task.org_id != v_org_id THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  IF v_task.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Já aprovada');
  END IF;

  IF v_task.status != 'pending_review' THEN
    RAISE EXCEPTION 'Somente tarefas em revisão podem ser aprovadas. Status: %', v_task.status;
  END IF;

  UPDATE ai_tasks
  SET status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_notes = p_notes,
      updated_at = now()
  WHERE id = p_task_id;

  PERFORM fn_audit_log(
    v_org_id, v_task.store_id, v_user_id,
    'ai_approve_task', 'ai_tasks', p_task_id,
    NULL,
    jsonb_build_object('status', 'approved', 'notes', p_notes, 'total_steps', v_task.total_steps),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'message', 'Tarefa aprovada para execução');
END;
$$;

-- ===========================================
-- 6. FUNÇÃO: fn_ai_reject_task
-- Humano rejeita o plano
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_ai_reject_task(
  p_task_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task    ai_tasks%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_task FROM ai_tasks WHERE id = p_task_id FOR UPDATE;

  IF v_task IS NULL THEN RAISE EXCEPTION 'Tarefa IA não encontrada'; END IF;
  IF v_task.org_id != v_org_id THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  IF v_task.status = 'rejected' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Já rejeitada');
  END IF;

  IF v_task.status NOT IN ('pending_review', 'planning') THEN
    RAISE EXCEPTION 'Status não permite rejeição: %', v_task.status;
  END IF;

  UPDATE ai_tasks
  SET status = 'rejected',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_notes = p_notes,
      updated_at = now()
  WHERE id = p_task_id;

  PERFORM fn_audit_log(
    v_org_id, v_task.store_id, v_user_id,
    'ai_reject_task', 'ai_tasks', p_task_id,
    NULL,
    jsonb_build_object('status', 'rejected', 'notes', p_notes),
    'user', v_user_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Tarefa rejeitada');
END;
$$;

-- ===========================================
-- 7. FUNÇÃO: fn_ai_execute_step
-- Executa um step individual (chamado pelo sistema)
-- Registra resultado + duração + audit
-- ===========================================

CREATE OR REPLACE FUNCTION public.fn_ai_execute_step(
  p_step_id uuid,
  p_result jsonb,
  p_success boolean,
  p_error_message text DEFAULT NULL,
  p_created_records jsonb DEFAULT NULL,
  p_duration_ms int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step    ai_task_steps%ROWTYPE;
  v_task    ai_tasks%ROWTYPE;
  v_user_id uuid;
  v_org_id  uuid;
  v_new_status ai_step_status;
BEGIN
  v_user_id := auth.uid();
  v_org_id  := public.get_my_org_id();

  SELECT * INTO v_step FROM ai_task_steps WHERE id = p_step_id FOR UPDATE;

  IF v_step IS NULL THEN RAISE EXCEPTION 'Step não encontrado'; END IF;
  IF v_step.org_id != v_org_id THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  IF v_step.status IN ('completed', 'failed') THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Step já finalizado');
  END IF;

  v_new_status := CASE WHEN p_success THEN 'completed'::ai_step_status ELSE 'failed'::ai_step_status END;

  UPDATE ai_task_steps
  SET status = v_new_status,
      result = p_result,
      error_message = p_error_message,
      created_records = p_created_records,
      completed_at = now(),
      duration_ms = p_duration_ms,
      updated_at = now()
  WHERE id = p_step_id;

  -- Atualizar contadores da task
  SELECT * INTO v_task FROM ai_tasks WHERE id = v_step.ai_task_id FOR UPDATE;

  UPDATE ai_tasks
  SET completed_steps = (SELECT count(*) FROM ai_task_steps WHERE ai_task_id = v_task.id AND status = 'completed'),
      failed_steps = (SELECT count(*) FROM ai_task_steps WHERE ai_task_id = v_task.id AND status = 'failed'),
      updated_at = now()
  WHERE id = v_task.id;

  -- Se falhou, marcar task como failed
  IF NOT p_success THEN
    UPDATE ai_tasks
    SET status = 'failed',
        error_message = 'Step ' || v_step.step_order || ' falhou: ' || COALESCE(p_error_message, 'Erro desconhecido'),
        updated_at = now()
    WHERE id = v_task.id;

    -- Marcar steps restantes como skipped
    UPDATE ai_task_steps
    SET status = 'skipped', updated_at = now()
    WHERE ai_task_id = v_task.id AND step_order > v_step.step_order AND status = 'pending';
  END IF;

  -- Se todos completaram, marcar task como completed
  IF p_success AND NOT EXISTS (
    SELECT 1 FROM ai_task_steps WHERE ai_task_id = v_task.id AND status = 'pending'
  ) THEN
    UPDATE ai_tasks
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = v_task.id;
  END IF;

  -- Audit
  PERFORM fn_audit_log(
    v_org_id, v_task.store_id, v_user_id,
    'ai_execute_step', 'ai_task_steps', p_step_id,
    NULL,
    jsonb_build_object(
      'task_id', v_task.id,
      'step_order', v_step.step_order,
      'action', v_step.action_catalog,
      'success', p_success,
      'error', p_error_message,
      'duration_ms', p_duration_ms
    ),
    'ai', v_task.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'step_status', v_new_status,
    'message', CASE WHEN p_success THEN 'Step executado com sucesso' ELSE 'Step falhou' END
  );
END;
$$;

COMMENT ON FUNCTION public.fn_ai_execute_step IS
  'Registra resultado de execução de um step da IA. Se falha, task falha e steps restantes são skipped.';

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
  RAISE NOTICE 'Tabelas: % (esperado: 51) | Views: %', t_count, v_count;
END $$;
