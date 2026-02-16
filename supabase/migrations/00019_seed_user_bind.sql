-- =============================================
-- Vitaliano ERP — Vincular Usuário Admin
--
-- INSTRUÇÕES:
-- 1) Crie um usuário no Supabase Auth (Dashboard > Authentication > Users)
-- 2) Copie o UUID do usuário criado
-- 3) Substitua '<USER_UUID_AQUI>' abaixo pelo UUID real
-- 4) Execute este script no SQL Editor
-- =============================================

-- >>> SUBSTITUIR PELO UUID REAL DO USUÁRIO <<<
DO $$
DECLARE
  v_user_id uuid := '4375f451-89c8-458a-83c4-5211d78cf529';
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

  -- Verificar se já existe profile
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
    -- Atualizar para owner
    UPDATE profiles
    SET role = 'owner',
        org_id = v_org_id,
        is_active = true,
        updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Profile atualizado para owner';
  ELSE
    -- Criar profile
    INSERT INTO profiles (id, org_id, full_name, email, role, is_active)
    SELECT
      v_user_id,
      v_org_id,
      COALESCE(raw_user_meta_data->>'full_name', email),
      email,
      'owner',
      true
    FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE 'Profile criado como owner';
  END IF;

  -- Conceder acesso a TODAS as lojas
  INSERT INTO user_store_access (org_id, user_id, store_id)
  SELECT v_org_id, v_user_id, s.id
  FROM stores s
  WHERE s.org_id = v_org_id AND s.is_active = true
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Acesso concedido a todas as lojas';

  -- Conceder permissão EDIT em TODOS os módulos
  INSERT INTO module_permissions (org_id, user_id, module, access_level)
  VALUES
    (v_org_id, v_user_id, 'M1', 'edit'),
    (v_org_id, v_user_id, 'M2', 'edit'),
    (v_org_id, v_user_id, 'M3', 'edit'),
    (v_org_id, v_user_id, 'M4', 'edit'),
    (v_org_id, v_user_id, 'M5', 'edit'),
    (v_org_id, v_user_id, 'M6', 'edit'),
    (v_org_id, v_user_id, 'M7', 'edit'),
    (v_org_id, v_user_id, 'M8', 'edit'),
    (v_org_id, v_user_id, 'M9', 'edit'),
    (v_org_id, v_user_id, 'M11', 'edit'),
    (v_org_id, v_user_id, 'M13', 'edit')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Permissões de módulo concedidas';

END $$;

-- VERIFICAÇÃO
SELECT
  p.full_name,
  p.email,
  p.role,
  count(DISTINCT usa.store_id) as lojas,
  count(DISTINCT mp.module) as modulos
FROM profiles p
LEFT JOIN user_store_access usa ON usa.user_id = p.id
LEFT JOIN module_permissions mp ON mp.user_id = p.id
WHERE p.org_id = '00000000-0000-0000-0000-000000000001'
GROUP BY p.id, p.full_name, p.email, p.role;
