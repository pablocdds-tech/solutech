import { PageHeader } from "@/components/ui/page-header";
import { LedgerStatementView } from "@/components/banco-virtual/ledger-statement-view";

interface ExtratoPageProps {
  params: Promise<{ storeId: string }>;
}

export default async function ExtratoPage({ params }: ExtratoPageProps) {
  const { storeId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extrato Banco Virtual"
        description="Lançamentos detalhados com saldo acumulado. Registros imutáveis."
      />
      <LedgerStatementView storeId={storeId} />
    </div>
  );
}
