"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Profile, Store } from "@/types/database";
import { updateUserRole, toggleUserActive, updateStore, inviteUser } from "@/actions/admin";

interface EnrichedProfile extends Profile {
  store_count: number;
  module_count: number;
}

interface Props {
  users: EnrichedProfile[];
  stores: Store[];
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  financial: "Financeiro",
  purchasing: "Compras",
  stock_production: "Estoque/Produção",
  store_manager: "Gerente de Loja",
  cashier: "Operador de Caixa",
  counter: "Contador",
  checklist_executor: "Executor Checklist",
  maintenance: "Manutenção",
};

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }));

export function AdminView({ users, stores }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "stores">("users");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("store_manager");
  const [inviteStores, setInviteStores] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviteLoading(true);
    setError(null);
    setInviteSuccess("");

    const result = await inviteUser({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      role: inviteRole,
      storeIds: inviteStores,
    });

    setInviteLoading(false);

    if (result.success) {
      setInviteSuccess(`Convite enviado para ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("store_manager");
      setInviteStores([]);
      setShowInvite(false);
      router.refresh();
    } else {
      setError(result.error ?? "Erro ao convidar");
    }
  };

  const toggleInviteStore = (storeId: string) => {
    setInviteStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoading(userId);
    setError(null);
    try {
      const result = await updateUserRole(userId, newRole);
      if (!result.success) setError(result.error ?? "Erro");
      else router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setLoading(userId);
    setError(null);
    try {
      const result = await toggleUserActive(userId, !isActive);
      if (!result.success) setError(result.error ?? "Erro");
      else router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const handleToggleStore = async (storeId: string, isActive: boolean) => {
    setLoading(storeId);
    try {
      const result = await updateStore(storeId, { isActive: !isActive });
      if (!result.success) setError(result.error ?? "Erro");
      else router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Administração"
        description="Gerencie usuários, lojas e permissões da organização"
      />

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Usuários ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("stores")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "stores"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Lojas ({stores.length})
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="mt-4 space-y-3">
          {/* Botão convite */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{users.length} usuário(s)</span>
            <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? "Fechar" : "Convidar Usuário"}
            </Button>
          </div>

          {inviteSuccess && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {inviteSuccess}
            </div>
          )}

          {/* Formulário de convite */}
          {showInvite && (
            <Card className="p-5 space-y-4 border-primary-200 bg-primary-50/30">
              <h3 className="text-sm font-semibold text-slate-900">Convidar novo usuário</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="João Silva"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="joao@exemplo.com"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Perfil / Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lojas com acesso</label>
                  <div className="flex flex-wrap gap-2">
                    {stores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleInviteStore(s.id)}
                        className={`rounded-md px-2 py-1 text-xs font-medium border transition-colors ${
                          inviteStores.includes(s.id)
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-primary-400"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim() || !inviteName.trim()}
              >
                {inviteLoading ? "Enviando..." : "Enviar Convite"}
              </Button>
            </Card>
          )}

          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum usuário encontrado</p>
          ) : (
            users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                      {user.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{user.full_name}</span>
                        {!user.is_active && <Badge variant="danger">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {user.store_count} loja(s) · {user.module_count} módulo(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={loading === user.id}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    <Button
                      variant={user.is_active ? "danger" : "primary"}
                      size="sm"
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      disabled={loading === user.id}
                    >
                      {user.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Stores Tab */}
      {activeTab === "stores" && (
        <div className="mt-4 space-y-3">
          {stores.map((store) => (
            <Card key={store.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{store.name}</span>
                    <Badge variant={store.type === "cd" ? "info" : "success"}>
                      {store.type === "cd" ? "CD" : "Loja"}
                    </Badge>
                    {!store.is_active && <Badge variant="danger">Inativa</Badge>}
                  </div>
                  {store.cnpj && <p className="text-xs text-slate-500">CNPJ: {store.cnpj}</p>}
                  {store.address && <p className="text-xs text-slate-400">{store.address}</p>}
                </div>

                <Button
                  variant={store.is_active ? "outline" : "primary"}
                  size="sm"
                  onClick={() => handleToggleStore(store.id, store.is_active)}
                  disabled={loading === store.id}
                >
                  {store.is_active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
