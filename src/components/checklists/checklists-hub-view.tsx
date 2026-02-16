"use client";

import { useRouter } from "next/navigation";

const cards = [
  {
    emoji: "📋",
    title: "Templates",
    description: "Modelos de checklists com itens configuráveis.",
    href: "/checklists/templates",
  },
  {
    emoji: "✅",
    title: "Tarefas",
    description: "Checklists atribuídos e em execução.",
    href: "/checklists/tarefas",
  },
];

export function ChecklistsHubView() {
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
