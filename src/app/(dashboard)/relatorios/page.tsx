import { PageHeader } from "@/components/ui/page-header";
import { ReportsHubView } from "@/components/relatorios/reports-hub-view";

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Relatórios derivados. Nunca armazenam resultados, somente calculam." />
      <ReportsHubView />
    </div>
  );
}
