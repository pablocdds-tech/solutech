"use client";

import { useState } from "react";
import { updatePassword } from "@/actions/auth";

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const result = await updatePassword(formData);
      if (!result.success) {
        setError(result.error ?? "Erro ao atualizar senha");
      }
    } catch {
      // redirect() throws, expected
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
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Nova senha
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

        <div>
          <label
            htmlFor="confirm_password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Repita a senha"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Definir nova senha"}
        </button>
      </form>
    </>
  );
}
