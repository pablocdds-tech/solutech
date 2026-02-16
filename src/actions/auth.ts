"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type AuthResult = {
  success: boolean;
  error?: string;
  message?: string;
};

// ===========================================
// Login com email e senha
// ===========================================

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "E-mail e senha são obrigatórios" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { success: false, error: "E-mail ou senha incorretos" };
    }
    if (error.message.includes("Email not confirmed")) {
      return { success: false, error: "Confirme seu e-mail antes de entrar" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ===========================================
// Registro de novo usuário
// ===========================================

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  if (!email || !password || !fullName) {
    return { success: false, error: "Todos os campos são obrigatórios" };
  }

  if (password.length < 6) {
    return { success: false, error: "A senha deve ter pelo menos 6 caracteres" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { success: false, error: "Este e-mail já está cadastrado" };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: "Conta criada! Verifique seu e-mail para confirmar o cadastro.",
  };
}

// ===========================================
// Logout
// ===========================================

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ===========================================
// Solicitar reset de senha
// ===========================================

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email") as string;

  if (!email) {
    return { success: false, error: "Informe seu e-mail" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/update-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: "Se o e-mail existir, você receberá um link para redefinir a senha.",
  };
}

// ===========================================
// Atualizar senha (após clicar no link do e-mail)
// ===========================================

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!password || !confirmPassword) {
    return { success: false, error: "Preencha ambos os campos" };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "As senhas não conferem" };
  }

  if (password.length < 6) {
    return { success: false, error: "A senha deve ter pelo menos 6 caracteres" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ===========================================
// Obter dados do usuário logado
// ===========================================

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, stores:user_store_access(store:stores(id, name, type))")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "Usuário",
    role: profile?.role ?? "counter",
    orgId: profile?.org_id ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    stores: (profile?.stores ?? []).map(
      (s: { store: { id: string; name: string; type: string } }) => s.store
    ),
  };
}
