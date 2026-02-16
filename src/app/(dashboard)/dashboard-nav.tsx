"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cadastros", label: "Cadastros" },
  { href: "/compras", label: "Compras / NF" },
  { href: "/vendas", label: "Vendas" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/estoque", label: "Estoque" },
  { href: "/producao", label: "Produção" },
  { href: "/cd-loja", label: "CD → Loja" },
  { href: "/conciliacao", label: "Conciliação OFX" },
  { href: "/banco-virtual", label: "Banco Virtual" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 space-y-1 px-3">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-active/20 text-white"
                : "text-slate-300 hover:bg-sidebar-active/20 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
