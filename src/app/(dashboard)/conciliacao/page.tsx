import { PageHeader } from "@/components/ui/page-header";
import { OfxImportsView } from "@/components/conciliacao/ofx-imports-view";

export default function ConciliacaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Conciliação OFX"
        description="Importar extratos OFX, conciliar linhas com AP/AR/transações. Idempotente e reversível."
      />
      <OfxImportsView />
    </div>
  );
}
