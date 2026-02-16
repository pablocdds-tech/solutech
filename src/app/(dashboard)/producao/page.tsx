import { PageHeader } from "@/components/ui/page-header";
import { ProducaoHubView } from "@/components/producao/producao-hub-view";

export default function ProducaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Produção"
        description="Fichas técnicas, ordens de produção, consumos, perdas e CMV."
      />
      <ProducaoHubView />
    </div>
  );
}
