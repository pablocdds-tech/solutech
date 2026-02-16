import { PageHeader } from "@/components/ui/page-header";
import { ReceivingDetailView } from "@/components/compras/receiving-detail-view";

interface ReceivingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceivingDetailPage({ params }: ReceivingDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe do Recebimento"
        description="Gerencie itens, plano de pagamento e confirme o recebimento."
      />
      <ReceivingDetailView receivingId={id} />
    </div>
  );
}
