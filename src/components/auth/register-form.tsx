"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signUp(formData);
      if (!result.success) {
        setError(result.error ?? "Erro ao criar conta");
      } else {
        router.push("/login?registered=1");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="full_name"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Nome completo
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            placeholder="Seu nome"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </div>

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
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Fazer login
        </Link>
      </p>
    </>
  );
}
