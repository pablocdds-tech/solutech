"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createEntity,
  updateEntity,
  toggleEntityActive,
} from "@/actions/cadastros";
import type { EntityConfig, EntityFieldConfig } from "@/lib/cadastros/entity-configs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface EntityListPageProps {
  config: EntityConfig;
  initialData: Record<string, unknown>[];
}

function getFieldValue(
  item: Record<string, unknown>,
  field: EntityFieldConfig
): unknown {
  const val = item[field.name];
  if (field.type === "boolean") return Boolean(val);
  if (field.type === "number") return val != null ? Number(val) : null;
  return val ?? "";
}

function FormField({
  field,
  value,
  onChange,
  error,
}: {
  field: EntityFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  if (field.type === "text")
    return (
      <Input
        label={field.label}
        placeholder={field.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      />
    );
  if (field.type === "number")
    return (
      <Input
        type="number"
        label={field.label}
        placeholder={field.placeholder}
        value={value != null ? String(value) : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        error={error}
      />
    );
  if (field.type === "textarea")
    return (
      <Textarea
        label={field.label}
        placeholder={field.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      />
    );
  if (field.type === "select")
    return (
      <Select
        label={field.label}
        options={field.options ?? []}
        placeholder={field.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        error={error}
      />
    );
  if (field.type === "boolean")
    return (
      <Toggle
        label={field.label}
        checked={Boolean(value)}
        onChange={(c) => onChange(c)}
      />
    );
  return null;
}

export function EntityListPage({ config, initialData }: EntityListPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("q") ?? "";

  const [modalOpen, setModalOpen] = React.useState<"create" | "edit" | null>(
    null
  );
  const [editingItem, setEditingItem] =
    React.useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = React.useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const formFields = config.fields.filter((f) => f.showInForm);

  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return initialData;
    const q = searchTerm.toLowerCase().trim();
    return initialData.filter((item) => {
      const name = String(item.name ?? "").toLowerCase();
      return name.includes(q);
    });
  }, [initialData, searchTerm]);

  const handleToggle = React.useCallback(
    async (item: Record<string, unknown>) => {
      const id = item.id as string;
      if (!id) return;
      const result = await toggleEntityActive(
        config.table,
        id,
        !item.is_active,
        config.routePath
      );
      if (result.success) {
        router.refresh();
        showToast("success", "Status alterado com sucesso.");
      } else {
        showToast("error", result.error ?? "Erro ao alterar status.");
      }
    },
    [config.table, config.routePath, router, showToast]
  );

  const columns: Column<Record<string, unknown>>[] = React.useMemo(() => {
    const cols: Column<Record<string, unknown>>[] = config.fields
      .filter((f) => f.showInTable)
      .map((f) => ({
        key: f.name,
        header: f.label,
        render:
          f.type === "boolean"
            ? (item) => (
                <span className="text-slate-700">
                  {Boolean(item[f.name]) ? "Sim" : "Não"}
                </span>
              )
            : undefined,
      }));

    cols.push({
      key: "is_active",
      header: "Status",
      render: (item) => (
        <Badge variant={item.is_active ? "success" : "danger"}>
          {item.is_active ? "Ativo" : "Inativo"}
        </Badge>
      ),
    });

    cols.push({
      key: "_actions",
      header: "",
      className: "w-24",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(item);
          }}
        >
          {item.is_active ? "Desativar" : "Ativar"}
        </Button>
      ),
    });

    return cols;
  }, [config.fields, handleToggle]);

  const openCreate = () => {
    const data: Record<string, unknown> = {};
    formFields.forEach((f) => {
      data[f.name] = f.defaultValue ?? (f.type === "boolean" ? false : "");
    });
    setFormData(data);
    setFormErrors({});
    setEditingItem(null);
    setModalOpen("create");
  };

  const openEdit = (item: Record<string, unknown>) => {
    const data: Record<string, unknown> = {};
    formFields.forEach((f) => {
      data[f.name] = getFieldValue(item, f);
    });
    setFormData(data);
    setFormErrors({});
    setEditingItem(item);
    setModalOpen("edit");
  };

  const closeModal = () => {
    setModalOpen(null);
    setEditingItem(null);
    setFormData({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    formFields.forEach((f) => {
      if (f.required) {
        const v = formData[f.name];
        if (v === undefined || v === null || v === "") {
          errs[f.name] = `${f.label} é obrigatório.`;
        }
      }
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      if (modalOpen === "create") {
        const result = await createEntity(config.table, formData, config.routePath);
        if (result.success) {
          showToast("success", "Registro criado com sucesso.");
          router.refresh();
          closeModal();
        } else {
          showToast("error", result.error ?? "Erro ao criar registro.");
        }
      } else if (modalOpen === "edit" && editingItem) {
        const id = editingItem.id as string;
        const result = await updateEntity(
          config.table,
          id,
          formData,
          config.routePath
        );
        if (result.success) {
          showToast("success", "Registro atualizado com sucesso.");
          router.refresh();
          closeModal();
        } else {
          showToast("error", result.error ?? "Erro ao atualizar registro.");
        }
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={config.namePlural}
        description={`Gerencie os cadastros de ${config.namePlural.toLowerCase()}.`}
      >
        <Button onClick={openCreate}>Novo</Button>
      </PageHeader>

      <div className="flex gap-4">
        <div className="w-full max-w-sm">
          <SearchInput placeholder={`Buscar ${config.namePlural.toLowerCase()}...`} />
        </div>
      </div>

      <DataTable<Record<string, unknown>>
        columns={columns}
        data={filteredData}
        onRowClick={openEdit}
        emptyMessage={`Nenhum ${config.name} encontrado.`}
        getRowKey={(item) => String(item.id ?? "")}
      />

      {/* Modal overlay */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">
              {modalOpen === "create"
                ? `Novo ${config.name}`
                : `Editar ${config.name}`}
            </h3>

            <div className="mt-6 space-y-4">
              {formFields.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={(v) =>
                    setFormData((prev) => ({ ...prev, [field.name]: v }))
                  }
                  error={formErrors[field.name]}
                />
              ))}

              {modalOpen === "edit" && editingItem && (
                <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
                  <Toggle
                    label="Ativo"
                    checked={Boolean(editingItem.is_active)}
                    onChange={async (checked) => {
                      const id = editingItem.id as string;
                      const r = await toggleEntityActive(
                        config.table,
                        id,
                        checked,
                        config.routePath
                      );
                      if (r.success) {
                        router.refresh();
                        setEditingItem((prev) =>
                          prev ? { ...prev, is_active: checked } : null
                        );
                        showToast("success", "Status alterado com sucesso.");
                      } else {
                        showToast("error", r.error ?? "Erro ao alterar status.");
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeModal}>
                Cancelar
              </Button>
              <Button loading={submitLoading} onClick={handleSubmit}>
                {modalOpen === "create" ? "Criar" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast simples */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
