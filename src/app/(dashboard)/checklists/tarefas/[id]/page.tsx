import { PageHeader } from "@/components/ui/page-header";
import { ChecklistTaskDetailView } from "@/components/checklists/checklist-task-detail-view";

interface Props { params: Promise<{ id: string }>; }

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="Executar Checklist" description="Responder itens com evidências." />
      <ChecklistTaskDetailView taskId={id} />
    </div>
  );
}
