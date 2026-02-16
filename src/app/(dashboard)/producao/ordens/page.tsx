import { PageHeader } from "@/components/ui/page-header";
import { ProductionOrdersView } from "@/components/producao/production-orders-view";

export default function OrdensPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Produção"
        description="Criar, iniciar e finalizar ordens. Finalização gera movimentos de estoque e custo real."
      />
      <ProductionOrdersView />
    </div>
  );
}
