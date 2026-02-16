import { PageHeader } from "@/components/ui/page-header";
import { TemplatesView } from "@/components/checklists/templates-view";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Templates de Checklist" description="Criar e gerenciar modelos de checklist." />
      <TemplatesView />
    </div>
  );
}
