import { PageHeader } from "@/components/ui/page-header";
import { InventoryCountsView } from "@/components/contagens/inventory-counts-view";

export default function ContagensPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Contagens & Inventários" description="Contagens com link de acesso mínimo. Aprovação gera ajustes ADJUST no estoque." />
      <InventoryCountsView />
    </div>
  );
}
