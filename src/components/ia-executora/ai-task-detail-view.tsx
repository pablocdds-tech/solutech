"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AiTask, AiTaskStep } from "@/types/database";
import {
  approveAiTask,
  rejectAiTask,
  cancelAiTask,
  startAiTaskExecution,
  executeAiStep,
} from "@/actions/ia-executora";

interface Props {
  task: AiTask;
  steps: AiTaskStep[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  planning: { label: "Planejando", variant: "info" },
  pending_review: { label: "Aguardando Revisão", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  executing: { label: "Executando", variant: "info" },
  completed: { label: "Concluída", variant: "success" },
  failed: { label: "Falhou", variant: "danger" },
  rejected: { label: "Rejeitada", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "default" },
};

const stepStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-slate-500" },
  executing: { label: "Executando", color: "bg-blue-500 animate-pulse" },
  completed: { label: "Concluído", color: "bg-green-500" },
  failed: { label: "Falhou", color: "bg-red-500" },
  skipped: { label: "Pulado", color: "bg-slate-600" },
};

export function AiTaskDetailView({ task, steps }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const taskCfg = statusConfig[task.status] ?? statusConfig.cancelled;

  const handleApprove = async () => {
    setLoading("approve");
    setError(null);
    try {
      const result = await approveAiTask(task.id, reviewNotes || undefined);
      if (!result.success) {
        setError(result.error ?? "Erro ao aprovar");
      } else {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    setError(null);
    try {
      const result = await rejectAiTask(task.id, reviewNotes || undefined);
      if (!result.success) {
        setError(result.error ?? "Erro ao rejeitar");
      } else {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Deseja cancelar esta tarefa IA?")) return;
    setLoading("cancel");
    setError(null);
    try {
      const result = await cancelAiTask(task.id);
      if (!result.success) {
        setError(result.error ?? "Erro ao cancelar");
      } else {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleStartExecution = async () => {
    setLoading("start");
    setError(null);
    try {
      const result = await startAiTaskExecution(task.id);
      if (!result.success) {
        setError(result.error ?? "Erro ao iniciar execução");
        return;
      }

      // Executar cada step sequencialmente
      for (const step of steps) {
        if (step.status !== "pending") continue;

        const startTime = Date.now();

        // Simular execução (em produção, chamaria o Action Catalog real)
        const stepResult = await executeAiStep(
          step.id,
          { message: `Step ${step.step_order} executado via ${step.action_catalog}` },
          true,
          undefined,
          undefined,
          Date.now() - startTime
        );

        if (!stepResult.success) {
          setError(`Falha no step ${step.step_order}: ${stepResult.error}`);
          break;
        }
      }

      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const progressPct = task.total_steps > 0
    ? Math.round((task.completed_steps / task.total_steps) * 100)
    : 0;

  return (
    <div>
      <Link href="/ia-executora" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        &larr; Voltar para IA Executora
      </Link>

      <PageHeader
        title={task.title}
        description={task.intent}
      >
        {task.status === "pending_review" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReject} disabled={loading !== null}>
              {loading === "reject" ? "Rejeitando..." : "Rejeitar"}
            </Button>
            <Button onClick={handleApprove} disabled={loading !== null}>
              {loading === "approve" ? "Aprovando..." : "Aprovar Plano"}
            </Button>
          </div>
        )}
        {task.status === "approved" && (
          <Button onClick={handleStartExecution} disabled={loading !== null}>
            {loading === "start" ? "Executando..." : "Iniciar Execução"}
          </Button>
        )}
        {!["completed", "failed", "rejected", "cancelled"].includes(task.status) && (
          <Button variant="outline" onClick={handleCancel} disabled={loading !== null}>
            Cancelar
          </Button>
        )}
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Status & Info */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-slate-400">Status</div>
          <div className="mt-1">
            <Badge variant={taskCfg.variant}>{taskCfg.label}</Badge>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-400">Progresso</div>
          <div className="mt-1 text-lg font-bold text-white">
            {task.completed_steps} / {task.total_steps} steps
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                task.status === "failed" ? "bg-red-500" : "bg-green-500"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-400">Criado em</div>
          <div className="mt-1 text-sm text-white">{formatDate(task.created_at)}</div>
          {task.completed_at && (
            <>
              <div className="mt-2 text-xs text-slate-400">Concluído em</div>
              <div className="mt-1 text-sm text-white">{formatDate(task.completed_at)}</div>
            </>
          )}
        </Card>
      </div>

      {/* Plano / Descrição */}
      {(task.description || task.plan_summary) && (
        <Card className="mb-6 p-4">
          <h3 className="text-sm font-semibold text-slate-300">Detalhes do Plano</h3>
          {task.description && (
            <p className="mt-2 text-sm text-slate-400">{task.description}</p>
          )}
          {task.plan_summary && (
            <div className="mt-2 rounded-lg bg-slate-700/50 p-3 text-sm text-slate-300">
              {task.plan_summary}
            </div>
          )}
        </Card>
      )}

      {/* Notas de Revisão */}
      {task.status === "pending_review" && (
        <Card className="mb-6 p-4">
          <h3 className="text-sm font-semibold text-slate-300">Notas de Revisão</h3>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Adicione notas antes de aprovar/rejeitar (opcional)..."
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400"
          />
        </Card>
      )}

      {task.review_notes && (
        <Card className="mb-6 border-yellow-500/20 p-4">
          <h3 className="text-sm font-semibold text-yellow-300">Notas do Revisor</h3>
          <p className="mt-2 text-sm text-slate-300">{task.review_notes}</p>
          {task.reviewed_at && (
            <p className="mt-1 text-xs text-slate-500">Revisado em {formatDate(task.reviewed_at)}</p>
          )}
        </Card>
      )}

      {/* Erro */}
      {task.error_message && (
        <Card className="mb-6 border-red-500/20 p-4">
          <h3 className="text-sm font-semibold text-red-300">Erro na Execução</h3>
          <p className="mt-2 text-sm text-red-200">{task.error_message}</p>
        </Card>
      )}

      {/* Steps / Pipeline */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-300">
          Pipeline de Execução ({steps.length} steps)
        </h3>

        {steps.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum step definido ainda.</p>
        ) : (
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const sCfg = stepStatusConfig[step.status] ?? stepStatusConfig.pending;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-lg border p-4",
                    step.status === "completed"
                      ? "border-green-500/20 bg-green-500/5"
                      : step.status === "failed"
                        ? "border-red-500/20 bg-red-500/5"
                        : step.status === "executing"
                          ? "border-blue-500/20 bg-blue-500/5"
                          : "border-slate-700 bg-slate-800/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Step indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white",
                            sCfg.color
                          )}
                        >
                          {step.step_order}
                        </div>
                        {idx < steps.length - 1 && (
                          <div className="mt-1 h-6 w-px bg-slate-600" />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-white">{step.description}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Action: <code className="rounded bg-slate-700 px-1.5 py-0.5">{step.action_catalog}</code>
                        </p>
                        {step.duration_ms != null && (
                          <p className="mt-1 text-xs text-slate-500">{step.duration_ms}ms</p>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={
                        step.status === "completed"
                          ? "success"
                          : step.status === "failed"
                            ? "danger"
                            : step.status === "executing"
                              ? "info"
                              : "default"
                      }
                    >
                      {sCfg.label}
                    </Badge>
                  </div>

                  {/* Resultado do step */}
                  {step.result && (
                    <div className="mt-3 rounded bg-slate-700/50 p-2 text-xs text-slate-300">
                      <pre className="overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(step.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Erro do step */}
                  {step.error_message && (
                    <div className="mt-3 rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
                      {step.error_message}
                    </div>
                  )}

                  {/* Registros criados */}
                  {step.created_records && (
                    <div className="mt-2 text-xs text-slate-500">
                      Registros criados: {JSON.stringify(step.created_records)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Contexto (debug) */}
      {task.context && (
        <Card className="mt-4 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Contexto (debug)</h3>
          <pre className="overflow-x-auto text-xs text-slate-400">
            {JSON.stringify(task.context, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
