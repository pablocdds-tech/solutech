"use client";

import { useState } from "react";
import { DashboardNav } from "@/app/(dashboard)/dashboard-nav";
import { DashboardHeader } from "./dashboard-header";

interface UserData {
  fullName: string;
  email: string;
  role: string;
  stores: { id: string; name: string; type: string }[];
}

interface Props {
  user: UserData;
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-text transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-lg font-bold text-white">Vitaliano ERP</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <DashboardNav />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <DashboardHeader
          user={user}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
