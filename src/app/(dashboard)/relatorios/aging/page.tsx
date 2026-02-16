import { PageHeader } from "@/components/ui/page-header";
import { AgingView } from "@/components/relatorios/aging-view";

export default function AgingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Aging — Contas a Pagar e Receber" description="Análise de vencimentos por faixa." />
      <AgingView />
    </div>
  );
}
