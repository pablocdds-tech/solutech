-- =============================================
-- Vitaliano ERP — Seed de Desenvolvimento
-- ATENÇÃO: Executar apenas em ambiente de dev/staging.
-- NÃO executar em produção.
-- =============================================

-- ===================
-- ORG PADRÃO
-- ===================
INSERT INTO public.orgs (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Vitaliano',
  'vitaliano',
  '{"timezone": "America/Fortaleza"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ===================
-- LOJAS
-- ===================
INSERT INTO public.stores (id, org_id, name, slug, type, cnpj)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Vitaliano NB',
    'nb',
    'store',
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Vitaliano Praça',
    'praca',
    'store',
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'CD Vitaliano',
    'cd',
    'cd',
    NULL
  )
ON CONFLICT (org_id, slug) DO NOTHING;

-- ===================
-- NOTA: Perfis de teste devem ser criados via Supabase Auth
-- (signup com metadata: org_id + role + full_name).
--
-- Exemplo de metadata para signup:
-- {
--   "org_id": "00000000-0000-0000-0000-000000000001",
--   "full_name": "Admin Dev",
--   "role": "owner"
-- }
--
-- Após criar o user via Auth, atribuir store_access:
--
-- INSERT INTO user_store_access (org_id, user_id, store_id)
-- VALUES
--   ('00000000-...-001', '<user_uuid>', '00000000-...-010'),
--   ('00000000-...-001', '<user_uuid>', '00000000-...-011'),
--   ('00000000-...-001', '<user_uuid>', '00000000-...-012');
-- ===================
