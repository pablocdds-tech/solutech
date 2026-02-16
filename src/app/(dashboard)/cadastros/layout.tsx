import { entityConfigs } from "@/lib/cadastros/entity-configs";
import { CadastrosSidebar } from "./cadastros-sidebar";

const ENTITIES = Object.values(entityConfigs).filter(
  (c) => c.table !== "item_prices"
);

export default function CadastrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6">
      {/* Sidebar — visível no desktop, oculta no mobile */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <CadastrosSidebar entities={ENTITIES} />
      </aside>

      {/* Conteúdo principal */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
