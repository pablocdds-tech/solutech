"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import type { AiTask } from "@/types/database";
import { createAiTask, addAiTaskStep, submitAiTaskForReview } from "@/actions/ia-executora";

interface Props {
  initialTasks: AiTask[];
  initialStats: {
    pending_review: number;
    executing: number;
    completed: number;
    failed: number;
  };
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

export function AiTasksView({ initialTasks, initialStats }: Props) {
  const router = useRouter();
  const [tasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state para nova tarefa
  const [newTitle, setNewTitle] = useState("");
  const [newIntent, setNewIntent] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(s) ||
          (t.intent && t.intent.toLowerCase().includes(s)) ||
          (t.description && t.description.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [tasks, search, statusFilter]);

  const handleCreateDemoTask = async () => {
    if (!newTitle.trim() || !newIntent.trim()) return;
    setCreating(true);
    try {
      const result = await createAiTask({
        title: newTitle,
        intent: newIntent,
        description: newDescription || undefined,
      });

      if (result.success && result.data) {
        // Adicionar steps de exemplo
        await addAiTaskStep(result.data.id, {
          stepOrder: 1,
          actionCatalog: "system.validate_context",
          actionParams: { intent: newIntent },
          description: "Validar contexto e parâmetros",
        });

        await addAiTaskStep(result.data.id, {
          stepOrder: 2,
          actionCatalog: "system.execute_action",
          actionParams: { intent: newIntent },
          description: "Executar ação principal",
        });

        // Submeter para revisão
        await submitAiTaskForReview(
          result.data.id,
          `Plano automático para: ${newTitle}. 2 steps definidos.`
        );

        setNewTitle("");
        setNewIntent("");
        setNewDescription("");
        setShowNewModal(false);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="IA Executora"
        description="Fluxo Plan → Confirm → Execute. A IA propõe, humano confirma, sistema executa."
      >
        <Button onClick={() => setShowNewModal(true)}>Nova Tarefa IA</Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{initialStats.pending_review}</div>
          <div className="mt-1 text-xs text-slate-400">Aguardando Revisão</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{initialStats.executing}</div>
          <div className="mt-1 text-xs text-slate-400">Executando</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{initialStats.completed}</div>
          <div className="mt-1 text-xs text-slate-400">Concluídas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{initialStats.failed}</div>
          <div className="mt-1 text-xs text-slate-400">Falhas</div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou intenção..."
          className="h-10 w-full rounded-lg border border-slate-600 bg-slate-800 pl-3 pr-4 text-sm text-white placeholder-slate-400 sm:w-64"
        />
        <select
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(statusConfig).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa IA"
          description="Crie uma nova tarefa para a IA executar via Action Catalog."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const cfg = statusConfig[task.status] ?? statusConfig.cancelled;
            return (
              <Link key={task.id} href={`/ia-executora/${task.id}`}>
                <Card className="cursor-pointer p-4 transition-colors hover:bg-slate-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-white">{task.title}</h3>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-400">{task.intent}</p>
                      {task.plan_summary && (
                        <p className="mt-1 truncate text-xs text-slate-500">{task.plan_summary}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>{formatDate(task.created_at)}</div>
                      <div className="mt-1">
                        {task.completed_steps}/{task.total_steps} steps
                      </div>
                    </div>
                  </div>
                  {task.total_steps > 0 && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          task.status === "failed" ? "bg-red-500" : "bg-green-500"
                        )}
                        style={{
                          width: `${Math.round((task.completed_steps / task.total_steps) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal Nova Tarefa */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-800 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Nova Tarefa IA</h2>
            <p className="mt-1 text-sm text-slate-400">
              Defina o objetivo. A IA criará um plano de execução para revisão humana.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Título</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Lançar NF do fornecedor X"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Intenção / Objetivo</label>
                <input
                  type="text"
                  value={newIntent}
                  onChange={(e) => setNewIntent(e.target.value)}
                  placeholder="Ex: Registrar entrada de mercadoria da NF 12345"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Descrição (opcional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateDemoTask}
                disabled={creating || !newTitle.trim() || !newIntent.trim()}
              >
                {creating ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
