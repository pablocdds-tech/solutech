import { PageHeader } from "@/components/ui/page-header";
import { InternalOrderDetailView } from "@/components/cd-loja/internal-order-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InternalOrderDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe do Pedido Interno"
        description="Itens do pedido e ações de confirmação."
      />
      <InternalOrderDetailView orderId={id} />
    </div>
  );
}
