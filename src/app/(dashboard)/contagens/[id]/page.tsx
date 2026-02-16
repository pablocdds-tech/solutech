import { PageHeader } from "@/components/ui/page-header";
import { InventoryCountDetailView } from "@/components/contagens/inventory-count-detail-view";

interface Props { params: Promise<{ id: string }>; }

export default async function CountDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="Detalhe da Contagem" description="Itens a contar, divergências e aprovação." />
      <InventoryCountDetailView countId={id} />
    </div>
  );
}
