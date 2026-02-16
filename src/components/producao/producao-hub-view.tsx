"use client";

import { useRouter } from "next/navigation";

const cards = [
  {
    emoji: "📋",
    title: "Fichas Técnicas",
    description: "Receitas com insumos, rendimento e percentual de perda.",
    href: "/producao/fichas",
  },
  {
    emoji: "🏭",
    title: "Ordens de Produção",
    description: "Criar, iniciar e finalizar ordens de produção.",
    href: "/producao/ordens",
  },
  {
    emoji: "📊",
    title: "CMV",
    description: "Custo de Mercadoria Vendida derivado de movimentos de estoque.",
    href: "/producao/cmv",
  },
  {
    emoji: "🏠",
    title: "Voltar ao Dashboard",
    description: "Retornar ao painel principal.",
    href: "/dashboard",
  },
];

export function ProducaoHubView() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {cards.map((card) => (
        <button
          key={card.href}
          type="button"
          onClick={() => router.push(card.href)}
          className="group rounded-xl border border-slate-200 bg-white p-6 text-left transition-shadow hover:shadow-md hover:border-primary-200"
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl" role="img" aria-hidden>
              {card.emoji}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-primary-700">
                {card.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{card.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
