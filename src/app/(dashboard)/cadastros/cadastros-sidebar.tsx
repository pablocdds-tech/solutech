"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EntityConfig } from "@/lib/cadastros/entity-configs";
import { cn } from "@/lib/utils";

interface CadastrosSidebarProps {
  entities: EntityConfig[];
}

export function CadastrosSidebar({ entities }: CadastrosSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-6 space-y-0.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-500">Cadastros</h2>
      </div>
      {entities.map((config) => {
        const isActive = pathname === config.routePath;
        return (
          <Link
            key={config.table}
            href={config.routePath}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {config.namePlural}
          </Link>
        );
      })}
    </nav>
  );
}
