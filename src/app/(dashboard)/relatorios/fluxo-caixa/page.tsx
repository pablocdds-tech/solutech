import { PageHeader } from "@/components/ui/page-header";
import { CashFlowView } from "@/components/relatorios/cash-flow-view";

export default function FluxoCaixaPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de Caixa" description="Entradas e saídas bancárias por período." />
      <CashFlowView />
    </div>
  );
}
