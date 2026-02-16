import { PageHeader } from "@/components/ui/page-header";
import { SalesView } from "@/components/vendas/sales-view";

export default function VendasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Registro de vendas por canal e forma de pagamento. Confirmação gera estoque OUT + recebíveis."
      />
      <SalesView />
    </div>
  );
}
