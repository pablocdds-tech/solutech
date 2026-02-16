import { PageHeader } from "@/components/ui/page-header";
import { BankBalanceView } from "@/components/financeiro/bank-balance-view";

export default function BancosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Saldos Bancários"
        description="Saldo derivado das transações (SSOT). Não existe saldo editável."
      />
      <BankBalanceView />
    </div>
  );
}
