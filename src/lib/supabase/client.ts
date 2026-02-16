import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no BROWSER (Client Components).
 * Utiliza a anon key pública — segurança via RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
