import { PageHeader } from "@/components/ui/page-header";
import { ChecklistsHubView } from "@/components/checklists/checklists-hub-view";

export default function ChecklistsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Checklists Operacionais" description="Templates, tarefas agendadas, evidências e ranking." />
      <ChecklistsHubView />
    </div>
  );
}
