"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const registered = searchParams.get("registered");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(formData);
      if (!result.success) {
        setError(result.error ?? "Erro ao entrar");
      }
    } catch {
      // redirect() throws, this is expected
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {registered && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Conta criada com sucesso! Verifique seu e-mail e depois faça login.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="redirect" value={redirectTo} />

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Senha
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Não tem conta?{" "}
        <Link
          href="/register"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Criar conta
        </Link>
      </p>
    </>
  );
}
