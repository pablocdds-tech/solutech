# Vitaliano ERP

Sistema ERP Multi-loja para gestão integrada de estoque, compras, financeiro, produção e operações.

## Stack

| Camada         | Tecnologia                                  |
|----------------|---------------------------------------------|
| Frontend       | Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 |
| Backend/DB     | Supabase (Postgres, Auth, RLS, Realtime, Storage) |
| Ações Críticas | Supabase Edge Functions / SQL RPC            |
| Deploy         | Vercel                                       |
| Observabilidade| Sentry + Vercel Logs                         |
| Multi-loja     | Tenant por `org_id` + `store_id` + RLS       |

## Unidades

- **Vitaliano NB** — Loja
- **Vitaliano Praça** — Loja
- **CD Vitaliano** — Centro de Distribuição (sem conta bancária real)

## Pré-requisitos

- Node.js 18+
- npm 9+
- Conta no [Supabase](https://supabase.com) com projeto criado
- (Opcional) Conta no [Sentry](https://sentry.io) para observabilidade

## Setup Local

```bash
# 1. Clonar o repositório
git clone <url-do-repo>
cd SOLUTECH

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas chaves do Supabase e Sentry

# 4. Executar migrações no Supabase
# Copie e execute cada arquivo SQL de supabase/migrations/ no SQL Editor do Supabase
# na ordem: 00001 → 00002 → 00003 → 00004 → 00005 → 00006 (dev only)

# 5. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts Disponíveis

| Comando              | Descrição                           |
|----------------------|-------------------------------------|
| `npm run dev`        | Servidor de desenvolvimento (Turbopack) |
| `npm run build`      | Build de produção                   |
| `npm run start`      | Servidor de produção                |
| `npm run lint`       | Verificar linting (ESLint)          |
| `npm run lint:fix`   | Corrigir linting automaticamente    |
| `npm run format`     | Formatar código (Prettier)          |
| `npm run format:check` | Verificar formatação              |
| `npm run type-check` | Verificar tipos (TypeScript)        |

## Estrutura de Pastas

```
SOLUTECH/
├── .env.example                  # Template de variáveis de ambiente
├── .eslintrc... → eslint.config.mjs
├── .gitignore
├── .prettierrc / .prettierignore
├── next.config.ts                # Next.js + Sentry wrapper
├── package.json
├── postcss.config.mjs            # Tailwind CSS v4
├── tsconfig.json
├── sentry.*.config.ts            # Sentry (client, server, edge)
├── public/
├── supabase/
│   └── migrations/               # SQL migrations (executar na ordem)
│       ├── 00001_extensions_and_enums.sql
│       ├── 00002_core_tables.sql
│       ├── 00003_helper_functions.sql
│       ├── 00004_rls_policies.sql
│       ├── 00005_audit_and_documents.sql
│       └── 00006_seed_dev.sql
└── src/
    ├── app/                      # Next.js App Router
    │   ├── (auth)/               # Route group: autenticação
    │   │   └── login/
    │   ├── (dashboard)/          # Route group: área logada
    │   │   └── dashboard/
    │   ├── api/health/           # Health check endpoint
    │   ├── layout.tsx / page.tsx
    │   ├── error.tsx / global-error.tsx
    │   ├── not-found.tsx / loading.tsx
    │   └── globals.css           # Tailwind + design tokens
    ├── actions/                  # Server Actions (Action Catalog)
    ├── components/
    │   ├── ui/                   # Componentes base (botões, inputs, etc)
    │   ├── layout/               # Shell, sidebar, header
    │   └── shared/               # Componentes reutilizáveis
    ├── constants/                # Constantes do domínio
    ├── hooks/                    # React hooks customizados
    ├── lib/
    │   ├── supabase/             # Clientes Supabase (client, server, middleware)
    │   └── utils.ts              # Utilitários (cn, formatCurrency, etc)
    ├── services/                 # Lógica de negócio (audit, etc)
    ├── stores/                   # Estado global (Zustand, etc)
    ├── types/                    # TypeScript types do domínio
    │   ├── index.ts              # Enums e tipos base
    │   └── database.ts           # Tipos das tabelas
    ├── instrumentation.ts        # Sentry instrumentation
    └── middleware.ts             # Auth middleware (Supabase session)
```

## Migrações SQL

As migrações devem ser executadas **na ordem numérica** no SQL Editor do Supabase:

1. `00001` — Extensions (uuid, pgcrypto) + Enums do domínio
2. `00002` — Tabelas core (orgs, stores, profiles, user_store_access, module_permissions)
3. `00003` — Helper functions (auth.org_id, auth.has_store_access, etc.) + trigger de signup
4. `00004` — Políticas RLS para todas as tabelas core
5. `00005` — audit_logs (imutável) + documents + document_links
6. `00006` — Seed de desenvolvimento (org + 3 lojas) — **apenas dev**

## Segurança

- **RLS habilitado** em 100% das tabelas
- **org_id obrigatório** em toda linha — isolamento por tenant
- **store_id** controlado via `user_store_access` — isolamento por loja
- **audit_logs imutável** — sem UPDATE/DELETE permitido
- **Roles RBAC** (P0-P9) verificadas via helper functions
- **Sentry** integrado para captura de erros em tempo real
