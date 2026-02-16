"use client";

import * as React from "react";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
} from "@/actions/checklists";
import type { ChecklistTemplate } from "@/types/database";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

export function TemplatesView() {
  const [data, setData] = React.useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [newScheduleType, setNewScheduleType] = React.useState("manual");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listTemplates();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Erro ao carregar templates.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setActionLoading(true);
    setError(null);
    const result = await createTemplate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory.trim() || undefined,
      scheduleType: newScheduleType,
    });
    if (result.success) {
      setShowCreateForm(false);
      setNewName("");
      setNewDescription("");
      setNewCategory("");
      setNewScheduleType("manual");
      await loadData();
    } else {
      setError(result.error ?? "Erro ao criar template.");
    }
    setActionLoading(false);
  }

  async function handleToggleActive(template: ChecklistTemplate) {
    setActionLoading(true);
    setError(null);
    const result = await updateTemplate(template.id, {
      isActive: !template.is_active,
    });
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao atualizar template.");
    }
    setActionLoading(false);
  }

  const scheduleLabels: Record<string, string> = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
    manual: "Manual",
  };

  const columns: Column<ChecklistTemplate & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Nome",
      render: (row) => (
        <span className="text-sm font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.category || "—"}
        </span>
      ),
    },
    {
      key: "schedule_type",
      header: "Agendamento",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {scheduleLabels[row.schedule_type ?? ""] ?? row.schedule_type ?? "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => (
        <Badge variant={row.is_active ? "success" : "default"}>
          {row.is_active ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleActive(row as ChecklistTemplate);
          }}
          disabled={actionLoading}
        >
          {row.is_active ? "Desativar" : "Ativar"}
        </Button>
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
        <div />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Novo Template
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Novo Template
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
            <Input
              label="Nome"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Limpeza diária"
            />
            <Input
              label="Categoria"
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Opcional"
            />
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Agendamento
              </label>
              <select
                value={newScheduleType}
                onChange={(e) => setNewScheduleType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <option value="manual">Manual</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Textarea
                label="Descrição"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={actionLoading}
              disabled={!newName.trim()}
            >
              Criar Template
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
        data={data as (ChecklistTemplate & Record<string, unknown>)[]}
        loading={loading}
        emptyMessage="Nenhum template encontrado."
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
