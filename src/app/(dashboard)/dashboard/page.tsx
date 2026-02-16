import { PageHeader } from "@/components/ui/page-header";
import { DashboardView } from "@/components/relatorios/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral consolidada e por loja. KPIs derivados em tempo real."
      />
      <DashboardView />
    </div>
  );
}
