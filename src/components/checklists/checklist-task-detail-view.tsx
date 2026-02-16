"use client";

import * as React from "react";
import Link from "next/link";
import {
  getTask,
  getTaskItems,
  getTemplateItems,
  respondTaskItem,
  completeTask,
} from "@/actions/checklists";
import type {
  ChecklistTask,
  ChecklistTaskItem,
  ChecklistTemplateItem,
} from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  pending: { label: "Pendente", variant: "warning" },
  in_progress: { label: "Em progresso", variant: "info" },
  completed: { label: "Concluída", variant: "success" },
  expired: { label: "Expirada", variant: "danger" },
};

interface Props {
  taskId: string;
}

export function ChecklistTaskDetailView({ taskId }: Props) {
  const [task, setTask] = React.useState<ChecklistTask | null>(null);
  const [taskItems, setTaskItems] = React.useState<ChecklistTaskItem[]>([]);
  const [templateItems, setTemplateItems] = React.useState<
    ChecklistTemplateItem[]
  >([]);
  const [templateName, setTemplateName] = React.useState<string>("");
  const [storeName, setStoreName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | false>(false);

  const [observationMap, setObservationMap] = React.useState<
    Record<string, string>
  >({});
  const [evidenceMap, setEvidenceMap] = React.useState<Record<string, string>>(
    {}
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const taskRes = await getTask(taskId);

    if (taskRes.success && taskRes.data) {
      setTask(taskRes.data);
      const [itemsRes, templateItemsRes] = await Promise.all([
        getTaskItems(taskId),
        getTemplateItems(taskRes.data.template_id),
      ]);

      if (itemsRes.success && itemsRes.data) {
        setTaskItems(itemsRes.data);
      }
      if (templateItemsRes.success && templateItemsRes.data) {
        setTemplateItems(templateItemsRes.data);
      }

      const supabase = createClient();
      const [templateRes, storeRes] = await Promise.all([
        supabase
          .from("checklist_templates")
          .select("name")
          .eq("id", taskRes.data.template_id)
          .single(),
        supabase
          .from("stores")
          .select("name")
          .eq("id", taskRes.data.store_id)
          .single(),
      ]);
      if (templateRes.data) setTemplateName((templateRes.data as { name: string }).name);
      if (storeRes.data) setStoreName((storeRes.data as { name: string }).name);
    } else {
      setError(taskRes.error ?? "Erro ao carregar tarefa.");
    }

    setLoading(false);
  }, [taskId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const templateItemMap = React.useMemo(() => {
    const m: Record<string, ChecklistTemplateItem> = {};
    templateItems.forEach((t) => (m[t.id] = t));
    return m;
  }, [templateItems]);

  const isCompleted = task?.status === "completed";
  const allResponded =
    taskItems.length > 0 &&
    taskItems.every(
      (ti) => ti.result && ti.result !== "pending"
    );
  const canComplete = allResponded && !isCompleted;

  async function handleRespond(
    taskItemId: string,
    result: "ok" | "nok" | "na"
  ) {
    setActionLoading(taskItemId);
    setError(null);
    const obs = observationMap[taskItemId]?.trim();
    const ev = evidenceMap[taskItemId]?.trim();
    const payload: {
      result: "ok" | "nok" | "na";
      observation?: string;
      evidenceUrl?: string;
    } = { result };
    if (obs) payload.observation = obs;
    if (ev) payload.evidenceUrl = ev;

    const res = await respondTaskItem(taskItemId, payload);
    if (res.success) {
      await loadData();
    } else {
      setError(res.error ?? "Erro ao responder item.");
    }
    setActionLoading(false);
  }

  async function handleComplete() {
    setActionLoading("complete");
    setError(null);
    const result = await completeTask(taskId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao concluir checklist.");
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-white p-6"
          >
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-4 h-4 w-64 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        Tarefa não encontrada.
      </div>
    );
  }

  const scorePct = Number(task.score_pct);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}

      <Link href="/checklists/tarefas">
        <Button variant="outline" size="sm">
          &larr; Voltar
        </Button>
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {templateName || task.template_id.slice(0, 8) + "…"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Badge variant={statusConfig[task.status]?.variant ?? "default"}>
                {statusConfig[task.status]?.label ?? task.status}
              </Badge>
              <span className="text-sm text-slate-600">
                Loja: {storeName || task.store_id.slice(0, 8) + "…"}
              </span>
              <span className="text-sm text-slate-600">
                Data: {formatDate(task.task_date)}
              </span>
              <span className="text-sm text-slate-600">
                NOK: {task.nok_items}
              </span>
            </div>
            <div className="mt-2">
              <span
                className={`text-3xl font-bold ${
                  scorePct >= 100
                    ? "text-success"
                    : scorePct >= 80
                      ? "text-slate-700"
                      : "text-danger"
                }`}
              >
                {scorePct.toFixed(0)}%
              </span>
              <span className="ml-2 text-sm text-slate-600">score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-4">
        {taskItems.map((ti) => {
          const tpl = templateItemMap[ti.template_item_id];
          const responded = ti.result && ti.result !== "pending";

          return (
            <div
              key={ti.id}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h3 className="font-semibold text-slate-900">
                  {tpl?.title ?? ti.template_item_id.slice(0, 8) + "…"}
                </h3>
                {tpl?.description && (
                  <p className="mt-1 text-sm text-slate-600">{tpl.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {tpl?.requires_evidence && (
                    <Badge variant="info">Exige evidência</Badge>
                  )}
                  {tpl?.is_critical && (
                    <Badge variant="danger">Crítico</Badge>
                  )}
                </div>
              </div>

              {!responded && (
                <div className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Responder
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespond(ti.id, "ok")}
                      loading={actionLoading === ti.id}
                      className="border-success/50 text-success hover:bg-success/10"
                    >
                      OK
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespond(ti.id, "nok")}
                      loading={actionLoading === ti.id}
                      className="border-danger/50 text-danger hover:bg-danger/10"
                    >
                      NOK
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespond(ti.id, "na")}
                      loading={actionLoading === ti.id}
                      className="border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      N/A
                    </Button>
                  </div>
                  <Input
                    label="Observação"
                    type="text"
                    value={observationMap[ti.id] ?? ""}
                    onChange={(e) =>
                      setObservationMap((prev) => ({
                        ...prev,
                        [ti.id]: e.target.value,
                      }))
                    }
                    placeholder="Opcional"
                  />
                  {tpl?.requires_evidence && (
                    <Input
                      label="URL da evidência"
                      type="url"
                      value={evidenceMap[ti.id] ?? ""}
                      onChange={(e) =>
                        setEvidenceMap((prev) => ({
                          ...prev,
                          [ti.id]: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  )}
                </div>
              )}

              {responded && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      ti.result === "ok"
                        ? "success"
                        : ti.result === "nok"
                          ? "danger"
                          : "default"
                    }
                  >
                    {ti.result?.toUpperCase()}
                  </Badge>
                  {ti.observation && (
                    <span className="text-sm text-slate-600">
                      {ti.observation}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete button */}
      {canComplete && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <Button
            variant="primary"
            onClick={handleComplete}
            loading={actionLoading === "complete"}
          >
            Completar Checklist
          </Button>
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="rounded-xl border-2 border-success/50 bg-success/5 p-6">
          <h3 className="text-lg font-semibold text-success">
            Checklist Concluído
          </h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
            <span>Score: {scorePct.toFixed(0)}%</span>
            <span>NOK: {task.nok_items}</span>
            {task.completed_at && (
              <span>Concluído em: {formatDateTime(task.completed_at)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
