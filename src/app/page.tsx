import { redirect } from "next/navigation";

/**
 * Rota raiz: redireciona para o dashboard.
 * Quando a autenticação estiver ativa, o middleware
 * enviará usuários não-autenticados para /login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
