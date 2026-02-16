"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
          <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Sem conexão</h1>
        <p className="mt-2 text-sm text-slate-500">
          Verifique sua conexão com a internet e tente novamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
