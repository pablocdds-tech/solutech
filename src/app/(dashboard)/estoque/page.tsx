import { PageHeader } from "@/components/ui/page-header";
import { InventoryBalanceView } from "@/components/estoque/inventory-balance-view";

export default function EstoquePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Posição de Estoque"
        description="Saldo atual de estoque por loja e item. Todos os saldos são derivados dos movimentos (SSOT)."
      />
      <InventoryBalanceView />
    </div>
  );
}
