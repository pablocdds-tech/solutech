"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-800">
          Algo deu errado
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Ocorreu um erro inesperado. Nossa equipe foi notificada.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-slate-400">
            Código: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
