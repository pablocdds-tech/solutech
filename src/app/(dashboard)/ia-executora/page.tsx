import { listAiTasks, getAiTasksStats } from "@/actions/ia-executora";
import { AiTasksView } from "@/components/ia-executora/ai-tasks-view";

export default async function IaExecutoraPage() {
  const [tasksResult, statsResult] = await Promise.all([
    listAiTasks(),
    getAiTasksStats(),
  ]);

  return (
    <AiTasksView
      initialTasks={tasksResult.data ?? []}
      initialStats={statsResult.data ?? { pending_review: 0, executing: 0, completed: 0, failed: 0 }}
    />
  );
}
