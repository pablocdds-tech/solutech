"use client";

import Link from "next/link";

const sections = [
  {
    title: "Contas a Pagar",
    description: "AP — Gerencie pagamentos a fornecedores e despesas.",
    href: "/financeiro/contas-pagar",
    color: "border-danger/30 bg-danger/5",
    icon: (
      <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "Contas a Receber",
    description: "AR — Gerencie recebíveis de vendas e serviços.",
    href: "/financeiro/contas-receber",
    color: "border-success/30 bg-success/5",
    icon: (
      <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Saldos Bancários",
    description: "Saldo derivado das transações. Conciliação e extrato.",
    href: "/financeiro/bancos",
    color: "border-primary-200 bg-primary-50",
    icon: (
      <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: "Controle de Caixa",
    description: "Abertura e fechamento de caixa por loja.",
    href: "/financeiro/caixa",
    color: "border-warning/30 bg-warning/5",
    icon: (
      <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function FinanceiroHubView() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className={`group rounded-xl border p-6 transition-shadow hover:shadow-md ${section.color}`}
        >
          <div className="flex items-start gap-4">
            {section.icon}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-primary-700">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{section.description}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
