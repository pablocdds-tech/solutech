-- =============================================
-- Vitaliano ERP — Migração 00005
-- audit_logs, documents, document_links
-- Regra: audit_logs é IMUTÁVEL (sem UPDATE/DELETE)
-- =============================================

-- ===================
-- AUDIT LOGS — Registro imutável de todas as ações
-- ===================
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  table_name  text,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  source_type public.source_type NOT NULL DEFAULT 'user',
  source_id   text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

COMMENT ON TABLE public.audit_logs IS 'Registro imutável de auditoria. SEM UPDATE/DELETE permitido.';

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas admin da mesma org
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  USING (org_id = auth.org_id() AND auth.is_admin());

-- INSERT: qualquer usuário autenticado da mesma org (via service)
-- Na prática, inserts vêm de SECURITY DEFINER functions
CREATE POLICY "audit_logs_insert_own_org"
  ON public.audit_logs FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- UPDATE: BLOQUEADO (sem política = negado)
-- DELETE: BLOQUEADO (sem política = negado)

-- ===================
-- FUNCTION: Inserir audit_log (SECURITY DEFINER)
-- Para uso em transações atômicas dentro de RPCs
-- ===================
CREATE OR REPLACE FUNCTION public.fn_audit_log(
  p_org_id      uuid,
  p_store_id    uuid DEFAULT NULL,
  p_user_id     uuid DEFAULT NULL,
  p_action      text DEFAULT 'unknown',
  p_table_name  text DEFAULT NULL,
  p_record_id   uuid DEFAULT NULL,
  p_old_data    jsonb DEFAULT NULL,
  p_new_data    jsonb DEFAULT NULL,
  p_source_type public.source_type DEFAULT 'user',
  p_source_id   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    org_id, store_id, user_id, action,
    table_name, record_id, old_data, new_data,
    source_type, source_id
  ) VALUES (
    p_org_id, p_store_id, COALESCE(p_user_id, auth.uid()), p_action,
    p_table_name, p_record_id, p_old_data, p_new_data,
    p_source_type, p_source_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_audit_log IS 'Insere registro de auditoria. Usar dentro de transações atômicas.';

-- ===================
-- DOCUMENTS — Arquivos/documentos do sistema
-- ===================
CREATE TABLE public.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  store_id    uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  type        public.doc_type NOT NULL DEFAULT 'other',
  file_name   text NOT NULL,
  file_path   text NOT NULL,
  file_size   bigint,
  mime_type   text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_org_type ON public.documents(org_id, type);

COMMENT ON TABLE public.documents IS 'Documentos e arquivos: NF XML/PDF, OFX, fotos, evidências.';

-- Habilitar RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- SELECT: mesma org + store access (ou store_id IS NULL = org-wide)
CREATE POLICY "documents_select_own_org"
  ON public.documents FOR SELECT
  USING (
    org_id = auth.org_id()
    AND (store_id IS NULL OR auth.has_store_access(store_id))
  );

-- INSERT: mesma org
CREATE POLICY "documents_insert_own_org"
  ON public.documents FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- UPDATE: quem fez upload ou admin
CREATE POLICY "documents_update_owner_or_admin"
  ON public.documents FOR UPDATE
  USING (
    org_id = auth.org_id()
    AND (uploaded_by = auth.uid() OR auth.is_admin())
  )
  WITH CHECK (
    org_id = auth.org_id()
    AND (uploaded_by = auth.uid() OR auth.is_admin())
  );

-- DELETE: bloqueado (sem política)

-- ===================
-- DOCUMENT_LINKS — Liga documentos a entidades
-- ===================
CREATE TABLE public.document_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  linked_table  text NOT NULL,
  linked_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT document_links_unique UNIQUE (document_id, linked_table, linked_id)
);

CREATE INDEX idx_document_links_linked ON public.document_links(linked_table, linked_id);

COMMENT ON TABLE public.document_links IS 'Liga documentos a registros de qualquer tabela (polimórfico).';

-- Habilitar RLS
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

-- SELECT: mesma org
CREATE POLICY "document_links_select_own_org"
  ON public.document_links FOR SELECT
  USING (org_id = auth.org_id());

-- INSERT: mesma org
CREATE POLICY "document_links_insert_own_org"
  ON public.document_links FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- UPDATE: bloqueado (links são imutáveis)
-- DELETE: apenas admin
CREATE POLICY "document_links_delete_admin"
  ON public.document_links FOR DELETE
  USING (org_id = auth.org_id() AND auth.is_admin());
