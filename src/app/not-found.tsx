import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary-600">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-slate-800">
          Página não encontrada
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          A página que você procura não existe ou foi movida.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-4 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
