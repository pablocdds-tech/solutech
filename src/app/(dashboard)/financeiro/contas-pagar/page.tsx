import { PageHeader } from "@/components/ui/page-header";
import { ApPayablesView } from "@/components/financeiro/ap-payables-view";

export default function ContasPagarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        description="Gerencie pagamentos. Baixa somente com evidência bancária (SSOT)."
      />
      <ApPayablesView />
    </div>
  );
}
