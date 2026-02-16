import { getAiTask, getAiTaskSteps } from "@/actions/ia-executora";
import { AiTaskDetailView } from "@/components/ia-executora/ai-task-detail-view";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AiTaskDetailPage({ params }: Props) {
  const { id } = await params;

  const [taskResult, stepsResult] = await Promise.all([
    getAiTask(id),
    getAiTaskSteps(id),
  ]);

  if (!taskResult.success || !taskResult.data) {
    notFound();
  }

  return (
    <AiTaskDetailView
      task={taskResult.data}
      steps={stepsResult.data ?? []}
    />
  );
}
