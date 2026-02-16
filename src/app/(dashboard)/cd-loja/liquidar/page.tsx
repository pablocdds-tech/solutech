import { PageHeader } from "@/components/ui/page-header";
import { SettleVirtualView } from "@/components/cd-loja/settle-virtual-view";

export default function LiquidarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Liquidar Banco Virtual"
        description="Pagamento real para abater saldo virtual. Gera: bank_tx DEBIT + CREDIT ledger + baixa AP."
      />
      <SettleVirtualView />
    </div>
  );
}
