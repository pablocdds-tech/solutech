import { PageHeader } from "@/components/ui/page-header";
import { ArReceivablesView } from "@/components/financeiro/ar-receivables-view";

export default function ContasReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        description="Gerencie recebimentos. Baixa somente com evidência bancária (SSOT)."
      />
      <ArReceivablesView />
    </div>
  );
}
