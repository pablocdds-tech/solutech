import { PageHeader } from "@/components/ui/page-header";
import { CmvView } from "@/components/producao/cmv-view";

export default function CmvPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CMV — Custo de Mercadoria Vendida"
        description="CMV derivado de inventory_moves. Nunca digitado."
      />
      <CmvView />
    </div>
  );
}
