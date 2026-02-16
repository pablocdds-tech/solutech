-- =============================================
-- Vitaliano ERP — Migração 00001
-- Extensions e Enums do domínio
-- =============================================

-- Extensions necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ===================
-- ENUMS DO DOMÍNIO
-- ===================

-- Tipos de loja
CREATE TYPE public.store_type AS ENUM ('store', 'cd');

-- Roles do sistema (P0-P9)
CREATE TYPE public.app_role AS ENUM (
  'owner',              -- P0: Proprietário/Super Admin
  'admin',              -- P1: Admin/Gerente Geral
  'financial',          -- P2: Financeiro
  'purchasing',         -- P3: Compras
  'stock_production',   -- P4: Estoque/Produção (CD)
  'store_manager',      -- P5: Gerente de Loja
  'cashier',            -- P6: Operador de Caixa
  'counter',            -- P7: Contador (perfil mínimo)
  'checklist_executor', -- P8: Executor Checklist (perfil mínimo)
  'maintenance'         -- P9: Manutenção
);

-- Módulos do sistema
CREATE TYPE public.app_module AS ENUM (
  'M1',  -- Banco Virtual CD
  'M2',  -- Cadastros
  'M3',  -- Compras Integradas
  'M4',  -- Estoque + Produção
  'M5',  -- Financeiro
  'M6',  -- Vendas & Recebíveis
  'M7',  -- Dashboard
  'M8',  -- Relatórios
  'M9',  -- Integrações + IA
  'M10', -- Administração (futuro)
  'M11', -- Contagens & Inventários
  'M12', -- Manutenção & Ativos (futuro)
  'M13', -- Checklists Operacionais
  'M15'  -- Integrações Avançadas (futuro)
);

-- Nível de acesso por módulo
CREATE TYPE public.access_level AS ENUM ('hidden', 'view', 'edit');

-- Tipos de documento
CREATE TYPE public.doc_type AS ENUM (
  'nf_xml',
  'nf_pdf',
  'nf_photo',
  'ofx',
  'receipt',
  'checklist_evidence',
  'other'
);

-- Fonte da ação (auditoria)
CREATE TYPE public.source_type AS ENUM ('user', 'ai', 'system', 'import');

-- Status genéricos para fluxos draft/confirm
CREATE TYPE public.draft_status AS ENUM ('draft', 'confirmed', 'cancelled');

-- Status de pagamento
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- Status de recebíveis
CREATE TYPE public.receivable_status AS ENUM ('pending', 'partial', 'received', 'overdue');

-- Tipos de movimento de estoque
CREATE TYPE public.inventory_move_type AS ENUM ('IN', 'OUT', 'ADJUST');

-- Tipos de lançamento do banco virtual
CREATE TYPE public.virtual_ledger_type AS ENUM ('DEBIT', 'CREDIT', 'ADJUST');
