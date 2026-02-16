"use client";

import * as React from "react";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/actions/notificacoes";
import type { Notification } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const priorityConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }
> = {
  low: { label: "Baixa", variant: "default" },
  normal: { label: "Normal", variant: "info" },
  high: { label: "Alta", variant: "warning" },
  critical: { label: "Crítica", variant: "danger" },
};

const channelLabels: Record<string, string> = {
  inbox: "Caixa de entrada",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

export function NotificationsView() {
  const [data, setData] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [actionLoading, setActionLoading] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, countRes] = await Promise.all([
      listNotifications({
        unreadOnly: filter === "unread",
      }),
      getUnreadCount(),
    ]);

    if (listRes.success && listRes.data) {
      setData(listRes.data);
    } else {
      setError(listRes.error ?? "Erro ao carregar notificações.");
    }

    if (countRes.success && countRes.data != null) {
      setUnreadCount(countRes.data);
    }

    setLoading(false);
  }, [filter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMarkAsRead(notificationId: string) {
    const result = await markAsRead(notificationId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao marcar como lida.");
    }
  }

  async function handleMarkAllAsRead() {
    setActionLoading(true);
    setError(null);
    const result = await markAllAsRead();
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Erro ao marcar todas como lidas.");
    }
    setActionLoading(false);
  }

  if (error) {
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
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "unread"
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Não lidas ({unreadCount})
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllAsRead}
          loading={actionLoading}
          disabled={unreadCount === 0}
        >
          Marcar Todas como Lidas
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">Nenhuma notificação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleMarkAsRead(n.id)}
              className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/30 ${
                !n.is_read ? "border-l-4 border-l-primary-500" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3
                  className={`text-sm ${
                    !n.is_read ? "font-bold text-slate-900" : "font-medium text-slate-700"
                  }`}
                >
                  {n.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={priorityConfig[n.priority]?.variant ?? "default"}
                  >
                    {priorityConfig[n.priority]?.label ?? n.priority}
                  </Badge>
                  <Badge variant="default">
                    {channelLabels[n.channel] ?? n.channel}
                  </Badge>
                </div>
              </div>
              {n.body && (
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                  {n.body}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {formatDateTime(n.created_at)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
