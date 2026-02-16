import { PageHeader } from "@/components/ui/page-header";
import { OfxImportDetailView } from "@/components/conciliacao/ofx-import-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OfxImportDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe da Importação OFX"
        description="Linhas do extrato, sugestões de match e ações de conciliação."
      />
      <OfxImportDetailView importId={id} />
    </div>
  );
}
