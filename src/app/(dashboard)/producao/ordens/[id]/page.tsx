import { PageHeader } from "@/components/ui/page-header";
import { ProductionOrderDetailView } from "@/components/producao/production-order-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductionOrderDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe da Ordem de Produção"
        description="Consumos, perdas e finalização atômica."
      />
      <ProductionOrderDetailView orderId={id} />
    </div>
  );
}
