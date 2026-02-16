import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

/**
 * Layout do dashboard — shell principal do ERP.
 * Carrega dados do usuário autenticado e renderiza sidebar + header.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        stores: user.stores,
      }}
    >
      {children}
    </DashboardShell>
  );
}
