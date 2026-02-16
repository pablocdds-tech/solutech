import { PageHeader } from "@/components/ui/page-header";
import { InventoryMovesView } from "@/components/estoque/inventory-moves-view";

export default function MovimentosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentos de Estoque"
        description="Histórico completo de entradas, saídas e ajustes. Registros imutáveis."
      />
      <InventoryMovesView />
    </div>
  );
}
