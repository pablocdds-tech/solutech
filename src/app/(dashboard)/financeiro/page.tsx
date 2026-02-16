import { PageHeader } from "@/components/ui/page-header";
import { FinanceiroHubView } from "@/components/financeiro/financeiro-hub-view";

export default function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar, contas a receber, saldos bancários e caixa."
      />
      <FinanceiroHubView />
    </div>
  );
}
