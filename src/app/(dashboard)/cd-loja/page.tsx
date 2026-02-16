import { PageHeader } from "@/components/ui/page-header";
import { InternalOrdersView } from "@/components/cd-loja/internal-orders-view";

export default function CdLojaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CD → Loja (Pedidos Internos)"
        description="Transferências do CD para lojas. Confirmação gera: estoque OUT CD + IN loja + débito virtual."
      />
      <InternalOrdersView />
    </div>
  );
}
