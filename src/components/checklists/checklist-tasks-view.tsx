"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { listTasks, listTemplates, createTask } from "@/actions/checklists";
import type { ChecklistTask } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
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

interface StoreOption {
  id: string;
  name: string;
}

interface TemplateOption {
  id: string;
  name: string;
}

export function ChecklistTasksView() {
  const router = useRouter();
  const [data, setData] = React.useState<ChecklistTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [templates, setTemplates] = React.useState<TemplateOption[]>([]);

  const [newStoreId, setNewStoreId] = React.useState("");
  const [newTemplateId, setNewTemplateId] = React.useState("");
  const [newTaskDate, setNewTaskDate] = React.useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [newShift, setNewShift] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const opts: { status?: string } = {};
    if (statusFilter !== "all") opts.status = statusFilter;
    const result = await listTasks(opts);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar tarefas.");
    }
    setLoading(false);
  }, [statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    async function loadStores() {
      const supabase = createClient();
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (storesData) setStores(storesData as StoreOption[]);
    }
    loadStores();
  }, []);

  React.useEffect(() => {
    async function loadTemplates() {
      const result = await listTemplates();
      if (result.success && result.data) {
        setTemplates(
          result.data.map((t) => ({ id: t.id, name: t.name }))
        );
      }
    }
    loadTemplates();
  }, []);

  async function handleCreate() {
    if (!newStoreId || !newTemplateId) return;
    setActionLoading(true);
    setError(null);
    const result = await createTask({
      storeId: newStoreId,
      templateId: newTemplateId,
      taskDate: newTaskDate || undefined,
      shift: newShift.trim() || undefined,
    });
    if (result.success && result.data) {
      setShowCreateForm(false);
      setNewStoreId("");
      setNewTemplateId("");
      setNewTaskDate(new Date().toISOString().split("T")[0]);
      setNewShift("");
      await loadData();
      router.push(`/checklists/tarefas/${result.data.id}`);
    } else {
      setError(result.error ?? "Erro ao criar tarefa.");
    }
    setActionLoading(false);
  }

  const storeMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    stores.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [stores]);

  const templateMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    templates.forEach((t) => (m[t.id] = t.name));
    return m;
  }, [templates]);

  const columns: Column<ChecklistTask & Record<string, unknown>>[] = [
    {
      key: "task_date",
      header: "Data",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.task_date)}
        </span>
      ),
    },
    {
      key: "template_id",
      header: "Template",
      render: (row) => (
        <span className="text-sm text-slate-700 font-mono">
          {(templateMap[row.template_id] ?? row.template_id).slice(0, 8)}
          {(templateMap[row.template_id] ?? row.template_id).length > 8
            ? "…"
            : ""}
        </span>
      ),
    },
    {
      key: "store_id",
      header: "Loja",
      render: (row) => (
        <span className="text-sm text-slate-700 font-mono">
          {(storeMap[row.store_id] ?? row.store_id).slice(0, 8)}
          {(storeMap[row.store_id] ?? row.store_id).length > 8 ? "…" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const cfg =
          statusConfig[row.status] ?? {
            label: row.status,
            variant: "default" as const,
          };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: "score_pct",
      header: "Score",
      render: (row) => {
        const pct = Number(row.score_pct);
        const color =
          pct >= 100 ? "text-success" : pct >= 80 ? "text-slate-700" : "text-danger";
        return (
          <span className={`text-sm font-medium ${color}`}>
            {pct.toFixed(0)}%
          </span>
        );
      },
    },
    {
      key: "nok_items",
      header: "NOK",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {Number(row.nok_items)}
        </span>
      ),
    },
  ];

  if (error && !showCreateForm) {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              "all",
              "pending",
              "in_progress",
              "completed",
              "expired",
            ] as const
          ).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "Todas" : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Nova Tarefa
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Nova Tarefa de Checklist
          </h3>
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Fechar
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Loja
              </label>
              <select
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione a loja</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Template
              </label>
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="">Selecione o template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Data"
              type="date"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
            />
            <Input
              label="Turno (opcional)"
              type="text"
              value={newShift}
              onChange={(e) => setNewShift(e.target.value)}
              placeholder="Ex: Manhã"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={actionLoading}
              disabled={!newStoreId || !newTemplateId}
            >
              Criar Tarefa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data as (ChecklistTask & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhuma tarefa encontrada."
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/checklists/tarefas/${row.id}`)}
      />
    </div>
  );
}
