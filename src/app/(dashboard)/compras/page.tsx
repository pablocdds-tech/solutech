import { PageHeader } from "@/components/ui/page-header";
import { ReceivingListView } from "@/components/compras/receiving-list-view";

export default function ComprasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras / Recebimentos NF"
        description="Gerencie recebimentos de notas fiscais. Fluxo: rascunho → itens → pagamento → confirmação."
      />
      <ReceivingListView />
    </div>
  );
}
