import { PageHeader } from "@/components/ui/page-header";
import { ChecklistTasksView } from "@/components/checklists/checklist-tasks-view";

export default function TarefasPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas de Checklist" description="Tarefas agendadas e em andamento." />
      <ChecklistTasksView />
    </div>
  );
}
