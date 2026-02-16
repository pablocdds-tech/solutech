import { PageHeader } from "@/components/ui/page-header";
import { SaleDetailView } from "@/components/vendas/sale-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SaleDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe da Venda"
        description="Itens, pagamentos e confirmação."
      />
      <SaleDetailView saleId={id} />
    </div>
  );
}
