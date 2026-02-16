"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/actions/auth";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await resetPassword(formData);
      if (!result.success) {
        setError(result.error ?? "Erro ao enviar e-mail");
      } else {
        setSuccess(result.message ?? "E-mail enviado!");
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

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Voltar ao login
        </Link>
      </p>
    </>
  );
}
