# Publicar na Vercel — Passo a passo

## 1. Conta e repositório

- Acesse [vercel.com](https://vercel.com) e faça login (ou crie conta com GitHub).
- O código já está no GitHub: **https://github.com/pablocdds-tech/solutech**
- Se ainda não conectou o repo à Vercel, faça isso no passo 2.

## 2. Novo projeto na Vercel

1. No dashboard da Vercel: **Add New…** → **Project**.
2. **Import** o repositório `pablocdds-tech/solutech` (conecte o GitHub se pedir).
3. **Framework Preset:** Next.js (já detectado).
4. **Root Directory:** deixe em branco.
5. **Build Command:** `next build` (padrão).
6. **Output Directory:** `.next` (padrão).
7. **Install Command:** `npm install` (padrão).

## 3. Variáveis de ambiente

Em **Environment Variables** do projeto, adicione:

| Nome | Valor | Observação |
|------|--------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://aqwdkteirkriguqgiwyk.supabase.co` | Sua URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (sua anon key) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | (sua service role key) | Supabase → Settings → API (não exponha no front) |
| `NEXT_PUBLIC_SITE_URL` | `https://seu-app.vercel.app` | Troque depois do 1º deploy pela URL real |
| `NEXT_PUBLIC_APP_URL` | Mesmo que `NEXT_PUBLIC_SITE_URL` | Ex.: `https://solutech.vercel.app` |

- **Sentry** (opcional): se usar, adicione `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

Marque as variáveis para **Production**, **Preview** e **Development** se quiser que valham em todos os ambientes.

## 4. Deploy

1. Clique em **Deploy**.
2. Aguarde o build (alguns minutos).
3. Ao terminar, a Vercel mostra a URL (ex.: `https://solutech-xxx.vercel.app`).

## 5. Depois do primeiro deploy

1. Copie a URL real do projeto (ex.: `https://solutech.vercel.app`).
2. Em **Settings** → **Environment Variables**, edite:
   - `NEXT_PUBLIC_SITE_URL` = essa URL
   - `NEXT_PUBLIC_APP_URL` = essa URL
3. **Redeploy** (Deployments → ⋮ no último deploy → Redeploy) para o app usar a URL correta (auth callbacks, etc.).

## 6. Supabase (Auth)

No **Supabase** → **Authentication** → **URL Configuration**:

- **Site URL:** `https://sua-url.vercel.app`
- **Redirect URLs:** adicione `https://sua-url.vercel.app/**` e `https://sua-url.vercel.app/auth/callback`

Assim o login e o callback funcionam em produção.

---

Resumo: conectar repo → configurar env vars (Supabase + URL do app) → Deploy → ajustar URL no Supabase e nas env vars → redeploy se precisar.
