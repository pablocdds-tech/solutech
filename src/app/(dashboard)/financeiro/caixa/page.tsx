import { PageHeader } from "@/components/ui/page-header";
import { CashSessionsView } from "@/components/financeiro/cash-sessions-view";

export default function CaixaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Caixa"
        description="Abertura e fechamento de caixa por loja."
      />
      <CashSessionsView />
    </div>
  );
}
