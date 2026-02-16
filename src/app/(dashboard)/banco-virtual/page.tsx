import { PageHeader } from "@/components/ui/page-header";
import { VirtualBalanceView } from "@/components/banco-virtual/virtual-balance-view";

export default function BancoVirtualPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco Virtual CD"
        description="Saldo virtual entre o CD e cada loja. DEBIT = loja deve ao CD. Saldo derivado dos lançamentos (SSOT)."
      />
      <VirtualBalanceView />
    </div>
  );
}
