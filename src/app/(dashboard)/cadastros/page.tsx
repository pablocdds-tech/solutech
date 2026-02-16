import type { Metadata } from "next";
import Link from "next/link";
import { entityConfigs } from "@/lib/cadastros/entity-configs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cadastros",
  description: "Gerenciamento de cadastros do sistema",
};

const CATEGORIES: {
  title: string;
  tables: string[];
  description: string;
}[] = [
  {
    title: "Produtos",
    description: "Itens, grupos de ingredientes e unidades de medida",
    tables: ["items", "ingredient_groups", "units"],
  },
  {
    title: "Comercial",
    description: "Fornecedores, canais de venda e formas de pagamento",
    tables: ["suppliers", "sales_channels", "payment_methods"],
  },
  {
    title: "Financeiro",
    description: "Categorias financeiras, centros de custo e contas bancárias",
    tables: ["finance_categories", "cost_centers", "bank_accounts"],
  },
  {
    title: "Operacional",
    description: "Motivos de ajuste de estoque",
    tables: ["adjustment_reasons"],
  },
];

export default function CadastrosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Cadastros
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gerencie as entidades e configurações do sistema.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{cat.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{cat.description}</p>
            <ul className="mt-4 space-y-2">
              {cat.tables.map((table) => {
                const config = entityConfigs[table];
                if (!config) return null;
                return (
                  <li key={config.table}>
                    <Link
                      href={config.routePath}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm font-medium",
                        "text-primary-600 hover:bg-primary-50 hover:text-primary-700",
                        "transition-colors"
                      )}
                    >
                      {config.namePlural}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
