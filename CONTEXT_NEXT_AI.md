# Contexto para a próxima IA

Projeto: **Vitaliano ERP (Multi-loja + CD)** — Next.js 15, Supabase, TypeScript.

## Estado atual

- **Fases 0–11** do blueprint implementadas (setup, banco, cadastros, estoque, banco virtual, compras/NF, financeiro, CD→Loja, produção, OFX, vendas, contagens/checklists/notificações, relatórios/dashboard).
- **IA Executora** (Plan → Confirm → Execute) implementada.
- **Auth real:** login, registro, reset/update password, middleware, header com usuário e lojas.
- **Seed:** `00018_seed_completo.sql` e `00019_seed_user_bind.sql` (UUID do usuário já substituído). `00020_seed_cd_loja_teste.sql` para pedidos CD→Loja.
- **M10 Administração:** gestão de usuários e lojas (owner/admin).
- **Importação OFX** (parser + UI) e **Importação NF-e XML** (parser + UI), **convite de usuários** (admin).
- **CD→Loja** refatorado: lista com origem/destino/status/total, detalhe com linhas, preço da tabela `item_prices`, confirmação atômica (RPC), seed de teste.
- **Deploy:** `vercel.json` com região `gru1` e headers de segurança. Instruções em `DEPLOY_VERCEL.md`.

## Onde está o quê

- **SQL:** `supabase/migrations/` — rodar no SQL Editor do Supabase (não há CLI rodando migrations).
- **Actions:** `src/actions/` (auth, admin, cadastros, estoque, compras, cd-loja, financeiro, etc.).
- **UI:** `src/app/(dashboard)/` (rotas), `src/components/` (views por módulo).
- **Definição de “pronto”:** `definition_of_done.md`.

## Próximos passos sugeridos

1. Publicar na Vercel (seguir `DEPLOY_VERCEL.md`).
2. Configurar no Supabase a URL do site e redirect URLs para o domínio da Vercel.
3. Testes manuais em produção (login, CD→Loja, um fluxo de compras e financeiro).
4. Opcional: Sentry em produção; PWA já configurado.

## Observações

- **PowerShell:** usuário habilitou scripts com `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` para `npm run dev` funcionar.
- **Erro “this page isn’t working”:** foram feitas proteções no layout, `getCurrentUser`, header e na lista CD→Loja; existe `(dashboard)/error.tsx` para erros não tratados.
- Banco: Supabase já em uso; migrations aplicadas manualmente pelo usuário.
